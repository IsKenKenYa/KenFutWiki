package usecase

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"

	"github.com/google/uuid"
	"github.com/minio/minio-go/v7"
	"gorm.io/gorm"

	"github.com/chaitin/panda-wiki/config"
	"github.com/chaitin/panda-wiki/domain"
	"github.com/chaitin/panda-wiki/log"
	"github.com/chaitin/panda-wiki/repo/pg"
	"github.com/chaitin/panda-wiki/store/s3"
)

type StorageUsecase struct {
	logger   *log.Logger
	config   *config.Config
	repo     *pg.SystemSettingRepo
	s3Client *s3.ClientHolder
}

func NewStorageUsecase(logger *log.Logger, config *config.Config, repo *pg.SystemSettingRepo, s3Client *s3.ClientHolder) *StorageUsecase {
	return &StorageUsecase{
		logger:   logger.WithModule("usecase.storage"),
		config:   config,
		repo:     repo,
		s3Client: s3Client,
	}
}

// GetSetting 返回当前生效的存储配置（secret 掩码）与客户端运行状态
func (u *StorageUsecase) GetSetting(ctx context.Context) (*domain.StorageSettingDetail, error) {
	setting, source, err := u.effectiveSetting(ctx)
	if err != nil {
		return nil, err
	}
	detail := &domain.StorageSettingDetail{
		Setting:   u.mask(setting),
		Source:    source,
		SecretSet: setting.SecretKey != "",
	}
	status := u.s3Client.Status()
	detail.Ready = status.Ready
	detail.Error = status.Error
	detail.Warnings = status.Warnings
	return detail, nil
}

// UpdateSetting 校验并保存存储配置；secret 留空或为掩码时沿用原值。
// 保存前先试建客户端验证连通性，成功后立即让 holder 失效重建（本进程下次使用即生效）。
func (u *StorageUsecase) UpdateSetting(ctx context.Context, req *domain.StorageSetting) (*domain.StorageSettingDetail, error) {
	if req.Endpoint == "" {
		return nil, fmt.Errorf("endpoint 不能为空")
	}
	if req.AccessKey == "" {
		return nil, fmt.Errorf("access key 不能为空")
	}
	if req.Bucket == "" {
		req.Bucket = domain.DefaultBucket
	}
	// 站点反代按 /static-file/* 前缀（即默认桶名）转发，自定义桶名只能走公网地址直连
	if req.Bucket != domain.DefaultBucket && req.PublicURL == "" {
		return nil, fmt.Errorf("使用非默认桶名 %q 时必须填写公网访问地址", req.Bucket)
	}

	current, _, err := u.effectiveSetting(ctx)
	if err != nil {
		return nil, err
	}
	if req.SecretKey == "" || req.SecretKey == domain.MaskedSecret {
		req.SecretKey = current.SecretKey
	}
	req.Normalize()

	if _, _, err := s3.NewStorageClientForTest(ctx, req); err != nil {
		return nil, fmt.Errorf("存储连接失败: %w", err)
	}

	if err := u.repo.SaveStorageSetting(ctx, req); err != nil {
		return nil, fmt.Errorf("save storage setting: %w", err)
	}
	u.s3Client.Invalidate()
	u.logger.Info("storage setting updated", log.String("endpoint", req.Endpoint), log.String("provider", req.Provider))

	detail := &domain.StorageSettingDetail{
		Setting:   u.mask(req),
		Source:    "database",
		Ready:     true,
		SecretSet: req.SecretKey != "",
	}
	return detail, nil
}

// TestConnection 用给定配置做连通性探测（建客户端、确保桶、上传/读取/删除探测对象），不落库
func (u *StorageUsecase) TestConnection(ctx context.Context, req *domain.StorageSetting) (*domain.StorageTestResult, error) {
	current, _, err := u.effectiveSetting(ctx)
	if err != nil {
		return nil, err
	}
	if req.SecretKey == "" || req.SecretKey == domain.MaskedSecret {
		req.SecretKey = current.SecretKey
	}
	req.Normalize()

	result := &domain.StorageTestResult{Steps: []domain.StorageTestStep{}}
	step := func(name string, err error, message string) {
		s := domain.StorageTestStep{Name: name, OK: err == nil, Message: message}
		if err != nil {
			s.Message = err.Error()
		}
		result.Steps = append(result.Steps, s)
	}

	client, warns, err := s3.NewStorageClientForTest(ctx, req)
	if err != nil {
		step("连接存储服务", err, "")
		result.Warnings = warns
		return result, nil
	}
	step("连接存储服务", nil, req.Endpoint)

	if err := probeObject(ctx, client, req.Bucket); err != nil {
		step("写入/读取对象", err, "")
		result.Warnings = warns
		return result, nil
	}
	step("写入/读取对象", nil, fmt.Sprintf("bucket %q 读写正常", req.Bucket))

	result.OK = true
	result.Warnings = warns
	return result, nil
}

// ResetSetting 删除数据库配置，回退环境变量默认值
func (u *StorageUsecase) ResetSetting(ctx context.Context) error {
	if err := u.repo.DeleteStorageSetting(ctx); err != nil {
		return fmt.Errorf("delete storage setting: %w", err)
	}
	u.s3Client.Invalidate()
	u.logger.Info("storage setting reset to env default")
	return nil
}

// effectiveSetting 返回当前生效配置：数据库优先，未配置回退环境变量默认值
func (u *StorageUsecase) effectiveSetting(ctx context.Context) (*domain.StorageSetting, string, error) {
	s, err := u.repo.GetStorageSetting(ctx)
	if err == nil {
		s.Normalize()
		return s, "database", nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, "", fmt.Errorf("get storage setting: %w", err)
	}
	d := &domain.StorageSetting{
		Provider:   domain.StorageProviderMinio,
		Endpoint:   u.config.S3.Endpoint,
		AccessKey:  u.config.S3.AccessKey,
		SecretKey:  u.config.S3.SecretKey,
		Bucket:     u.config.S3.Bucket,
		Region:     u.config.S3.Region,
		Secure:     u.config.S3.Secure,
		PublicURL:  u.config.S3.PublicURL,
		AutoBucket: true,
	}
	d.Normalize()
	return d, "default", nil
}

func (u *StorageUsecase) mask(s *domain.StorageSetting) *domain.StorageSetting {
	copied := *s
	if copied.SecretKey != "" {
		copied.SecretKey = domain.MaskedSecret
	}
	return &copied
}

// probeObject 上传/读取/删除一个探测对象，验证凭证具备读写权限
func probeObject(ctx context.Context, client *minio.Client, bucket string) error {
	key := fmt.Sprintf("__probe__/%s.txt", uuid.New().String())
	content := []byte("panda-wiki storage probe")
	if _, err := client.PutObject(ctx, bucket, key, bytes.NewReader(content), int64(len(content)),
		minio.PutObjectOptions{ContentType: "text/plain"}); err != nil {
		return fmt.Errorf("上传探测对象失败: %w", err)
	}
	obj, err := client.GetObject(ctx, bucket, key, minio.GetObjectOptions{})
	if err != nil {
		return fmt.Errorf("读取探测对象失败: %w", err)
	}
	defer obj.Close()
	data, err := io.ReadAll(obj)
	if err != nil {
		return fmt.Errorf("读取探测对象失败: %w", err)
	}
	if string(data) != string(content) {
		return fmt.Errorf("探测对象内容不一致")
	}
	if err := client.RemoveObject(ctx, bucket, key, minio.RemoveObjectOptions{}); err != nil {
		return fmt.Errorf("清理探测对象失败: %w", err)
	}
	return nil
}

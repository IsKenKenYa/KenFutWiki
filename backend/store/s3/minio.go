package s3

import (
	"context"
	"errors"
	"fmt"
	"io"
	"reflect"
	"strings"
	"sync"
	"time"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
	"gorm.io/gorm"

	"github.com/chaitin/panda-wiki/config"
	"github.com/chaitin/panda-wiki/domain"
	"github.com/chaitin/panda-wiki/log"
)

// settingRefreshInterval 与数据库存储配置比对的周期：
// api 进程保存新配置后，consumer 等其它进程最迟一个周期内自动重建客户端，无需重启。
var settingRefreshInterval = time.Minute

// buildRetryInterval 构建失败后的重试退避，期间直接返回缓存的错误，避免每个请求都探测一次远端。
var buildRetryInterval = 10 * time.Second

const publicReadPolicy = `{
	"Version": "2012-10-17",
	"Statement": [
		{
			"Action": ["s3:GetObject"],
			"Effect": "Allow",
			"Principal": "*",
			"Resource": ["arn:aws:s3:::%s/*"],
			"Sid": "PublicRead"
		}
	]
}`

// ClientHolder 持有按需构建的 S3 兼容存储客户端（MinIO、阿里云 OSS 等）。
// 构造时不做任何网络访问，存储不可用不影响进程启动；首次使用时构建，
// 之后周期性比对数据库中的存储配置，发现变化自动重建。
type ClientHolder struct {
	config *config.Config
	source domain.StorageSettingSource
	logger *log.Logger

	mu        sync.Mutex
	client    *minio.Client
	setting   *domain.StorageSetting // 当前生效（或最近一次尝试）的配置快照
	fromDB    bool
	checkedAt time.Time // 上次与数据库比对或尝试构建的时间
	lastErr   error
	lastWarns []string
}

func NewClientHolder(config *config.Config, source domain.StorageSettingSource, logger *log.Logger) *ClientHolder {
	return &ClientHolder{
		config: config,
		source: source,
		logger: logger.WithModule("store.s3"),
	}
}

// NewStorageClientForTest 按给定配置构建 S3 兼容客户端并确保桶可用，供保存前验证与连接测试使用。
// warnings 表示不影响写入但值得关注的问题（如公读策略设置失败，OSS 需在控制台为桶预设公共读 ACL）。
func NewStorageClientForTest(ctx context.Context, s *domain.StorageSetting) (*minio.Client, []string, error) {
	if s.Endpoint == "" {
		return nil, nil, errors.New("storage endpoint is empty")
	}
	if s.AccessKey == "" || s.SecretKey == "" {
		return nil, nil, errors.New("storage access key or secret key is empty")
	}
	c, err := minio.New(s.Endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(s.AccessKey, s.SecretKey, ""),
		Secure: s.Secure,
		Region: s.Region,
	})
	if err != nil {
		return nil, nil, fmt.Errorf("new s3 client: %w", err)
	}

	var warns []string
	exists, err := c.BucketExists(ctx, s.Bucket)
	if err != nil {
		return nil, nil, fmt.Errorf("check bucket %q: %w", s.Bucket, err)
	}
	if exists {
		return c, nil, nil
	}
	if !s.AutoBucket {
		return nil, nil, fmt.Errorf("bucket %q does not exist", s.Bucket)
	}
	if err := c.MakeBucket(ctx, s.Bucket, minio.MakeBucketOptions{Region: s.Region}); err != nil {
		// 部分兼容实现对已属于当前账号的桶会报错，重新确认一次
		if exists, _ := c.BucketExists(ctx, s.Bucket); !exists {
			return nil, nil, fmt.Errorf("make bucket %q: %w", s.Bucket, err)
		}
		return c, nil, nil
	}
	if err := c.SetBucketPolicy(ctx, s.Bucket, fmt.Sprintf(publicReadPolicy, s.Bucket)); err != nil {
		warns = append(warns, fmt.Sprintf("设置公共读策略失败，对象可能无法匿名读取（OSS 请在控制台为桶设置公共读 ACL）: %v", err))
	}
	return c, warns, nil
}

// client 返回当前可用的客户端与生效配置；未初始化或重建失败时返回错误。
func (h *ClientHolder) current(ctx context.Context) (*minio.Client, *domain.StorageSetting, error) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if h.client != nil && time.Since(h.checkedAt) < settingRefreshInterval {
		return h.client, h.setting, nil
	}
	if h.client == nil && h.lastErr != nil && time.Since(h.checkedAt) < buildRetryInterval {
		return nil, h.setting, h.lastErr
	}

	setting, fromDB := h.loadSetting(ctx)
	if h.client != nil && reflect.DeepEqual(setting, h.setting) {
		h.checkedAt = time.Now()
		return h.client, h.setting, nil
	}

	c, warns, err := NewStorageClientForTest(ctx, setting)
	h.checkedAt = time.Now()
	if err != nil {
		h.lastErr = err
		h.lastWarns = nil
		if h.client == nil {
			h.setting = setting
			h.fromDB = fromDB
		}
		h.logger.Error("build storage client failed", log.String("endpoint", setting.Endpoint), log.Error(err))
		return nil, setting, fmt.Errorf("storage client unavailable: %w", err)
	}
	if h.client != nil {
		h.logger.Info("storage config changed, client rebuilt", log.String("endpoint", setting.Endpoint))
	}
	h.client = c
	h.setting = setting
	h.fromDB = fromDB
	h.lastErr = nil
	h.lastWarns = warns
	for _, w := range warns {
		h.logger.Warn("storage client warning", log.String("warning", w))
	}
	return h.client, h.setting, nil
}

// loadSetting 读取数据库存储配置，未配置或读取失败时回退环境变量默认值
func (h *ClientHolder) loadSetting(ctx context.Context) (*domain.StorageSetting, bool) {
	if h.source != nil {
		s, err := h.source.GetStorageSetting(ctx)
		if err == nil && s != nil {
			s.Normalize()
			return s, true
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			h.logger.Error("load storage setting failed, fallback to env config", log.Error(err))
		}
	}
	return h.defaultSetting(), false
}

func (h *ClientHolder) defaultSetting() *domain.StorageSetting {
	s := &domain.StorageSetting{
		Provider:   domain.StorageProviderMinio,
		Endpoint:   h.config.S3.Endpoint,
		AccessKey:  h.config.S3.AccessKey,
		SecretKey:  h.config.S3.SecretKey,
		Bucket:     h.config.S3.Bucket,
		Region:     h.config.S3.Region,
		Secure:     h.config.S3.Secure,
		PublicURL:  h.config.S3.PublicURL,
		AutoBucket: true,
	}
	s.Normalize()
	return s
}

// snapshot 返回当前生效配置；尚未加载时返回环境变量默认值
func (h *ClientHolder) snapshot() *domain.StorageSetting {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.setting != nil {
		return h.setting
	}
	return h.defaultSetting()
}

// PutObject 上传对象到当前配置的桶
func (h *ClientHolder) PutObject(ctx context.Context, objectName string, reader io.Reader, size int64, opts minio.PutObjectOptions) (minio.UploadInfo, error) {
	c, s, err := h.current(ctx)
	if err != nil {
		return minio.UploadInfo{}, err
	}
	return c.PutObject(ctx, s.Bucket, objectName, reader, size, opts)
}

// Bucket 当前生效的桶名
func (h *ClientHolder) Bucket() string {
	return h.snapshot().Bucket
}

// PublicURL 生成浏览器可访问的 URL：配置了 public_url 时为绝对地址，否则为经反代同源访问的相对路径
func (h *ClientHolder) PublicURL(key string) string {
	s := h.snapshot()
	if s.PublicURL != "" {
		return fmt.Sprintf("%s/%s", s.PublicURL, key)
	}
	return fmt.Sprintf("/%s/%s", s.Bucket, key)
}

// InternalURL 生成服务端（同网络爬虫等）可访问的绝对 URL：优先 public_url，否则 endpoint 直连
func (h *ClientHolder) InternalURL(key string) string {
	s := h.snapshot()
	if s.PublicURL != "" {
		return fmt.Sprintf("%s/%s", s.PublicURL, key)
	}
	scheme := "http"
	if s.Secure {
		scheme = "https"
	}
	return fmt.Sprintf("%s://%s/%s/%s", scheme, s.Endpoint, s.Bucket, key)
}

// AbsURL 把存储相对路径（/{bucket}/{key}）转换为可被外部服务（如微信）拉取的绝对 URL；
// 已经是绝对地址时原样返回。
func (h *ClientHolder) AbsURL(path string) string {
	if path == "" || strings.HasPrefix(path, "http://") || strings.HasPrefix(path, "https://") || strings.HasPrefix(path, "data:") {
		return path
	}
	s := h.snapshot()
	if s.PublicURL != "" {
		key := strings.TrimPrefix(path, "/")
		// 相对路径带桶名段，public_url 通常已指向桶域名，去掉桶段
		if i := strings.Index(key, "/"); i > 0 {
			key = key[i+1:]
		}
		return fmt.Sprintf("%s/%s", s.PublicURL, key)
	}
	scheme := "http"
	if s.Secure {
		scheme = "https"
	}
	return fmt.Sprintf("%s://%s%s", scheme, s.Endpoint, path)
}

// Status 客户端运行状态，供管理端展示
type Status struct {
	Ready    bool
	Source   string // database | default
	Error    string
	Warnings []string
}

func (h *ClientHolder) Status() Status {
	h.mu.Lock()
	defer h.mu.Unlock()
	s := Status{Source: "default"}
	if h.fromDB {
		s.Source = "database"
	}
	if h.client != nil {
		s.Ready = true
	}
	if h.lastErr != nil {
		s.Error = h.lastErr.Error()
	}
	s.Warnings = h.lastWarns
	return s
}

// Invalidate 丢弃当前客户端与配置快照，下次使用时重新加载并构建（保存/重置配置后调用）
func (h *ClientHolder) Invalidate() {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.client = nil
	h.setting = nil
	h.fromDB = false
	h.checkedAt = time.Time{}
	h.lastErr = nil
	h.lastWarns = nil
}

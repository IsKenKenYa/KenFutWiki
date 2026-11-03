package domain

import (
	"context"
	"strings"
	"time"

	"github.com/chaitin/panda-wiki/consts"
)

// table: settings
type SystemSetting struct {
	ID          int                     `json:"id" gorm:"primary_key"`
	Key         consts.SystemSettingKey `json:"key"`
	Value       []byte                  `json:"value" gorm:"type:jsonb"` // JSON string
	Description string                  `json:"description"`
	CreatedAt   time.Time               `json:"created_at"`
	UpdatedAt   time.Time               `json:"updated_at"`
}

func (SystemSetting) TableName() string {
	return "system_settings"
}

// ModelModeSetting 模型配置结构体
type ModelModeSetting struct {
	Mode                     consts.ModelSettingMode `json:"mode"`                        // 模式: manual 或 auto
	AutoModeAPIKey           string                  `json:"auto_mode_api_key"`           // 百智云 API Key
	AutoModeProvider         ModelProvider           `json:"auto_mode_provider"`          // 自动模式供应商
	ChatModel                string                  `json:"chat_model"`                  // 自定义对话模型名称
	IsManualEmbeddingUpdated bool                    `json:"is_manual_embedding_updated"` // 手动模式下嵌入模型是否更新
}

// UploadDeniedExtensionsSetting 上传禁止扩展名配置
// INSERT INTO "public"."system_settings" ("key", "value") VALUES ('upload', '{"denied_extensions": ["jsp"]}')
type UploadDeniedExtensionsSetting struct {
	DeniedExtensions []string `json:"denied_extensions"` // 禁止上传的文件扩展名列表，不带点，如 ["jsp", "php", "exe"]
}

// StorageSetting 全局对象存储配置，存储在 system_settings 表（key=storage）。
// 未保存过时回退到 config.S3（环境变量/config.yml）推导的默认值（内置 MinIO）。
// Provider 仅用于前端预设展示，后端统一按 S3 兼容协议访问。
type StorageSetting struct {
	Provider   string `json:"provider"` // minio | aliyun_oss | custom
	Endpoint   string `json:"endpoint"` // host[:port]，不带协议
	AccessKey  string `json:"access_key"`
	SecretKey  string `json:"secret_key"`
	Bucket     string `json:"bucket"`      // 默认 static-file
	Region     string `json:"region"`      // 默认 us-east-1；OSS 如 oss-cn-hangzhou
	Secure     bool   `json:"secure"`      // 是否走 HTTPS
	PublicURL  string `json:"public_url"`  // 公网读取基址（如 OSS 桶域名）；为空时用相对路径 /static-file/
	AutoBucket bool   `json:"auto_bucket"` // 桶不存在时自动创建并尝试设置公读策略
}

const (
	StorageProviderMinio    = "minio"
	StorageProviderAliyunOS = "aliyun_oss"
	StorageProviderCustom   = "custom"
)

const (
	DefaultBucket = "static-file"
	DefaultRegion = "us-east-1"
)

// Normalize 补全缺省字段，保证构造客户端时字段完备
func (s *StorageSetting) Normalize() {
	switch s.Provider {
	case StorageProviderMinio, StorageProviderAliyunOS, StorageProviderCustom:
	default:
		s.Provider = StorageProviderCustom
	}
	s.Endpoint = strings.TrimSpace(s.Endpoint)
	s.Bucket = strings.TrimSpace(s.Bucket)
	if s.Bucket == "" {
		s.Bucket = DefaultBucket
	}
	s.Region = strings.TrimSpace(s.Region)
	if s.Region == "" {
		s.Region = DefaultRegion
	}
	s.PublicURL = strings.TrimRight(strings.TrimSpace(s.PublicURL), "/")
}

// StorageSettingSource 提供当前生效的全局存储配置（未配置时由实现方回退默认值）
type StorageSettingSource interface {
	GetStorageSetting(ctx context.Context) (*StorageSetting, error)
}

// maskedSecret 对外展示 secret 时使用的掩码，提交时原样返回表示"不修改"
const MaskedSecret = "******"

// StorageSettingDetail GET /storage/setting 响应：生效配置（secret 掩码）+ 运行状态
type StorageSettingDetail struct {
	Setting   *StorageSetting `json:"setting"`
	Source    string          `json:"source"`   // database | default
	Ready     bool            `json:"ready"`    // 客户端是否构建成功
	Error     string          `json:"error"`    // 最近一次构建失败的错误
	Warnings  []string        `json:"warnings"` // 最近一次构建的警告（如公读策略设置失败）
	SecretSet bool            `json:"secret_set"`
}

// StorageTestResult POST /storage/test 响应：分步探测结果
type StorageTestResult struct {
	OK       bool              `json:"ok"`
	Steps    []StorageTestStep `json:"steps"`
	Warnings []string          `json:"warnings"`
}

type StorageTestStep struct {
	Name    string `json:"name"`
	OK      bool   `json:"ok"`
	Message string `json:"message"`
}

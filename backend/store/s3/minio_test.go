package s3

import (
	"context"
	"errors"
	"testing"
	"time"

	"gorm.io/gorm"

	"github.com/chaitin/panda-wiki/config"
	"github.com/chaitin/panda-wiki/domain"
	"github.com/chaitin/panda-wiki/log"
)

// fakeSource 可控的存储配置来源，模拟数据库中的 system_settings.storage
type fakeSource struct {
	setting *domain.StorageSetting
	err     error
}

func (f *fakeSource) GetStorageSetting(ctx context.Context) (*domain.StorageSetting, error) {
	if f.err != nil {
		return nil, f.err
	}
	if f.setting == nil {
		return nil, gorm.ErrRecordNotFound
	}
	s := *f.setting
	return &s, nil
}

func newTestConfig() *config.Config {
	return &config.Config{
		S3: config.S3Config{
			Endpoint:  "minio.internal:9000",
			AccessKey: "ak",
			SecretKey: "sk",
			Bucket:    "static-file",
			Region:    "us-east-1",
		},
	}
}

func newTestLogger() *log.Logger {
	return log.NewLogger(&config.Config{Log: config.LogConfig{Level: 8}})
}

func unreachableSetting(endpoint, bucket string) *domain.StorageSetting {
	return &domain.StorageSetting{
		Provider:   domain.StorageProviderCustom,
		Endpoint:   endpoint,
		AccessKey:  "ak",
		SecretKey:  "sk",
		Bucket:     bucket,
		Region:     "us-east-1",
		AutoBucket: false,
	}
}

// TestNoNetworkAtConstruction 构造 holder 不做网络访问，URL 方法回退环境变量默认值
func TestNoNetworkAtConstruction(t *testing.T) {
	h := NewClientHolder(newTestConfig(), nil, newTestLogger())
	if got := h.Bucket(); got != "static-file" {
		t.Fatalf("bucket = %q, want static-file", got)
	}
	if got := h.PublicURL("a/b.txt"); got != "/static-file/a/b.txt" {
		t.Fatalf("PublicURL = %q, want /static-file/a/b.txt", got)
	}
	if got := h.InternalURL("a/b.txt"); got != "http://minio.internal:9000/static-file/a/b.txt" {
		t.Fatalf("InternalURL = %q", got)
	}
	if st := h.Status(); st.Ready || st.Source != "default" {
		t.Fatalf("status = %+v, want not ready / default source", st)
	}
}

// TestDBSettingWinsAndHotReload 数据库配置优先生效；来源变化后无需重启即可感知
func TestDBSettingWinsAndHotReload(t *testing.T) {
	oldRefresh, oldRetry := settingRefreshInterval, buildRetryInterval
	settingRefreshInterval, buildRetryInterval = 10*time.Millisecond, 10*time.Millisecond
	defer func() { settingRefreshInterval, buildRetryInterval = oldRefresh, oldRetry }()

	src := &fakeSource{setting: unreachableSetting("127.0.0.1:1", "bucket-a")}
	h := NewClientHolder(newTestConfig(), src, newTestLogger())
	ctx := context.Background()

	if _, _, err := h.current(ctx); err == nil {
		t.Fatal("expected build error for unreachable endpoint")
	}
	if got := h.PublicURL("k"); got != "/bucket-a/k" {
		t.Fatalf("PublicURL = %q, want /bucket-a/k", got)
	}

	// 模拟另一进程（如 api）保存了新配置
	src.setting = unreachableSetting("127.0.0.1:2", "bucket-b")
	time.Sleep(20 * time.Millisecond)
	if _, _, err := h.current(ctx); err == nil {
		t.Fatal("expected build error for new unreachable endpoint")
	}
	if got := h.PublicURL("k"); got != "/bucket-b/k" {
		t.Fatalf("PublicURL = %q, want /bucket-b/k after hot reload", got)
	}
	if st := h.Status(); st.Source != "database" || st.Ready {
		t.Fatalf("status = %+v, want database source and not ready", st)
	}
}

// TestFallbackToEnvOnDBError 数据库读取出错（非未配置）时回退环境变量默认值，不影响使用
func TestFallbackToEnvOnDBError(t *testing.T) {
	oldRefresh, oldRetry := settingRefreshInterval, buildRetryInterval
	settingRefreshInterval, buildRetryInterval = 10*time.Millisecond, 10*time.Millisecond
	defer func() { settingRefreshInterval, buildRetryInterval = oldRefresh, oldRetry }()

	src := &fakeSource{err: errors.New("db offline")}
	h := NewClientHolder(newTestConfig(), src, newTestLogger())
	ctx := context.Background()

	if _, _, err := h.current(ctx); err == nil {
		t.Fatal("expected build error for unreachable default endpoint")
	}
	if got := h.InternalURL("k"); got != "http://minio.internal:9000/static-file/k" {
		t.Fatalf("InternalURL = %q, want env default", got)
	}
	if st := h.Status(); st.Source != "default" {
		t.Fatalf("source = %q, want default", st.Source)
	}
}

// TestAbsURL AbsURL 把 /{bucket}/{key} 相对路径转为绝对 URL，已是绝对地址时原样返回
func TestAbsURL(t *testing.T) {
	h := NewClientHolder(newTestConfig(), nil, newTestLogger())
	cases := []struct{ in, want string }{
		{"/static-file/a/b.png", "http://minio.internal:9000/static-file/a/b.png"},
		{"https://cdn.example.com/x.png", "https://cdn.example.com/x.png"},
		{"data:image/png;base64,xxx", "data:image/png;base64,xxx"},
		{"", ""},
	}
	for _, c := range cases {
		if got := h.AbsURL(c.in); got != c.want {
			t.Fatalf("AbsURL(%q) = %q, want %q", c.in, got, c.want)
		}
	}
}

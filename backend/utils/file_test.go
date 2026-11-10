package utils

import "testing"

// 上传内容嗅探必须拒绝伪装成图片后缀的 HTML 文本（存储型 XSS，上游 #1845）
func TestSniffImageContentTypeRejectsHTMLDisguisedAsJPG(t *testing.T) {
	payload := []byte(`<!DOCTYPE html><html><body><script>alert(1)</script></body></html>`)
	if got := SniffImageContentType(payload); got != "" {
		t.Fatalf("expected HTML content to be rejected, got %q", got)
	}
}

func TestSniffImageContentTypeRejectsText(t *testing.T) {
	payload := []byte("hello, this is plain text, not an image at all")
	if got := SniffImageContentType(payload); got != "" {
		t.Fatalf("expected plain text to be rejected, got %q", got)
	}
}

func TestSniffImageContentTypeAcceptsRealImages(t *testing.T) {
	cases := map[string][]byte{
		"image/jpeg": {0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46},
		"image/png":  {0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00},
		"image/webp": {'R', 'I', 'F', 'F', 0x00, 0x00, 0x00, 0x00, 'W', 'E', 'B', 'P'},
	}
	for want, head := range cases {
		if got := SniffImageContentType(head); got != want {
			t.Fatalf("expected %q, got %q", want, got)
		}
	}
}

func TestIsSupportedImageExt(t *testing.T) {
	if !IsSupportedImageExt(".JPG") || !IsSupportedImageExt(".webp") {
		t.Fatal("expected supported image extensions to pass")
	}
	if IsSupportedImageExt(".html") || IsSupportedImageExt(".pdf") {
		t.Fatal("expected non-image extensions to be rejected")
	}
}

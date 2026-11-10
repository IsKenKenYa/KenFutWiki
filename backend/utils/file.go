package utils

import (
	"mime"
	"net/http"
	"path/filepath"
	"slices"
	"strings"
)

var supportedImageExts = []string{
	".jpg", ".jpeg", ".png", ".webp",
}

func IsImageFile(filename string) bool {
	ext := strings.ToLower(filepath.Ext(filename))
	return slices.Contains(supportedImageExts, ext)
}

// IsSupportedImageExt 判断扩展名是否属于受支持的图片格式
func IsSupportedImageExt(ext string) bool {
	return slices.Contains(supportedImageExts, strings.ToLower(ext))
}

// SniffImageContentType 依据文件头部字节判定真实内容是否为受支持的图片格式，
// 返回对应的 MIME 类型；伪装成图片后缀的 HTML 等文本内容返回空串
func SniffImageContentType(head []byte) string {
	// http.DetectContentType 未覆盖 WEBP 签名，单独识别 RIFF 容器
	if len(head) >= 12 && string(head[0:4]) == "RIFF" && string(head[8:12]) == "WEBP" {
		return "image/webp"
	}
	detected := http.DetectContentType(head)
	mediaType, _, err := mime.ParseMediaType(detected)
	if err != nil {
		return ""
	}
	switch mediaType {
	case "image/png", "image/jpeg", "image/webp":
		return mediaType
	default:
		return ""
	}
}

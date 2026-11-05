package domain

type TextReq struct {
	Text   string `json:"text" validate:"required"`
	Action string `json:"action"` // action: improve, summary, extend, shorten, translate 等
	// TargetLang translate 动作的目标语言（BCP-47 小写主码，支持 zh/en）
	TargetLang string `json:"target_lang"`
}

// FIM (Fill in Middle) tokens
const (
	FIMPrefix = "<fim_prefix>"
	FIMSuffix = "<fim_suffix>"
	FIMMiddle = "<fim_middle>"
)

type CompleteReq struct {
	// For FIM (Fill in Middle) style completion
	Prefix string `json:"prefix,omitempty"`
	Suffix string `json:"suffix,omitempty"`
}

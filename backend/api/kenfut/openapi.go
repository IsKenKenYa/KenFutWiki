package kenfut

import _ "embed"

// OpenAPI documents the versioned public and product integration contract.
//
//go:embed openapi.json
var OpenAPI []byte

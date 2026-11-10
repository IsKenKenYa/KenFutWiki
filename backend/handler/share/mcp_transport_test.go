package share

import (
	"context"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/mark3labs/mcp-go/client"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

func TestMCPStreamableHTTPWithEcho(t *testing.T) {
	mcpServer := server.NewMCPServer("test", "1.0.0", server.WithToolCapabilities(false))
	mcpServer.AddTool(mcp.NewTool("echo",
		mcp.WithString("text", mcp.Required()),
	), func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		text, err := request.RequireString("text")
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}
		return mcp.NewToolResultText(text), nil
	})

	streamable := server.NewStreamableHTTPServer(mcpServer, server.WithStateLess(true))
	e := echo.New()
	e.Any("/mcp", echo.WrapHandler(streamable))
	testServer := httptest.NewServer(e)
	defer testServer.Close()

	mcpClient, err := client.NewStreamableHttpClient(testServer.URL + "/mcp")
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := mcpClient.Start(ctx); err != nil {
		t.Fatal(err)
	}
	defer mcpClient.Close()

	if _, err := mcpClient.Initialize(ctx, mcp.InitializeRequest{
		Params: mcp.InitializeParams{
			ProtocolVersion: mcp.LATEST_PROTOCOL_VERSION,
			ClientInfo:      mcp.Implementation{Name: "test-client", Version: "1.0.0"},
		},
	}); err != nil {
		t.Fatal(err)
	}

	tools, err := mcpClient.ListTools(ctx, mcp.ListToolsRequest{})
	if err != nil {
		t.Fatal(err)
	}
	if len(tools.Tools) != 1 || tools.Tools[0].Name != "echo" {
		t.Fatalf("unexpected tools: %#v", tools.Tools)
	}

	result, err := mcpClient.CallTool(ctx, mcp.CallToolRequest{
		Params: mcp.CallToolParams{
			Name:      "echo",
			Arguments: map[string]any{"text": "hello"},
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	if got := mcpResultText(result); got != "hello" {
		t.Fatalf("tool result = %q, want hello", got)
	}
}

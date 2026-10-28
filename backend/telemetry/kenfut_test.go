package telemetry

import (
	"testing"

	"github.com/chaitin/panda-wiki/config"
	"github.com/chaitin/panda-wiki/log"
	"github.com/spf13/viper"
)

func TestKenFutDefaultTelemetryNeedsNoExternalServicesOrMachineFile(t *testing.T) {
	viper.Set("telemetry.enabled", false)
	t.Cleanup(viper.Reset)
	cfg := &config.Config{}
	client, err := NewClient(log.NewLogger(cfg), nil, nil, nil, nil, nil, nil, cfg)
	if err != nil {
		t.Fatal(err)
	}
	if client.GetMachineID() != "" {
		t.Fatal("disabled telemetry created a machine identity")
	}
}

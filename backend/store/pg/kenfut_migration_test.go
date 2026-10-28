package pg

import (
	"database/sql"
	"net/url"
	"os"
	"strings"
	"testing"

	"github.com/google/uuid"
)

func TestKenFutMigrationsFreshInstallAndRepeat(t *testing.T) {
	dsn := os.Getenv("KENFUT_TEST_DSN")
	if dsn == "" {
		t.Skip("KENFUT_TEST_DSN is required for isolated PostgreSQL migration tests")
	}
	base, err := sql.Open("postgres", dsn)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = base.Close() })
	name := "kenfut_migration_" + strings.ReplaceAll(uuid.NewString(), "-", "")
	if _, err := base.Exec("CREATE DATABASE " + name); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _, _ = base.Exec("DROP DATABASE " + name + " WITH (FORCE)") })
	testDSN := dsn + " dbname=" + name
	if strings.Contains(dsn, "://") {
		parsed, e := url.Parse(dsn)
		if e != nil {
			t.Fatal(e)
		}
		parsed.Path = "/" + name
		testDSN = parsed.String()
	}
	if err := doMigrate(testDSN); err != nil {
		t.Fatalf("fresh install: %v", err)
	}
	if err := doMigrate(testDSN); err != nil {
		t.Fatalf("repeat startup: %v", err)
	}
	db, err := sql.Open("postgres", testDSN)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	var upstream, extension int
	if err := db.QueryRow("SELECT version FROM schema_migrations").Scan(&upstream); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRow("SELECT version FROM kenfut_schema_migrations").Scan(&extension); err != nil {
		t.Fatal(err)
	}
	if upstream != 38 || extension < 2 {
		t.Fatalf("migration histories mixed: upstream=%d extension=%d", upstream, extension)
	}
	var count int
	if err := db.QueryRow("SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('kenfut_products','kenfut_content_metadata','kenfut_events')").Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count != 3 {
		t.Fatalf("expected extension tables, got %d", count)
	}
}

package pg

import (
	"database/sql"
	"fmt"
	"io/fs"
	"net/url"
	"os"
	"strconv"
	"strings"
	"testing"
	"testing/fstest"

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
	// Start from the previous fork schema, then upgrade through the production runner.
	previous := testMigrationFiles(t, true, 0)
	if err := runMigrations(testDSN, "migration", "schema_migrations", previous); err != nil {
		t.Fatal(err)
	}
	if err := runMigrations(testDSN, "kenfut_migration", "kenfut_schema_migrations", previous); err != nil {
		t.Fatal(err)
	}
	if err := doMigrate(testDSN); err != nil {
		t.Fatalf("existing fork upgrade: %v", err)
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
	if upstream != latestKenFutTestMigration(t, "migration") || extension != latestKenFutTestMigration(t, "kenfut_migration") {
		t.Fatalf("migration histories mixed: upstream=%d extension=%d", upstream, extension)
	}
	var count int
	if err := db.QueryRow("SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('kenfut_products','kenfut_content_metadata','kenfut_events')").Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count != 3 {
		t.Fatalf("expected extension tables, got %d", count)
	}
	// A simulated upstream addition must advance only its own history.
	next := latestKenFutTestMigration(t, "migration") + 1
	future := testMigrationFiles(t, false, next)
	if err := runMigrations(testDSN, "migration", "schema_migrations", future); err != nil {
		t.Fatal(err)
	}
	if err := runMigrations(testDSN, "kenfut_migration", "kenfut_schema_migrations", future); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRow("SELECT version FROM schema_migrations").Scan(&upstream); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRow("SELECT version FROM kenfut_schema_migrations").Scan(&extension); err != nil {
		t.Fatal(err)
	}
	if upstream != next || extension != latestKenFutTestMigration(t, "kenfut_migration") {
		t.Fatalf("upstream update contaminated fork history: %d/%d", upstream, extension)
	}

}

func latestKenFutTestMigration(t *testing.T, directory string) int {
	t.Helper()
	files, err := migrationFiles.ReadDir(directory)
	if err != nil {
		t.Fatal(err)
	}
	latest := 0
	for _, file := range files {
		if !strings.HasSuffix(file.Name(), ".up.sql") {
			continue
		}
		number, err := strconv.Atoi(strings.SplitN(file.Name(), "_", 2)[0])
		if err != nil {
			t.Fatal(err)
		}
		if number > latest {
			latest = number
		}
	}
	return latest
}

func testMigrationFiles(t *testing.T, previous bool, next int) fs.FS {
	t.Helper()
	files := fstest.MapFS{}
	err := fs.WalkDir(migrationFiles, ".", func(name string, entry fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if entry.IsDir() {
			return nil
		}
		if previous && strings.HasPrefix(name, "kenfut_migration/000003_") {
			return nil
		}
		data, err := migrationFiles.ReadFile(name)
		if err != nil {
			return err
		}
		files[name] = &fstest.MapFile{Data: data}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
	if next > 0 {
		files[fmt.Sprintf("migration/%06d_upstream_probe.up.sql", next)] = &fstest.MapFile{Data: []byte("CREATE TABLE upstream_upgrade_probe(id integer PRIMARY KEY);")}
		files[fmt.Sprintf("migration/%06d_upstream_probe.down.sql", next)] = &fstest.MapFile{Data: []byte("DROP TABLE upstream_upgrade_probe;")}
	}
	return files
}

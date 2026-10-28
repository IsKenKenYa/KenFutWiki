package pg

import (
	"database/sql"
	"embed"
	"errors"
	"fmt"
	"io/fs"
	"log"
	"os"
	"time"

	"github.com/golang-migrate/migrate/v4"
	migratePG "github.com/golang-migrate/migrate/v4/database/postgres"
	"github.com/golang-migrate/migrate/v4/source/iofs"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"github.com/chaitin/panda-wiki/config"
)

type DB struct {
	*gorm.DB
}

func NewDB(config *config.Config) (*DB, error) {
	dsn := config.PG.DSN
	// same as gorm logger.Default, but without colorful output and ignore record not found error
	newLogger := logger.New(log.New(os.Stdout, "\r\n", log.LstdFlags), logger.Config{
		SlowThreshold:             200 * time.Millisecond,
		LogLevel:                  logger.Warn,
		IgnoreRecordNotFoundError: true,
		Colorful:                  false,
	})
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		TranslateError: true,
		Logger:         newLogger,
	})
	if err != nil {
		return nil, err
	}
	// create raglite database if not exists
	var exists bool
	if err := db.Raw("SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname = 'raglite')").Scan(&exists).Error; err != nil {
		return nil, err
	}
	if !exists {
		if err := db.Exec("CREATE DATABASE raglite").Error; err != nil {
			return nil, err
		}
	}
	if err := doMigrate(dsn); err != nil {
		return nil, err
	}

	return &DB{DB: db}, nil
}

//go:embed migration/*.sql kenfut_migration/*.sql
var migrationFiles embed.FS

func doMigrate(dsn string) error {
	for _, migration := range []struct{ directory, table string }{
		{"migration", "schema_migrations"},
		{"kenfut_migration", "kenfut_schema_migrations"},
	} {
		if err := runMigrations(dsn, migration.directory, migration.table, migrationFiles); err != nil {
			return err
		}
	}
	return nil
}

func runMigrations(dsn, directory, table string, files fs.FS) error {
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		return fmt.Errorf("open migration database: %w", err)
	}
	source, err := iofs.New(files, directory)
	if err != nil {
		_ = db.Close()
		return fmt.Errorf("open %s migrations: %w", directory, err)
	}
	driver, err := migratePG.WithInstance(db, &migratePG.Config{MigrationsTable: table})
	if err != nil {
		_ = db.Close()
		return fmt.Errorf("initialize %s migrations: %w", directory, err)
	}
	m, err := migrate.NewWithInstance("iofs", source, "postgres", driver)
	if err != nil {
		_ = db.Close()
		return fmt.Errorf("initialize migration source: %w", err)
	}
	defer m.Close()
	if err := m.Up(); err != nil && !errors.Is(err, migrate.ErrNoChange) {
		return fmt.Errorf("migrate %s: %w", directory, err)
	}
	return nil
}

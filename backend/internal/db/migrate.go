package db

import (
	"fmt"

	"github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	"github.com/jackc/pgx/v5/stdlib"
)

func (db *DB) Migrate(migrationsPath string) error {
	driver, err := postgres.WithInstance(stdlib.OpenDBFromPool(db.pool), &postgres.Config{})
	if err != nil {
		return fmt.Errorf("create migration driver: %w", err)
	}

	m, err := migrate.NewWithDatabaseInstance(
		"file://"+migrationsPath,
		"postgres",
		driver,
	)
	if err != nil {
		return fmt.Errorf("create migrator: %w", err)
	}

	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		return fmt.Errorf("run migrations: %w", err)
	}

	return nil
}

func (db *DB) MigrateStatus() (version int, dirty bool, err error) {
	driver, err := postgres.WithInstance(stdlib.OpenDBFromPool(db.pool), &postgres.Config{})
	if err != nil {
		return 0, false, fmt.Errorf("create migration driver: %w", err)
	}

	version, dirty, err = driver.Version()
	if err != nil {
		return 0, false, fmt.Errorf("get migration version: %w", err)
	}

	return version, dirty, nil
}

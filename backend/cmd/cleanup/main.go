package main

import (
	"log"
	"os"
	"strconv"
	"time"

	"ots-backend/internal/cleanup"
	"ots-backend/internal/config"
	"ots-backend/internal/db"
)

func main() {
	cfg := config.Load()

	database, err := db.New(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer database.Close()

	intervalStr := os.Getenv("CLEANUP_INTERVAL")
	interval := 300 // 5 minutes default
	if intervalStr != "" {
		if i, err := strconv.Atoi(intervalStr); err == nil && i > 0 {
			interval = i
		}
	}

	log.Printf("Starting cleanup worker with interval %d seconds", interval)

	worker := cleanup.NewWorker(database, time.Duration(interval)*time.Second)
	worker.Start()
}

package cleanup

import (
	"context"
	"log"
	"time"

	"ots-backend/internal/db"
)

// Worker periodically cleans up expired secrets
type Worker struct {
	db       *db.DB
	interval time.Duration
	stop     chan struct{}
}

// NewWorker creates a new cleanup worker
func NewWorker(database *db.DB, interval time.Duration) *Worker {
	return &Worker{
		db:       database,
		interval: interval,
		stop:     make(chan struct{}),
	}
}

// Start begins the cleanup loop
func (w *Worker) Start() {
	// Run immediate cleanup
	w.cleanup()

	ticker := time.NewTicker(w.interval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			w.cleanup()
		case <-w.stop:
			log.Println("Cleanup worker stopped")
			return
		}
	}
}

// Stop stops the cleanup worker
func (w *Worker) Stop() {
	close(w.stop)
}

func (w *Worker) cleanup() {
	ctx := context.Background()

	result, err := w.db.Pool().Exec(ctx, `
		DELETE FROM secrets 
		WHERE expires_at < NOW()
	`)

	if err != nil {
		log.Printf("Failed to cleanup expired secrets: %v", err)
		return
	}

	rows := result.RowsAffected()
	if rows > 0 {
		log.Printf("Cleaned up %d expired secrets", rows)
	}
}

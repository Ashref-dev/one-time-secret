package api

import (
	"runtime"
	"syscall"
)

// checkDiskSpace checks the filesystem disk usage.
// Returns "healthy", "degraded", or "unhealthy" based on available space percentage.
func (h *Handler) checkDiskSpace() string {
	// Get filesystem statistics for the root directory
	var stat syscall.Statfs_t
	err := syscall.Statfs("/", &stat)
	if err != nil {
		// Unable to determine disk status
		return "unhealthy"
	}

	// Calculate total and available space in bytes
	total := stat.Blocks * uint64(stat.Bsize)
	available := stat.Bavail * uint64(stat.Bsize)

	// Calculate used space and usage percentage
	used := total - available
	usagePercent := float64(used) / float64(total) * 100

	// Evaluate health status based on usage threshold
	if usagePercent > 95 {
		// Critical: disk is almost full
		return "unhealthy"
	}

	if usagePercent > 80 {
		// Warning: disk usage is high
		return "degraded"
	}

	// Normal operation: plenty of disk space available
	return "healthy"
}

// checkMemory checks the application memory allocation.
// Returns "healthy", "degraded", or "unhealthy" based on memory usage percentage.
func (h *Handler) checkMemory() string {
	// Read current memory statistics from the Go runtime
	var m runtime.MemStats
	runtime.ReadMemStats(&m)

	// Convert memory stats to float for percentage calculation
	alloc := float64(m.Alloc) // Bytes allocated to heap objects
	sys := float64(m.Sys)     // Bytes obtained from OS

	// Calculate memory usage percentage
	memPercent := (alloc / sys) * 100

	// Evaluate health status based on allocation threshold
	if memPercent > 95 {
		// Critical: nearly all allocated memory in use
		return "unhealthy"
	}

	if memPercent > 80 {
		// Warning: significant memory allocation
		return "degraded"
	}

	// Normal operation: healthy memory usage
	return "healthy"
}

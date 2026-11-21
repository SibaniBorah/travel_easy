// Package db provides database schema initialization logic.
// Since no network is available for external SQLite drivers,
// we use a JSON-file-based storage backend.
package db

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

// Schema defines the data directory layout.
// Each collection lives in its own JSON file.
var collectionFiles = []string{
	"states.json",
	"destinations.json",
	"route_legs.json",
	"permit_rules.json",
	"events.json",
	"budget_estimates.json",
	"itineraries.json",
	"itinerary_days.json",
	"trip_debriefs.json",
	"reports.json",
	"sources.json",
	"community_tips.json",
	"saved_trips.json",
}

// InitSchema ensures all JSON collection files exist in dataDir.
func InitSchema(dataDir string) error {
	if err := os.MkdirAll(dataDir, 0o755); err != nil {
		return fmt.Errorf("create data dir: %w", err)
	}
	for _, f := range collectionFiles {
		path := filepath.Join(dataDir, f)
		if _, err := os.Stat(path); os.IsNotExist(err) {
			// Initialize with empty JSON array.
			if err := os.WriteFile(path, []byte("[]"), 0o644); err != nil {
				return fmt.Errorf("init %s: %w", f, err)
			}
		}
	}
	return nil
}

// readJSON reads a JSON array file and unmarshals into v.
func readJSON(path string, v interface{}) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	return json.Unmarshal(data, v)
}

// writeJSON marshals v and atomically writes it to path.
func writeJSON(path string, v interface{}) error {
	data, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return err
	}
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, data, 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, path)
}

package handler

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"chaloner/internal/api"
	"chaloner/internal/content"
	"chaloner/internal/db"
)

var (
	router http.Handler
	once   sync.Once
)

func initRouter() {
	// In Vercel serverless / AWS Lambda environment, /tmp is writable
	dataDir := "/tmp/data"
	_ = os.MkdirAll(dataDir, 0755)

	// Copy existing JSON data files if available
	srcDataDirs := []string{"./data", "../data"}
	for _, srcDir := range srcDataDirs {
		if entries, err := os.ReadDir(srcDir); err == nil {
			for _, e := range entries {
				if !e.IsDir() {
					srcFile := filepath.Join(srcDir, e.Name())
					dstFile := filepath.Join(dataDir, e.Name())
					if data, err := os.ReadFile(srcFile); err == nil {
						_ = os.WriteFile(dstFile, data, 0644)
					}
				}
			}
			break
		}
	}

	_ = db.InitSchema(dataDir)
	store := db.NewStore(dataDir)
	_ = content.SeedIfEmpty(store)

	staticDir := "./public"
	if _, err := os.Stat(staticDir); os.IsNotExist(err) {
		staticDir = "./static"
	}

	router = api.NewRouter(store, os.Getenv("ADMIN_TOKEN"), staticDir)
}

func Handler(w http.ResponseWriter, r *http.Request) {
	once.Do(initRouter)

	// Preserve sub-path when rewritten on Vercel
	if p := r.URL.Query().Get("__path"); p != "" {
		r.URL.Path = "/api/" + strings.TrimPrefix(p, "/")
	} else if matched := r.Header.Get("x-matched-path"); matched != "" {
		r.URL.Path = matched
	}

	router.ServeHTTP(w, r)
}

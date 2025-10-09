package main

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"

	"github.com/gorilla/mux"
	"github.com/rs/cors"
)

func main() {
	r := mux.NewRouter()

	// API routes
	r.HandleFunc("/api/process-csv", processCSVHandler).Methods("POST")
	r.HandleFunc("/api/health", healthHandler).Methods("GET")

	// Serve React app
	r.PathPrefix("/").Handler(http.FileServer(http.Dir("../frontend/dist/")))

	c := cors.New(cors.Options{
		AllowedOrigins:   []string{"http://localhost:3000"},
		AllowedMethods:   []string{"GET", "POST", "OPTIONS"},
		AllowedHeaders:   []string{"*"},
	})

	handler := c.Handler(r)
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	fmt.Printf("Server running on port %s\n", port)
	http.ListenAndServe(":"+port, handler)
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func processCSVHandler(w http.ResponseWriter, r *http.Request) {
	file, _, err := r.FormFile("csv_file")
	if err != nil {
		http.Error(w, "No file uploaded", http.StatusBadRequest)
		return
	}
	defer file.Close()

	day := r.FormValue("day")
	
	reader := csv.NewReader(file)
	records, err := reader.ReadAll()
	if err != nil {
		http.Error(w, "Error reading CSV", http.StatusInternalServerError)
		return
	}

	// Basic processing - return first 5 rows as example
	var result []map[string]string
	headers := records[0]
	
	for i := 1; i < len(records) && i <= 5; i++ {
		row := make(map[string]string)
		for j, header := range headers {
			if j < len(records[i]) {
				row[header] = records[i][j]
			}
		}
		result = append(result, row)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"day":     day,
		"data":    result,
		"total":   len(records) - 1,
	})
}
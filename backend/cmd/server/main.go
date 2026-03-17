package main

import (
	"fmt"
	"net/http"
	"os"

	httpapi "cob-aquatics/internal/http"
	"github.com/rs/cors"
)

func main() {
	r := httpapi.NewRouter()

	r.PathPrefix("/").Handler(http.FileServer(http.Dir("../frontend/dist/")))

	c := cors.New(cors.Options{
		AllowedOrigins:   []string{"http://localhost:3000"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"*"},
		AllowCredentials: true,
	})

	handler := c.Handler(r)
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	fmt.Printf("Server running on port %s\n", port)
	http.ListenAndServe(":"+port, handler)
}

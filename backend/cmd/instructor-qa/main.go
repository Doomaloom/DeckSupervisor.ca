// Test-only local server. Credentials and provider URL cannot target a hosted project.
package main

import (
	httpapi "cob-aquatics/internal/http"
	"log"
	"net/http"
	"os"
)

func main() {
	os.Setenv("SUPABASE_URL", "http://127.0.0.1:18081")
	os.Setenv("SUPABASE_ANON_KEY", "instructor-qa-anon")
	log.Fatal(http.ListenAndServe("127.0.0.1:18080", httpapi.NewRouter()))
}

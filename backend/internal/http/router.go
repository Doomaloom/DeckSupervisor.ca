package httpapi

import (
	"net/http"

	"cob-aquatics/internal/http/handlers"
	"github.com/gorilla/mux"
)

func NewRouter() *mux.Router {
	r := mux.NewRouter()
	r.HandleFunc("/api/process-csv", handlers.ProcessCSV).Methods("POST")
	r.HandleFunc("/api/extract-classes", handlers.ExtractClasses).Methods("POST")
	r.HandleFunc("/api/masterlist", handlers.Masterlist).Methods("POST")
	r.HandleFunc("/api/masterlist-rosters", handlers.MasterlistRosters).Methods("POST")
	r.HandleFunc("/api/attendance-pdf", handlers.AttendancePDF).Methods("POST")
	r.HandleFunc("/api/concat-pdfs", handlers.ConcatPDF).Methods("POST")
	r.HandleFunc("/api/blank-pdf", handlers.BlankPDF).Methods("POST")
	r.HandleFunc("/api/schematic-maker", handlers.SchematicMaker).Methods("POST")
	r.HandleFunc("/api/schematic-pdf", handlers.SchematicPDF).Methods("POST")
	r.HandleFunc("/api/session-report-pdf", handlers.SessionReportPDF).Methods("POST")
	r.HandleFunc("/api/custom-rosters", handlers.SaveCustomRoster).Methods("POST")
	r.HandleFunc("/api/custom-rosters/resolve", handlers.ResolveCustomRosters).Methods("POST")
	r.HandleFunc("/api/custom-rosters/{id}", handlers.DeleteCustomRoster).Methods("DELETE")
	r.HandleFunc("/api/health", handlers.Health).Methods("GET")
	r.NotFoundHandler = http.NotFoundHandler()
	return r
}

package main

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
)

type concatPDFRequest struct {
	PDFs     []string `json:"pdfs"`
	Filename string   `json:"filename"`
}

func concatPDFHandler(w http.ResponseWriter, r *http.Request) {
	contentType := r.Header.Get("Content-Type")
	var (
		pdfs     [][]byte
		filename string
		err      error
	)

	if strings.HasPrefix(contentType, "multipart/form-data") {
		pdfs, filename, err = readMultipartPDFs(r)
	} else {
		pdfs, filename, err = readJSONPDFs(r)
	}
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	var output []byte
	if len(pdfs) == 1 {
		output = pdfs[0]
	} else {
		output, err = mergePDFs(pdfs)
		if err != nil {
			http.Error(w, fmt.Sprintf("Unable to merge PDFs: %v", err), http.StatusInternalServerError)
			return
		}
	}

	outputName := buildConcatFilename(filename)
	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", outputName))
	w.Write(output)
}

func readMultipartPDFs(r *http.Request) ([][]byte, string, error) {
	if err := r.ParseMultipartForm(64 << 20); err != nil {
		return nil, "", errors.New("unable to parse multipart form")
	}

	if r.MultipartForm == nil {
		return nil, "", errors.New("missing multipart form data")
	}

	files := r.MultipartForm.File["pdfs"]
	if len(files) == 0 {
		return nil, "", errors.New("missing pdfs")
	}

	pdfs := make([][]byte, 0, len(files))
	for _, fileHeader := range files {
		file, err := fileHeader.Open()
		if err != nil {
			return nil, "", errors.New("unable to open pdf")
		}
		data, err := io.ReadAll(file)
		file.Close()
		if err != nil {
			return nil, "", errors.New("unable to read pdf")
		}
		if len(data) == 0 {
			return nil, "", errors.New("empty pdf payload")
		}
		pdfs = append(pdfs, data)
	}

	return pdfs, r.FormValue("filename"), nil
}

func readJSONPDFs(r *http.Request) ([][]byte, string, error) {
	var req concatPDFRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		return nil, "", errors.New("invalid request body")
	}

	if len(req.PDFs) == 0 {
		return nil, "", errors.New("missing pdfs")
	}

	pdfs := make([][]byte, 0, len(req.PDFs))
	for index, encoded := range req.PDFs {
		data, err := decodeBase64PDF(encoded)
		if err != nil {
			return nil, "", fmt.Errorf("pdf %d: %w", index+1, err)
		}
		pdfs = append(pdfs, data)
	}

	return pdfs, req.Filename, nil
}

func decodeBase64PDF(input string) ([]byte, error) {
	trimmed := strings.TrimSpace(input)
	if trimmed == "" {
		return nil, errors.New("empty pdf payload")
	}
	if strings.HasPrefix(trimmed, "data:") {
		if comma := strings.Index(trimmed, ","); comma != -1 {
			trimmed = trimmed[comma+1:]
		}
	}

	data, err := base64.StdEncoding.DecodeString(trimmed)
	if err != nil {
		return nil, errors.New("invalid base64 pdf payload")
	}
	if len(data) == 0 {
		return nil, errors.New("empty pdf payload")
	}
	return data, nil
}

func buildConcatFilename(input string) string {
	base := sanitizeFilename(strings.TrimSpace(input))
	if base == "" {
		base = "combined"
	}
	return fmt.Sprintf("%s.pdf", base)
}

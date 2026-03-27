package pdf

import (
	"bytes"
	"strings"

	"github.com/pdfcpu/pdfcpu/pkg/api"
	"github.com/pdfcpu/pdfcpu/pkg/pdfcpu/model"
)

// SetDocumentTitle updates the PDF metadata so native viewers can display the provided title.
func SetDocumentTitle(data []byte, title string) ([]byte, error) {
	normalizedTitle := strings.TrimSpace(title)
	if len(data) == 0 || normalizedTitle == "" {
		return data, nil
	}

	withTitle, err := addProperties(data, map[string]string{
		"Title": normalizedTitle,
	})
	if err != nil {
		return nil, err
	}

	viewerPreferences := model.ViewerPreferences{}
	viewerPreferences.SetDisplayDocTitle(true)

	return setViewerPreferences(withTitle, viewerPreferences)
}

func addProperties(data []byte, properties map[string]string) ([]byte, error) {
	var buf bytes.Buffer
	if err := api.AddProperties(bytes.NewReader(data), &buf, properties, nil); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

func setViewerPreferences(data []byte, viewerPreferences model.ViewerPreferences) ([]byte, error) {
	var buf bytes.Buffer
	if err := api.SetViewerPreferences(bytes.NewReader(data), &buf, viewerPreferences, nil); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

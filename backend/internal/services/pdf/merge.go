package pdf

import (
	"bytes"
	"errors"
	"io"

	"github.com/pdfcpu/pdfcpu/pkg/api"
)

func Merge(pdfs [][]byte) ([]byte, error) {
	if len(pdfs) == 0 {
		return nil, errors.New("no PDFs to merge")
	}

	readers := make([]io.ReadSeeker, 0, len(pdfs))
	for _, pdf := range pdfs {
		if len(pdf) == 0 {
			return nil, errors.New("empty PDF payload")
		}
		readers = append(readers, bytes.NewReader(pdf))
	}

	var buf bytes.Buffer
	if err := api.MergeRaw(readers, &buf, false, nil); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

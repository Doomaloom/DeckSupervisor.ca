package pdf

import (
	"bytes"
	"errors"

	"github.com/pdfcpu/pdfcpu/pkg/api"
)

func RotateAllPages(data []byte, clockwiseDegrees int) ([]byte, error) {
	if len(data) == 0 {
		return nil, errors.New("empty PDF payload")
	}

	var out bytes.Buffer
	if err := api.Rotate(bytes.NewReader(data), &out, clockwiseDegrees, nil, nil); err != nil {
		return nil, err
	}
	if out.Len() == 0 {
		return nil, errors.New("empty rotated PDF payload")
	}

	return out.Bytes(), nil
}

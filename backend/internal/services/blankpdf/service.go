package blankpdf

import (
	"context"
	"fmt"
	"strings"
	"time"

	"cob-aquatics/internal/services/pdf"
	"github.com/chromedp/cdproto/page"
)

type Request struct {
	Orientation              string `json:"orientation"`
	RotateCounterClockwise90 bool   `json:"rotateCounterClockwise90"`
}

type Output struct {
	Data     []byte
	Filename string
}

func BuildPDF(ctx context.Context, req Request) (Output, error) {
	orientation := strings.ToLower(strings.TrimSpace(req.Orientation))
	if orientation != "landscape" {
		orientation = "portrait"
	}

	htmlContent := buildHTML(orientation)
	pdfBytes, err := renderPDF(ctx, htmlContent)
	if err != nil {
		return Output{}, err
	}
	if req.RotateCounterClockwise90 {
		pdfBytes, err = pdf.RotateAllPages(pdfBytes, 270)
		if err != nil {
			return Output{}, err
		}
	}

	filename := fmt.Sprintf("blank-%s.pdf", time.Now().Format("2006-01-02"))
	return Output{Data: pdfBytes, Filename: filename}, nil
}

func buildHTML(orientation string) string {
	return fmt.Sprintf(`<!doctype html><html><head><meta charset="utf-8"/>
<style>
@page { size: letter %s; margin: 0.25in; }
body { margin: 0; }
</style></head><body></body></html>`, orientation)
}

func renderPDF(ctx context.Context, htmlContent string) ([]byte, error) {
	return pdf.RenderHTML(ctx, pdf.RenderRequest{
		HTML:            htmlContent,
		ReadySelector:   "body",
		AfterReadyDelay: 200 * time.Millisecond,
		Timeout:         30 * time.Second,
		ConfigurePrint: func(params *page.PrintToPDFParams) *page.PrintToPDFParams {
			return params.WithPrintBackground(true).
				WithPreferCSSPageSize(true)
		},
	})
}

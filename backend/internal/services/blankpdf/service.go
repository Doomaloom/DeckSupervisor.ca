package blankpdf

import (
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"runtime"
	"strings"
	"time"

	"github.com/chromedp/cdproto/page"
	"github.com/chromedp/chromedp"
)

type Request struct {
	Orientation string `json:"orientation"`
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
	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	allocatorOptions, err := buildChromeAllocatorOptions()
	if err != nil {
		return nil, err
	}

	allocatorCtx, allocatorCancel := chromedp.NewExecAllocator(ctx, allocatorOptions...)
	defer allocatorCancel()

	taskCtx, taskCancel := chromedp.NewContext(allocatorCtx)
	defer taskCancel()

	file, err := os.CreateTemp("", "blank-*.html")
	if err != nil {
		return nil, err
	}
	filePath := file.Name()
	if _, err := file.WriteString(htmlContent); err != nil {
		file.Close()
		return nil, err
	}
	if err := file.Close(); err != nil {
		return nil, err
	}
	defer os.Remove(filePath)

	fileURL := "file://" + filePath
	var pdfBytes []byte

	err = chromedp.Run(taskCtx,
		chromedp.Navigate(fileURL),
		chromedp.WaitReady("body", chromedp.ByQuery),
		chromedp.Sleep(200*time.Millisecond),
		chromedp.ActionFunc(func(ctx context.Context) error {
			var err error
			pdfBytes, _, err = page.PrintToPDF().
				WithPrintBackground(true).
				WithPreferCSSPageSize(true).
				Do(ctx)
			return err
		}),
	)
	if err != nil {
		return nil, err
	}
	if len(pdfBytes) == 0 {
		return nil, errors.New("empty PDF payload")
	}
	return pdfBytes, nil
}

func buildChromeAllocatorOptions() ([]chromedp.ExecAllocatorOption, error) {
	allocatorOptions := append(chromedp.DefaultExecAllocatorOptions[:],
		chromedp.NoSandbox,
		chromedp.Flag("disable-gpu", true),
		chromedp.Flag("disable-dev-shm-usage", true),
	)
	chromePath, err := resolveChromePath()
	if err != nil {
		return nil, err
	}
	if chromePath != "" {
		allocatorOptions = append(allocatorOptions, chromedp.ExecPath(chromePath))
	}
	return allocatorOptions, nil
}

func resolveChromePath() (string, error) {
	if value := os.Getenv("CHROME_PATH"); value != "" {
		return value, nil
	}
	if runtime.GOOS == "linux" {
		paths := []string{"google-chrome", "chromium-browser", "chromium"}
		for _, path := range paths {
			if resolved, err := exec.LookPath(path); err == nil {
				return resolved, nil
			}
		}
		return "", errors.New("chrome executable not found; install Chrome/Chromium or set CHROME_PATH")
	}
	if runtime.GOOS == "darwin" {
		path := "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
		if _, err := os.Stat(path); err == nil {
			return path, nil
		}
		path = "/Applications/Chromium.app/Contents/MacOS/Chromium"
		if _, err := os.Stat(path); err == nil {
			return path, nil
		}
		return "", errors.New("chrome executable not found; install Chrome/Chromium or set CHROME_PATH")
	}
	return "", errors.New("chrome executable not found; install Chrome/Chromium or set CHROME_PATH")
}

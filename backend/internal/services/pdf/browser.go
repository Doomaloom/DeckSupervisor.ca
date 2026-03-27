package pdf

import (
	"context"
	"errors"
	"os"
	"os/exec"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/chromedp/cdproto/page"
	"github.com/chromedp/chromedp"
)

const (
	defaultSharedPDFConcurrency    = 2
	maxSharedPDFConcurrency        = 8
	defaultSharedPDFTimeoutSeconds = 30
	minSharedPDFTimeoutSeconds     = 5
	maxSharedPDFTimeoutSeconds     = 120
)

type RenderRequest struct {
	HTML            string
	ReadySelector   string
	ViewportWidth   int64
	ViewportHeight  int64
	AfterReadyDelay time.Duration
	Timeout         time.Duration
	ConfigurePrint  func(*page.PrintToPDFParams) *page.PrintToPDFParams
}

type browserRuntime struct {
	browserCtx    context.Context
	browserCancel context.CancelFunc
	limiter       chan struct{}
}

var (
	sharedBrowserRuntime     *browserRuntime
	sharedBrowserRuntimeErr  error
	sharedBrowserRuntimeOnce sync.Once
)

func RenderHTML(ctx context.Context, req RenderRequest) ([]byte, error) {
	if strings.TrimSpace(req.HTML) == "" {
		return nil, errors.New("missing html content")
	}

	runtime, err := sharedRuntime()
	if err != nil {
		return nil, err
	}

	release, err := runtime.acquire(ctx)
	if err != nil {
		return nil, err
	}
	defer release()

	tabCtx, tabCancel := chromedp.NewContext(runtime.browserCtx)
	defer tabCancel()

	runCtx := tabCtx
	timeout := req.Timeout
	if timeout <= 0 {
		timeout = sharedPDFTimeout()
	}
	if timeout > 0 {
		var timeoutCancel context.CancelFunc
		runCtx, timeoutCancel = context.WithTimeout(runCtx, timeout)
		defer timeoutCancel()
	}

	cancelRunCtx := func() {}
	if ctx != nil {
		var cancel context.CancelFunc
		runCtx, cancel = context.WithCancel(runCtx)
		cancelRunCtx = cancel
		done := make(chan struct{})
		defer close(done)
		go func() {
			select {
			case <-ctx.Done():
				cancel()
			case <-done:
			}
		}()
	}
	defer cancelRunCtx()

	readySelector := strings.TrimSpace(req.ReadySelector)
	if readySelector == "" {
		readySelector = "body"
	}

	actions := make([]chromedp.Action, 0, 6)
	if req.ViewportWidth > 0 && req.ViewportHeight > 0 {
		actions = append(actions, chromedp.EmulateViewport(req.ViewportWidth, req.ViewportHeight))
	}
	actions = append(actions,
		chromedp.Navigate("about:blank"),
		chromedp.ActionFunc(func(ctx context.Context) error {
			frameTree, err := page.GetFrameTree().Do(ctx)
			if err != nil {
				return err
			}
			return page.SetDocumentContent(frameTree.Frame.ID, req.HTML).Do(ctx)
		}),
		chromedp.WaitReady(readySelector, chromedp.ByQuery),
	)
	if req.AfterReadyDelay > 0 {
		actions = append(actions, chromedp.Sleep(req.AfterReadyDelay))
	}

	var pdfBytes []byte
	actions = append(actions, chromedp.ActionFunc(func(ctx context.Context) error {
		params := page.PrintToPDF()
		if req.ConfigurePrint != nil {
			if configured := req.ConfigurePrint(params); configured != nil {
				params = configured
			}
		}
		var err error
		pdfBytes, _, err = params.Do(ctx)
		return err
	}))

	if err := chromedp.Run(runCtx, actions...); err != nil {
		return nil, err
	}
	if len(pdfBytes) == 0 {
		return nil, errors.New("empty PDF payload")
	}

	return pdfBytes, nil
}

func sharedRuntime() (*browserRuntime, error) {
	sharedBrowserRuntimeOnce.Do(func() {
		allocatorOptions, err := buildChromeAllocatorOptions()
		if err != nil {
			sharedBrowserRuntimeErr = err
			return
		}

		allocatorCtx, _ := chromedp.NewExecAllocator(context.Background(), allocatorOptions...)
		browserCtx, browserCancel := chromedp.NewContext(allocatorCtx)
		sharedBrowserRuntime = &browserRuntime{
			browserCtx:    browserCtx,
			browserCancel: browserCancel,
			limiter:       make(chan struct{}, sharedPDFConcurrency()),
		}
	})

	if sharedBrowserRuntimeErr != nil {
		return nil, sharedBrowserRuntimeErr
	}
	if sharedBrowserRuntime == nil {
		return nil, errors.New("shared browser runtime unavailable")
	}

	return sharedBrowserRuntime, nil
}

func (runtime *browserRuntime) acquire(ctx context.Context) (func(), error) {
	select {
	case runtime.limiter <- struct{}{}:
		return func() {
			<-runtime.limiter
		}, nil
	case <-ctx.Done():
		return nil, ctx.Err()
	}
}

func sharedPDFConcurrency() int {
	raw := strings.TrimSpace(os.Getenv("SHARED_PDF_CONCURRENCY"))
	if raw == "" {
		return defaultSharedPDFConcurrency
	}
	value, err := strconv.Atoi(raw)
	if err != nil || value < 1 {
		return defaultSharedPDFConcurrency
	}
	if value > maxSharedPDFConcurrency {
		return maxSharedPDFConcurrency
	}
	return value
}

func sharedPDFTimeout() time.Duration {
	raw := strings.TrimSpace(os.Getenv("SHARED_PDF_TIMEOUT_SECONDS"))
	if raw == "" {
		return defaultSharedPDFTimeoutSeconds * time.Second
	}
	value, err := strconv.Atoi(raw)
	if err != nil || value < minSharedPDFTimeoutSeconds {
		return defaultSharedPDFTimeoutSeconds * time.Second
	}
	if value > maxSharedPDFTimeoutSeconds {
		value = maxSharedPDFTimeoutSeconds
	}
	return time.Duration(value) * time.Second
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

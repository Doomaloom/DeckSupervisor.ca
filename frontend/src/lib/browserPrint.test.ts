import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openPdfPrintDialog } from "./browserPrint";

// A stand-in pop-up: renderPdfViewer writes into its document, and the test
// installs __printEmbeddedPdf the way the viewer's inline script would.
function fakePopup(printResults: boolean[] | null) {
    const print = vi.fn(() => (printResults ? printResults.shift() ?? true : true));
    const popup = {
        document: { open: vi.fn(), write: vi.fn(), close: vi.fn() },
        addEventListener: vi.fn(),
        focus: vi.fn(),
        onload: null as null | (() => void),
        __printEmbeddedPdf: printResults === null ? undefined : print,
    };
    return { popup, print };
}

describe("openPdfPrintDialog", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.spyOn(window.URL, "createObjectURL").mockReturnValue("blob:test");
        vi.spyOn(window.URL, "revokeObjectURL").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    const blob = new Blob(["%PDF"], { type: "application/pdf" });

    it("prints once when both the onload timer and the fallback timer fire", () => {
        const { popup, print } = fakePopup([]);
        expect(openPdfPrintDialog(blob, popup as unknown as Window)).toBe(true);

        popup.onload?.();
        vi.advanceTimersByTime(5000);

        expect(print).toHaveBeenCalledTimes(1);
    });

    it("prints once from the fallback when onload never fires", () => {
        const { popup, print } = fakePopup([]);
        openPdfPrintDialog(blob, popup as unknown as Window);

        vi.advanceTimersByTime(5000);

        expect(print).toHaveBeenCalledTimes(1);
    });

    it("retries from the fallback when the first attempt could not print", () => {
        const { popup, print } = fakePopup([false, true]);
        openPdfPrintDialog(blob, popup as unknown as Window);

        popup.onload?.();
        vi.advanceTimersByTime(1000);
        expect(print).toHaveBeenCalledTimes(1);

        vi.advanceTimersByTime(4000);
        expect(print).toHaveBeenCalledTimes(2);
    });

    it("prints once when onload comes after the fallback timer", () => {
        const { popup, print } = fakePopup([]);
        openPdfPrintDialog(blob, popup as unknown as Window);

        vi.advanceTimersByTime(3000);
        popup.onload?.();
        vi.advanceTimersByTime(2000);

        expect(print).toHaveBeenCalledTimes(1);
    });
});

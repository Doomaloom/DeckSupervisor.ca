import { afterEach, expect, it, vi } from "vitest";
import { fetchResultRegistry, fetchResults, RESULTS_FORBIDDEN, RESULTS_UNAVAILABLE, submitResult, type ResultOperation } from "./resultsApi";

afterEach(() => vi.unstubAllGlobals());
const reply = (status: number, text = "") => vi.stubGlobal("fetch", vi.fn(async () => new Response(text, { status })));

it("explains a refusal instead of echoing the generic server text", async () => {
    reply(403, "Request not authorized or invalid");
    await expect(fetchResults("s")).rejects.toMatchObject({ status: 403, message: RESULTS_FORBIDDEN });
    await expect(fetchResultRegistry("s")).rejects.toMatchObject({ status: 403, message: RESULTS_FORBIDDEN });
});

it("reports outages as retryable, never as a permission problem", async () => {
    reply(502, "Results service is unavailable right now. Try again in a moment.");
    await expect(fetchResults("s")).rejects.toMatchObject({ status: 502, message: "Results service is unavailable right now. Try again in a moment." });
    reply(502, "<html>bad gateway</html>");
    await expect(fetchResults("s")).rejects.toMatchObject({ message: RESULTS_UNAVAILABLE });
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
    await expect(submitResult("s", {} as ResultOperation)).rejects.toMatchObject({ status: 0, message: RESULTS_UNAVAILABLE });
    await expect(fetchResultRegistry("s")).rejects.toMatchObject({ message: RESULTS_UNAVAILABLE });
});

it("keeps client errors and the unregistered registry distinct", async () => {
    reply(400, "Invalid request");
    await expect(fetchResults("s")).rejects.toMatchObject({ status: 400, message: "Invalid request" });
    reply(404);
    await expect(fetchResultRegistry("s")).resolves.toBeNull();
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentSession, signInWithPassword, signOut } from "./authClient";

const user = { id: "u1", email: "a@b.c" };

function sessionResponse(expiresAt: number) {
    return new Response(
        JSON.stringify({
            session: {
                token_type: "bearer",
                expires_in: 3600,
                expires_at: expiresAt,
                user,
            },
        }),
        { status: 200 },
    );
}

describe("authClient background refresh", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    });

    afterEach(async () => {
        vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 204 })));
        await signOut();
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    it("asks the server to store refreshed cookies after the token expires", async () => {
        const now = Math.floor(Date.now() / 1000);
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(sessionResponse(now + 3600))
            .mockResolvedValueOnce(sessionResponse(now + 7200));
        vi.stubGlobal("fetch", fetchMock);

        await signInWithPassword("a@b.c", "pw");
        expect(fetchMock).toHaveBeenCalledTimes(1);

        await vi.advanceTimersByTimeAsync(3600 * 1000);
        expect(fetchMock).toHaveBeenCalledTimes(1);

        await vi.advanceTimersByTimeAsync(6000);
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(fetchMock.mock.calls[1][0]).toBe("/api/auth/session");
        expect(getCurrentSession()?.expires_at).toBe(now + 7200);
    });

    it("keeps the session when the refresh fails for a non-auth reason", async () => {
        const now = Math.floor(Date.now() / 1000);
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(sessionResponse(now + 3600))
            .mockResolvedValueOnce(new Response("Bad gateway", { status: 502 }));
        vi.stubGlobal("fetch", fetchMock);

        await signInWithPassword("a@b.c", "pw");
        await vi.advanceTimersByTimeAsync(3606 * 1000);
        expect(getCurrentSession()).not.toBeNull();
    });

    it("signs out when the server says Unauthorized", async () => {
        const now = Math.floor(Date.now() / 1000);
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(sessionResponse(now + 3600))
            .mockResolvedValueOnce(new Response("Unauthorized\n", { status: 401 }));
        vi.stubGlobal("fetch", fetchMock);

        await signInWithPassword("a@b.c", "pw");
        await vi.advanceTimersByTimeAsync(3606 * 1000);
        expect(getCurrentSession()).toBeNull();
    });
});

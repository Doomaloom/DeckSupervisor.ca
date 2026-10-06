import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import ForgotPasswordPage from "./ForgotPasswordPage";
import ResetPasswordPage from "./ResetPasswordPage";
const api = vi.hoisted(() => ({
    requestPasswordRecovery: vi.fn(),
    verifyPasswordRecovery: vi.fn(),
    passwordRecoveryStatus: vi.fn(),
    resetRecoveredPassword: vi.fn(),
}));
vi.mock("../../lib/authClient", () => api);
beforeEach(() => {
    Object.values(api).forEach((fn) => fn.mockReset());
    api.passwordRecoveryStatus.mockRejectedValue(new Error("expired"));
});
it("shows a uniform email confirmation and preserves request errors", async () => {
    const user = userEvent.setup();
    api.requestPasswordRecovery.mockResolvedValue({
        message:
            "If an account exists for that email, you will receive a password reset link.",
    });
    render(
        <MemoryRouter>
            <ForgotPasswordPage />
        </MemoryRouter>,
    );
    await user.type(screen.getByLabelText("Email"), "unknown@example.invalid");
    await user.click(screen.getByRole("button", { name: "Send reset link" }));
    expect(await screen.findByRole("status")).toHaveTextContent(
        "If an account exists",
    );
    api.requestPasswordRecovery.mockRejectedValue(
        new Error("Too many reset requests. Try again later."),
    );
    await user.click(screen.getByRole("button", { name: "Send reset link" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
        "Too many reset requests",
    );
});
function reset(url = "/reset-password?token_hash=valid&type=recovery") {
    render(
        <MemoryRouter initialEntries={[url]}>
            <Routes>
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="/sign-in" element={<p>Sign in after reset</p>} />
            </Routes>
        </MemoryRouter>,
    );
}
it("waits for submission, rejects mismatch, retries policy rejection and returns to sign-in", async () => {
    const user = userEvent.setup();
    reset();
    expect(api.verifyPasswordRecovery).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText("New password"), "strong-password");
    await user.type(
        screen.getByLabelText("Confirm password"),
        "different-password",
    );
    await user.click(screen.getByRole("button", { name: "Reset password" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Passwords must match");
    expect(api.verifyPasswordRecovery).not.toHaveBeenCalled();
    await user.clear(screen.getByLabelText("Confirm password"));
    await user.type(
        screen.getByLabelText("Confirm password"),
        "strong-password",
    );
    api.verifyPasswordRecovery.mockResolvedValue(undefined);
    api.resetRecoveredPassword.mockRejectedValueOnce(
        new Error("Password rejected by policy"),
    );
    await user.click(screen.getByRole("button", { name: "Reset password" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
        "Password rejected by policy",
    );
    api.resetRecoveredPassword.mockResolvedValue({ message: "Password reset" });
    await user.click(screen.getByRole("button", { name: "Reset password" }));
    expect(await screen.findByText("Sign in after reset")).toBeVisible();
    expect(api.verifyPasswordRecovery).toHaveBeenCalledTimes(1);
});
it("explains expired or missing recovery sessions and offers another email", async () => {
    reset("/reset-password");
    expect(await screen.findByRole("alert")).toHaveTextContent(
        "invalid, expired, or already used",
    );
    expect(screen.getByRole("link", { name: "Request another reset email" }))
        .toHaveAttribute("href", "/forgot-password");
    await waitFor(() => expect(api.passwordRecoveryStatus).toHaveBeenCalled());
});

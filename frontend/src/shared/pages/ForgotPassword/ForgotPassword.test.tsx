import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import ForgotPasswordPage from "./ForgotPassword.component";
const api = vi.hoisted(() => ({
    requestPasswordRecovery: vi.fn(),
    verifyPasswordRecovery: vi.fn(),
    passwordRecoveryStatus: vi.fn(),
    resetRecoveredPassword: vi.fn(),
}));
vi.mock("../../../lib/authClient", () => api);
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

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import SignIn from "./SignIn.component";
const auth = vi.hoisted(() => ({ isGuest: true, user: null as {
        id: string;
    } | null, signIn: vi.fn(), signUp: vi.fn() }));
vi.mock("../../../app/AuthContext", () => ({ useAuth: () => auth }));
beforeEach(() => { auth.isGuest = true; auth.user = null; auth.signIn.mockReset().mockResolvedValue(undefined); auth.signUp.mockReset().mockResolvedValue(""); });
function setup() { render(<MemoryRouter initialEntries={["/sign-in"]}><Routes><Route path="/sign-in" element={<SignIn />}/><Route path="/" element={<p>Dashboard destination</p>}/></Routes></MemoryRouter>); }
it("submits credentials and navigates to the dashboard", async () => {
    const user = userEvent.setup();
    setup();
    await user.type(screen.getByPlaceholderText("Email"), "staff@example.invalid");
    await user.type(screen.getByPlaceholderText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Dashboard destination")).toBeVisible();
    expect(auth.signIn).toHaveBeenCalledWith("staff@example.invalid", "password123");
});
it("retains the form and displays authentication failures", async () => {
    auth.signIn.mockRejectedValue(new Error("Invalid credentials"));
    const user = userEvent.setup();
    setup();
    await user.type(screen.getByPlaceholderText("Email"), "staff@example.invalid");
    await user.type(screen.getByPlaceholderText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Invalid credentials")).toBeVisible();
    expect(screen.getByPlaceholderText("Email")).toHaveValue("staff@example.invalid");
});
it("directs signed-in users to their account", () => {
    auth.isGuest = false;
    auth.user = { id: "staff" };
    setup();
    expect(screen.getByRole("link", { name: "Go to Account" })).toHaveAttribute("href", "/account");
    expect(screen.queryByPlaceholderText("Password")).not.toBeInTheDocument();
});

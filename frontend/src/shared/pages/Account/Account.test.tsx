import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import Account from "./Account.component";
const mocks = vi.hoisted(() => ({ completeProfile: vi.fn(), fetchAccountData: vi.fn(), acceptTeamInvite: vi.fn(), declineTeamInvite: vi.fn(), isGuest: false, user: { id: "staff" } as {
        id: string;
    } | null, profile: { first_name: "Alex", last_name: "River", location: "Pool" } }));
vi.mock("../../../app/AuthContext", () => ({ useAuth: () => mocks }));
vi.mock("../../../lib/serverApi", () => mocks);
beforeEach(() => { mocks.isGuest = false; mocks.user = { id: "staff" }; mocks.fetchAccountData.mockReset().mockResolvedValue({ invites: [], memberships: [] }); mocks.completeProfile.mockReset().mockResolvedValue(undefined); mocks.acceptTeamInvite.mockReset().mockResolvedValue(undefined); });
function setup() { render(<MemoryRouter><Account /></MemoryRouter>); }
it("offers sign-in in guest mode without loading private data", () => { mocks.isGuest = true; mocks.user = null; setup(); expect(screen.getByRole("link", { name: "Go to Sign In" })).toHaveAttribute("href", "/sign-in"); expect(mocks.fetchAccountData).not.toHaveBeenCalled(); });
it("saves the profile and rejects missing required names", async () => {
    const user = userEvent.setup();
    setup();
    await user.clear(screen.getByPlaceholderText("First name"));
    await user.type(screen.getByPlaceholderText("First name"), "Sam");
    await user.click(screen.getByRole("button", { name: "Save Profile" }));
    expect(mocks.completeProfile).toHaveBeenCalledWith("Sam", "River", "Pool");
    await user.clear(screen.getByPlaceholderText("First name"));
    await user.click(screen.getByRole("button", { name: "Save Profile" }));
    expect(screen.getByText("Please enter your first and last name.")).toBeVisible();
    expect(mocks.completeProfile).toHaveBeenCalledOnce();
});
it("accepts an invite and refreshes memberships", async () => {
    mocks.fetchAccountData.mockResolvedValueOnce({ invites: [{ id: "invite", team_id: "team", status: "pending", teams: { name: "Aquatics" } }], memberships: [] });
    setup();
    await userEvent.setup().click(await screen.findByRole("button", { name: "Accept" }));
    expect(mocks.acceptTeamInvite).toHaveBeenCalledWith("invite");
    expect(await screen.findByText(/No pending invites/)).toBeVisible();
});

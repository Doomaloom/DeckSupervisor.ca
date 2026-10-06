import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import TeamPage from "./TeamPage";

const api = vi.hoisted(() => ({
    user: { id: "owner" },
    fetchOwnedTeams: vi.fn(),
    fetchTeamDetails: vi.fn(),
    searchInvitableProfiles: vi.fn(),
    createTeamInvite: vi.fn(),
}));
vi.mock(
    "../../app/AuthContext",
    () => ({
        useAuth: () => ({
            accountType: "full_time",
            isGuest: false,
            user: api.user,
        }),
    }),
);
vi.mock("../../lib/serverApi", async (importOriginal) => ({
    ...await importOriginal<typeof import("../../lib/serverApi")>(),
    fetchOwnedTeams: api.fetchOwnedTeams,
    fetchTeamDetails: api.fetchTeamDetails,
    searchInvitableProfiles: api.searchInvitableProfiles,
    createTeamInvite: api.createTeamInvite,
}));
const profile = {
    id: "staff",
    first_name: "Alex",
    last_name: "Staff",
    email: "alex@example.invalid",
};
beforeEach(() => {
    vi.clearAllMocks();
    api.fetchOwnedTeams.mockResolvedValue({
        teams: [{ id: "team-a", name: "Team A" }],
    });
    api.fetchTeamDetails.mockResolvedValue({ members: [], invites: [] });
    api.searchInvitableProfiles.mockResolvedValue({ results: [profile] });
    api.createTeamInvite.mockResolvedValue({
        invite: {
            id: "invite-a",
            invitee_id: profile.id,
            status: "pending",
            profiles: profile,
        },
    });
});

it("uses shared name/email search while retaining the team invitation action", async () => {
    const user = userEvent.setup();
    render(
        <MemoryRouter>
            <TeamPage />
        </MemoryRouter>,
    );
    const input = await screen.findByLabelText("Search staff to invite");
    await user.type(input, "Alex");
    await user.click(screen.getByRole("button", { name: "Search" }));
    await user.click(await screen.findByRole("button", { name: "Invite" }));
    expect(api.searchInvitableProfiles).toHaveBeenCalledWith("team-a", "Alex");
    expect(api.createTeamInvite).toHaveBeenCalledWith("team-a", "staff");
    await waitFor(() =>
        expect(screen.getByRole("button", { name: "Invite sent" }))
            .toBeDisabled()
    );
});

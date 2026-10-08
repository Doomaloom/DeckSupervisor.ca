import AccountSearch from "../../../shared/accounts/AccountSearch";

import { Link } from "react-router-dom";

import { searchInvitableProfiles } from "../../../lib/serverApi";

import { setCurrentTeamId } from "../../../lib/teamStorage";
import { getSessionLabel, useTeamLogic } from "./Team.logic";
function TeamPage() {
    const viewModel = useTeamLogic();
    if (viewModel.view === "hidden") {
        return (
            <div
                id="team-page"
                data-component="team-page"
                className="mx-auto flex w-full max-w-xl flex-col gap-6"
            >
                <div className="rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md">
                    <h2 className="text-xl font-semibold">
                        Sign in to manage teams
                    </h2>
                    <p className="mt-2 text-sm text-secondary/70">
                        You must be signed in to invite team members.
                    </p>
                    <Link
                        to="/sign-in"
                        className="mt-4 inline-flex rounded-2xl bg-secondary px-4 py-2 text-sm font-semibold text-accent transition hover:-translate-y-0.5 hover:bg-accent hover:text-secondary"
                    >
                        Go to Sign In
                    </Link>
                </div>
            </div>
        );
    }
    if (viewModel.view === "ready") {
        const {
            memberTeams,
            shareSessionId,
            setShareSessionId,
            shareableSessions,
            shareMemberId,
            setShareMemberId,
            shareMembers,
            shareDate,
            setShareDate,
            shareAllowEdits,
            setShareAllowEdits,
            handleShareSession,
            loading,
            shareMessage,
        } = viewModel;
        return (
            <div
                id="team-page"
                data-component="team-page"
                className="mx-auto flex w-full max-w-5xl flex-col gap-6"
            >
                <div className="rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md">
                    <h2 className="text-2xl font-semibold">My Team</h2>
                    <p className="mt-2 text-sm text-secondary/70">
                        View your teams and share sessions when you need
                        coverage.
                    </p>
                </div>

                <div className="rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md">
                    <h3 className="text-lg font-semibold">Teams</h3>
                    {memberTeams.length === 0
                        ? (
                            <p className="mt-3 text-sm text-secondary/70">
                                No team memberships found.
                            </p>
                        )
                        : (
                            <div className="mt-4 grid gap-3 md:grid-cols-2">
                                {memberTeams.map((team) => (
                                    <div
                                        key={team.id}
                                        className="rounded-2xl border border-secondary/20 bg-bg p-4"
                                    >
                                        <p className="font-semibold text-secondary">
                                            {team.name}
                                        </p>
                                        {team.available_locations?.length
                                            ? (
                                                <p className="text-xs text-secondary/70">
                                                    Locations:{" "}
                                                    {team.available_locations
                                                        .join(", ")}
                                                </p>
                                            )
                                            : null}
                                    </div>
                                ))}
                            </div>
                        )}
                </div>

                <div className="rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md">
                    <h3 className="text-lg font-semibold">Share a session</h3>
                    <p className="mt-2 text-sm text-secondary/70">
                        Share a session for a specific date with a teammate
                        covering your shift.
                    </p>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <label className="flex flex-col gap-2 text-sm font-semibold text-secondary">
                            Session
                            <select
                                className="rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-sm text-secondary"
                                value={shareSessionId}
                                onChange={(event) =>
                                    setShareSessionId(event.target.value)}
                            >
                                <option value="">Select a session</option>
                                {shareableSessions.map((session) => (
                                    <option key={session.id} value={session.id}>
                                        {getSessionLabel(session)}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className="flex flex-col gap-2 text-sm font-semibold text-secondary">
                            Teammate
                            <select
                                className="rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-sm text-secondary"
                                value={shareMemberId}
                                onChange={(event) =>
                                    setShareMemberId(event.target.value)}
                            >
                                <option value="">Select a teammate</option>
                                {shareMembers.map((member) => (
                                    <option
                                        key={member.user_id}
                                        value={member.user_id}
                                    >
                                        {member.profiles?.first_name}{" "}
                                        {member.profiles?.last_name}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className="flex flex-col gap-2 text-sm font-semibold text-secondary">
                            Share Date
                            <input
                                className="rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-sm text-secondary"
                                type="date"
                                value={shareDate}
                                onChange={(event) =>
                                    setShareDate(event.target.value)}
                            />
                        </label>
                        <label className="flex items-center gap-2 text-sm font-semibold text-secondary">
                            <input
                                type="checkbox"
                                checked={shareAllowEdits}
                                onChange={(event) =>
                                    setShareAllowEdits(event.target.checked)}
                            />
                            Allow roster edits
                        </label>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                        <button
                            type="button"
                            className="rounded-2xl bg-secondary px-4 py-2 text-sm font-semibold text-accent transition hover:-translate-y-0.5 hover:bg-accent hover:text-secondary"
                            onClick={handleShareSession}
                            disabled={loading}
                        >
                            Share Session
                        </button>
                        {shareMessage
                            ? (
                                <span className="text-sm font-semibold text-secondary">
                                    {shareMessage}
                                </span>
                            )
                            : null}
                    </div>
                </div>
            </div>
        );
    }
    const {
        teamName,
        setTeamName,
        locationsInput,
        setLocationsInput,
        handleCreateTeam,
        loading,
        message,
        teams,
        activeTeamId,
        setActiveTeamId,
        handleUpdateLocations,
        memberIds,
        invitedIds,
        handleInvite,
        invites,
        handleRevokeInvite,
        members,
        user,
        handleRemoveMember,
    } = viewModel;
    return (
        <div
            id="team-page"
            data-component="team-page"
            className="mx-auto flex w-full max-w-6xl flex-col gap-6"
        >
            <div className="rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md">
                <h2 className="text-2xl font-semibold">Teams</h2>
                <p className="mt-2 text-sm text-secondary/70">
                    Create teams and invite part-time staff.
                </p>
            </div>

            <div className="rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md">
                <h3 className="text-lg font-semibold">Create a team</h3>
                <div className="mt-4 flex flex-wrap gap-3">
                    <input
                        className="flex-1 rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-sm text-secondary"
                        value={teamName}
                        onChange={(event) => setTeamName(event.target.value)}
                        placeholder="Team name"
                    />
                    <input
                        className="flex-1 rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-sm text-secondary"
                        value={locationsInput}
                        onChange={(event) =>
                            setLocationsInput(event.target.value)}
                        placeholder="Locations (comma separated)"
                    />
                    <button
                        type="button"
                        className="rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-secondary"
                        onClick={handleCreateTeam}
                        disabled={loading}
                    >
                        Create
                    </button>
                </div>
                {message
                    ? (
                        <p className="mt-2 text-sm font-semibold text-secondary">
                            {message}
                        </p>
                    )
                    : null}
            </div>

            {teams.length === 0
                ? (
                    <div className="rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md">
                        <p className="text-sm text-secondary/70">
                            No teams created yet.
                        </p>
                    </div>
                )
                : (
                    <div className="rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md">
                        <h3 className="text-lg font-semibold">Manage team</h3>
                        <div className="mt-3 flex flex-wrap items-center gap-3">
                            <select
                                className="rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-sm text-secondary"
                                value={activeTeamId}
                                onChange={(event) => {
                                    const nextId = event.target.value;
                                    setActiveTeamId(nextId);
                                    setCurrentTeamId(nextId);
                                }}
                            >
                                {teams.map((team) => (
                                    <option key={team.id} value={team.id}>
                                        {team.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="mt-4 flex flex-wrap items-center gap-3">
                            <input
                                className="flex-1 rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-sm text-secondary"
                                value={locationsInput}
                                onChange={(event) =>
                                    setLocationsInput(event.target.value)}
                                placeholder="Locations (comma separated)"
                            />
                            <button
                                type="button"
                                className="rounded-2xl bg-secondary px-4 py-2 text-sm font-semibold text-accent transition hover:-translate-y-0.5 hover:bg-accent hover:text-secondary"
                                onClick={handleUpdateLocations}
                                disabled={loading || !activeTeamId}
                            >
                                Update Locations
                            </button>
                        </div>

                        <div className="mt-6 grid gap-6 md:grid-cols-2">
                            <div>
                                <h4 className="text-base font-semibold">
                                    Invite by name
                                </h4>
                                <AccountSearch
                                    key={activeTeamId}
                                    label="Search staff to invite"
                                    disabled={loading || !activeTeamId}
                                    search={async (query) =>
                                        (await searchInvitableProfiles(
                                            activeTeamId,
                                            query,
                                        ))
                                            .results}
                                    renderAction={(result) => {
                                        const alreadyMember = memberIds.has(
                                            result.id,
                                        );
                                        const alreadyInvited = invitedIds.has(
                                            result.id,
                                        );
                                        return (
                                            <button
                                                type="button"
                                                className="mt-2 rounded-lg border border-secondary/40 px-3 py-1 text-sm font-semibold text-secondary disabled:opacity-60"
                                                onClick={() =>
                                                    void handleInvite(result)}
                                                disabled={loading ||
                                                    alreadyMember ||
                                                    alreadyInvited}
                                            >
                                                {alreadyMember
                                                    ? "Already in team"
                                                    : alreadyInvited
                                                        ? "Invite sent"
                                                        : "Invite"}
                                            </button>
                                        );
                                    }}
                                />
                            </div>

                            <div>
                                <h4 className="text-base font-semibold">
                                    Pending invites
                                </h4>
                                {invites.length === 0
                                    ? (
                                        <p className="mt-3 text-sm text-secondary/70">
                                            No pending invites.
                                        </p>
                                    )
                                    : (
                                        <div className="mt-3 flex flex-col gap-3">
                                            {invites.map((invite) => (
                                                <div
                                                    key={invite.id}
                                                    className="rounded-2xl border border-secondary/20 bg-bg p-3"
                                                >
                                                    <p className="font-semibold text-secondary">
                                                        {invite.profiles
                                                            ?.first_name}{" "}
                                                        {invite.profiles
                                                            ?.last_name}
                                                    </p>
                                                    <p className="text-xs text-secondary/70">
                                                        {invite.profiles?.email}
                                                    </p>
                                                    <button
                                                        type="button"
                                                        className="mt-2 rounded-lg border border-danger/60 px-3 py-1 text-sm font-semibold text-danger transition hover:-translate-y-0.5 hover:bg-danger hover:text-accent"
                                                        onClick={() =>
                                                            void handleRevokeInvite(
                                                                invite,
                                                            )}
                                                        disabled={loading}
                                                    >
                                                        Revoke
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                <h4 className="mt-6 text-base font-semibold">
                                    Team members
                                </h4>
                                {members.length === 0
                                    ? (
                                        <p className="mt-3 text-sm text-secondary/70">
                                            No members yet.
                                        </p>
                                    )
                                    : (
                                        <div className="mt-3 flex flex-col gap-3">
                                            {members.map((member) => {
                                                const isSelf =
                                                    member.user_id === user?.id;
                                                return (
                                                    <div
                                                        key={member.user_id}
                                                        className="rounded-2xl border border-secondary/20 bg-bg p-3"
                                                    >
                                                        <p className="font-semibold text-secondary">
                                                            {member.profiles
                                                                ?.first_name}
                                                            {" "}
                                                            {member.profiles
                                                                ?.last_name}
                                                        </p>
                                                        <p className="text-xs text-secondary/70">
                                                            {member.profiles
                                                                ?.email}
                                                        </p>
                                                        <button
                                                            type="button"
                                                            className="mt-2 rounded-lg border border-secondary/40 px-3 py-1 text-sm font-semibold text-secondary transition hover:-translate-y-0.5 hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
                                                            onClick={() =>
                                                                void handleRemoveMember(
                                                                    member,
                                                                )}
                                                            disabled={loading ||
                                                                isSelf}
                                                        >
                                                            {isSelf
                                                                ? "Owner"
                                                                : "Remove"}
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                            </div>
                        </div>
                    </div>
                )}
        </div>
    );
}

export default TeamPage;


import { Link } from "react-router-dom";

import { PageShell } from "../../../general-components";

import { useAccountLogic } from "./Account.logic";
function AccountPage() {
    const viewModel = useAccountLogic();
    if (viewModel.view === "guest") {
        return (
            <PageShell
                id="account-page"
                data-component="account-page"
                maxWidth="xl"
                className="min-w-0"
            >
                <header>
                    <h2 className="text-2xl font-semibold text-secondary">
                        Account
                    </h2>
                </header>
                <div className="rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md">
                    <h3 className="text-xl font-semibold">
                        Sign in to manage your account
                    </h3>
                    <p className="mt-2 text-sm text-secondary/70">
                        You are currently using guest mode. Sign in to view
                        invites and your teams.
                    </p>
                    <Link
                        to="/sign-in"
                        className="mt-4 inline-flex rounded-2xl bg-secondary px-4 py-2 text-sm font-semibold text-accent transition hover:-translate-y-0.5 hover:bg-accent hover:text-secondary"
                    >
                        Go to Sign In
                    </Link>
                </div>
            </PageShell>
        );
    }
    const {
        firstName,
        setFirstName,
        lastName,
        setLastName,
        location,
        setLocation,
        handleSaveProfile,
        loading,
        saveMessage,
        saveError,
        inviteError,
        invites,
        handleAcceptInvite,
        handleDeclineInvite,
        memberships,
    } = viewModel;
    return (
        <PageShell
            id="account-page"
            data-component="account-page"
            maxWidth="5xl"
            className="min-w-0"
        >
            <header>
                <h2 className="text-2xl font-semibold text-secondary">
                    Account
                </h2>
            </header>

            <div className="rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md">
                <h3 className="text-lg font-semibold">Profile</h3>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <input
                        className="rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-sm text-secondary"
                        value={firstName}
                        onChange={(event) => setFirstName(event.target.value)}
                        placeholder="First name"
                    />
                    <input
                        className="rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-sm text-secondary"
                        value={lastName}
                        onChange={(event) => setLastName(event.target.value)}
                        placeholder="Last name"
                    />
                    <input
                        className="rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-sm text-secondary"
                        value={location}
                        onChange={(event) => setLocation(event.target.value)}
                        placeholder="Default work location"
                    />
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                    <button
                        type="button"
                        className="rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-secondary"
                        onClick={handleSaveProfile}
                        disabled={loading}
                    >
                        Save Profile
                    </button>
                    {saveMessage
                        ? (
                            <span className="text-sm font-semibold text-secondary">
                                {saveMessage}
                            </span>
                        )
                        : null}
                    {saveError
                        ? (
                            <span className="text-sm font-semibold text-danger">
                                {saveError}
                            </span>
                        )
                        : null}
                </div>
            </div>

            <div className="rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md">
                <h3 className="text-lg font-semibold">Invites</h3>
                {inviteError
                    ? (
                        <p className="mt-3 text-sm font-semibold text-danger">
                            {inviteError}
                        </p>
                    )
                    : null}
                {invites.length === 0
                    ? (
                        <p className="mt-3 text-sm text-secondary/70">
                            No pending invites.
                        </p>
                    )
                    : (
                        <div className="mt-4 flex flex-col gap-3">
                            {invites.map((invite) => (
                                <div
                                    key={invite.id}
                                    className="rounded-2xl border border-secondary/20 bg-bg p-4"
                                >
                                    <p className="font-semibold text-secondary">
                                        {invite.teams?.name ?? "Team invite"}
                                    </p>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        <button
                                            type="button"
                                            className="rounded-2xl bg-secondary px-3 py-1 text-sm font-semibold text-accent transition hover:-translate-y-0.5 hover:bg-accent hover:text-secondary"
                                            onClick={() =>
                                                void handleAcceptInvite(invite)}
                                            disabled={loading}
                                        >
                                            Accept
                                        </button>
                                        <button
                                            type="button"
                                            className="rounded-2xl border border-secondary/40 px-3 py-1 text-sm font-semibold text-secondary transition hover:-translate-y-0.5 hover:bg-accent"
                                            onClick={() =>
                                                void handleDeclineInvite(
                                                    invite,
                                                )}
                                            disabled={loading}
                                        >
                                            Decline
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
            </div>

            <div className="rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md">
                <h3 className="text-lg font-semibold">My Teams</h3>
                {memberships.length === 0
                    ? (
                        <p className="mt-3 text-sm text-secondary/70">
                            No teams joined yet.
                        </p>
                    )
                    : (
                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                            {memberships.map((member) => (
                                <div
                                    key={member.team_id}
                                    className="rounded-2xl border border-secondary/20 bg-bg p-4"
                                >
                                    <p className="font-semibold text-secondary">
                                        {member.teams?.name ?? "Team"}
                                    </p>
                                    <p className="text-xs uppercase tracking-wide text-secondary/70">
                                        {member.role}
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}
            </div>
        </PageShell>
    );
}

export default AccountPage;


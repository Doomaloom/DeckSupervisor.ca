import SessionInstructorsEditor from "../session-management/components/SessionInstructorsEditor";
import { useAuth } from "../../app/AuthContext";
import SessionFormFields from "../session-management/components/SessionFormFields";
import SessionSummaryCard from "../session-management/components/SessionSummaryCard";
import { useCurrentSessionScopeSync } from "../session-management/hooks/useCurrentSessionScopeSync";
import { useManageSessionForm } from "../session-management/hooks/useManageSessionForm";

function ManageSessionsPage() {
    const { isGuest } = useAuth();
    const scopeSync = useCurrentSessionScopeSync();
    const form = useManageSessionForm({
        currentSessionId: scopeSync.currentSessionId,
        scopeVersion: scopeSync.scopeVersion,
        refreshScope: scopeSync.refreshScope,
        selectSessionAndSyncDay: scopeSync.selectSessionAndSyncDay,
    });

    return (
        <div
            id="manage-sessions-page"
            data-component="manage-sessions-page"
            className="mx-auto flex w-full max-w-6xl flex-col gap-6"
        >
            <h2 className="text-2xl font-semibold text-secondary">
                Manage Sessions
            </h2>
            {!form.currentSession
                ? (
                    <p className="mt-2 font-semibold text-secondary">
                        No session selected. Choose one from Home → Select
                        Existing Session.
                    </p>
                )
                : (
                    <form
                        className="flex flex-col gap-6"
                        onSubmit={form.handleUpdateSession}
                    >
                        <section
                            className="rounded-card border-2 border-secondary/20 bg-accent p-5 text-secondary shadow-md"
                            aria-labelledby="session-details-heading"
                        >
                            <h3
                                id="session-details-heading"
                                className="mb-4 text-xl font-semibold"
                            >
                                Session Details
                            </h3>
                            <SessionSummaryCard
                                isGuest={isGuest}
                                currentSession={form.currentSession}
                                teamName={form.teamName}
                            />
                            {!isGuest && form.access.mode !== "owner"
                                ? (
                                    <div className="rounded-2xl border border-secondary/20 bg-bg p-4 text-sm text-secondary">
                                        You are viewing a shared session.
                                        Editing is disabled.
                                    </div>
                                )
                                : (
                                    <div className="flex flex-col gap-4">
                                        <SessionFormFields
                                            seasonOptions={form.seasonOptions}
                                            sessionDay={form.editSessionDay}
                                            sessionSeason={form
                                                .editSessionSeason}
                                            sessionYear={form.editSessionYear}
                                            startDate={form.editStartDate}
                                            endDate={form.editEndDate}
                                            sessionStartTime24={form
                                                .editSessionStartTime24}
                                            sessionEndTime24={form
                                                .editSessionEndTime24}
                                            teamId={form.editTeamId}
                                            teams={form.teams}
                                            teamsLoading={form.teamsLoading}
                                            showTeamSelect={!isGuest}
                                            location={form.editLocation}
                                            sourceLocations={form
                                                .editSourceLocations}
                                            sourceLocationOptions={form
                                                .sourceLocationOptions}
                                            availableLocations={form
                                                .availableLocations}
                                            rosterFileLabel={form.editRosterFile
                                                ? form.editRosterFile.name
                                                : form.editRosterFileName ??
                                                    "Click or drop a .csv file"}
                                            locationListId="manage-session-location-options"
                                            sourceLocationsInputId="manage-session-source-location-options"
                                            onSessionDayChange={form
                                                .setEditSessionDay}
                                            onSessionSeasonChange={form
                                                .setEditSessionSeason}
                                            onSessionYearChange={form
                                                .setEditSessionYear}
                                            onStartDateChange={form
                                                .setEditStartDate}
                                            onEndDateChange={form
                                                .setEditEndDate}
                                            onSessionStartTimeChange={form
                                                .setEditSessionStartTime24}
                                            onSessionEndTimeChange={form
                                                .setEditSessionEndTime24}
                                            onTeamIdChange={form.setEditTeamId}
                                            onLocationChange={form
                                                .setEditLocation}
                                            onSourceLocationsChange={form
                                                .setEditSourceLocations}
                                            onRosterFileChange={form
                                                .setEditRosterFile}
                                        />
                                    </div>
                                )}
                        </section>
                        <SessionInstructorsEditor
                            key={form.currentSession.id}
                            sessionId={form.currentSession.id}
                            instructors={form.editInstructors}
                            isGuest={isGuest}
                            readOnly={!isGuest && form.access.mode !== "owner"}
                            loading={form.instructorsLoading}
                            error={form.instructorLoadError}
                            onRetry={form.retryLoadInstructors}
                            onCountChange={form.setInstructorCount}
                            onNameChange={form.updateEditInstructor}
                            onAccountChange={form.updateInstructorAccount}
                        />
                        {(isGuest || form.access.mode === "owner") && (
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                {form.overlapWarning
                                    ? (
                                        <div className="w-full rounded-2xl border border-secondary/20 bg-bg px-4 py-3 text-sm text-secondary">
                                            {form.overlapWarning}
                                        </div>
                                    )
                                    : null}
                                <button
                                    type="submit"
                                    className="rounded-2xl bg-primary px-5 py-2 text-white transition hover:-translate-y-0.5 hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
                                    disabled={form.isSaving ||
                                        form.instructorsLoading}
                                >
                                    {form.isSaving
                                        ? "Saving..."
                                        : "Save Changes"}
                                </button>
                                <button
                                    type="button"
                                    className="rounded-2xl bg-danger px-5 py-2 text-accent transition hover:-translate-y-0.5 hover:bg-dangerHover"
                                    onClick={form.handleDeleteSession}
                                    disabled={form.isSaving}
                                >
                                    Delete Session
                                </button>
                                {form.editMessage
                                    ? (
                                        <span
                                            className={`font-semibold ${
                                                form.editMessageTone === "error"
                                                    ? "text-danger"
                                                    : "text-primary"
                                            }`}
                                        >
                                            {form.editMessage}
                                        </span>
                                    )
                                    : null}
                            </div>
                        )}
                        {(isGuest || form.access.mode === "owner") && (
                            <p
                                role="status"
                                className="text-sm font-semibold text-secondary"
                            >
                                {form.saveStatus}
                            </p>
                        )}
                    </form>
                )}
        </div>
    );
}

export default ManageSessionsPage;

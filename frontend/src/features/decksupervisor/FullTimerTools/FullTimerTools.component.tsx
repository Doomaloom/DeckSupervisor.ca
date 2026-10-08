import { seasonOptions, useFullTimerToolsLogic } from "./FullTimerTools.logic";
function FullTimerToolsPage() {
    const viewModel = useFullTimerToolsLogic();
    const {
        currentTeamId,
        setCurrentTeamId,
        clearCurrentTerm,
        teamsLoading,
        teams,
        selectedTermYear,
        handleSelectTermYear,
        sessionsLoading,
        sessionTermYears,
        selectedTerm,
        handleSelectTermSeason,
        sessionTermsForSelectedYear,
        sessionTerms,
        currentTeam,
        selectedFile,
        setSelectedFile,
        setLastFilename,
        handleGenerate,
        isGenerating,
        lastFilename,
    } = viewModel;
    return (
        <div
            id="full-timer-tools-page"
            data-component="full-timer-tools-page"
            className="mx-auto flex w-full max-w-6xl flex-col gap-6"
        >
            <div className="relative overflow-hidden rounded-card border-2 border-secondary/20 bg-accent p-8 text-secondary shadow-md">
                <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-secondary/15" />
                <div className="absolute -bottom-12 left-10 h-24 w-24 rounded-full bg-secondary/10" />
                <div className="relative">
                    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-secondary/70">
                        Full Timer Tools
                    </p>
                    <h2 className="mt-3 text-2xl font-semibold">
                        Full Timer Tools
                    </h2>
                    <p className="mt-2 max-w-2xl text-secondary">
                        Your toolbox for running sessions. The schematic maker
                        is ready; more tools are coming next.
                    </p>
                </div>
            </div>

            <section className="flex flex-col gap-4">
                <div className="rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary/70">
                        Full Timer View Scope
                    </p>
                    <h3 className="mt-2 text-lg font-semibold">
                        Team + Session
                    </h3>
                    <p className="mt-2 text-secondary">
                        Pick the team and term you want to view. Session terms
                        are grouped by season and year, not weekday.
                    </p>
                    <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                        <label className="flex flex-col gap-2 text-sm font-semibold text-secondary">
                            Team
                            <select
                                className="rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-sm text-secondary"
                                value={currentTeamId}
                                onChange={(event) => {
                                    setCurrentTeamId(event.target.value);
                                    clearCurrentTerm();
                                }}
                                disabled={teamsLoading}
                            >
                                <option value="">Select a team</option>
                                {teams.map((team) => (
                                    <option key={team.id} value={team.id}>
                                        {team.name}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className="flex flex-col gap-2 text-sm font-semibold text-secondary">
                            Session Year
                            <select
                                className="rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-sm text-secondary"
                                value={selectedTermYear
                                    ? String(selectedTermYear)
                                    : ""}
                                onChange={(event) =>
                                    handleSelectTermYear(event.target.value)}
                                disabled={!currentTeamId || sessionsLoading ||
                                    sessionTermYears.length === 0}
                            >
                                <option value="">Select a year</option>
                                {sessionTermYears.map((year) => (
                                    <option key={year} value={String(year)}>
                                        {year}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className="flex flex-col gap-2 text-sm font-semibold text-secondary">
                            Session Season
                            <select
                                className="rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-sm text-secondary"
                                value={selectedTerm?.season ?? ""}
                                onChange={(event) =>
                                    handleSelectTermSeason(event.target.value)}
                                disabled={!currentTeamId || sessionsLoading ||
                                    sessionTermsForSelectedYear.length === 0}
                            >
                                <option value="">Select a season</option>
                                {seasonOptions.map((season) => {
                                    const normalizedSeason = season
                                        .toLowerCase();
                                    const hasSeason =
                                        sessionTermsForSelectedYear.some(
                                            (term) =>
                                                term.season ===
                                                normalizedSeason,
                                        );
                                    return (
                                        <option
                                            key={season}
                                            value={normalizedSeason}
                                            disabled={!hasSeason}
                                        >
                                            {season}
                                        </option>
                                    );
                                })}
                            </select>
                        </label>
                    </div>
                    {!currentTeamId
                        ? (
                            <p className="mt-3 text-sm text-secondary/70">
                                Select a team to load session terms.
                            </p>
                        )
                        : sessionsLoading
                            ? (
                                <p className="mt-3 text-sm text-secondary/70">
                                    Loading session terms...
                                </p>
                            )
                            : sessionTerms.length === 0
                                ? (
                                    <p className="mt-3 text-sm text-secondary/70">
                                        No term data found for this team. Make sure
                                        sessions have season + year.
                                    </p>
                                )
                                : selectedTerm
                                    ? (
                                        <p className="mt-3 text-sm font-semibold text-secondary">
                                            Current scope: {currentTeam?.name} -{" "}
                                            {selectedTerm.label}{" "}
                                            ({selectedTerm.sessionCount} day sessions)
                                        </p>
                                    )
                                    : null}
                </div>

                <div className="rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary/70">
                        Tool 1
                    </p>
                    <h3 className="mt-2 text-lg font-semibold">
                        Schematic Maker
                    </h3>
                    <p className="mt-2 text-secondary">
                        Upload the schematic maker CSV file to generate
                        location-based schedule workbooks.
                    </p>
                </div>

                <div className="rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md">
                    <div className="flex flex-col gap-4">
                        <div>
                            <p className="text-sm font-semibold text-secondary">
                                Upload CSV
                            </p>
                            <p className="mt-1 text-sm text-secondary/80">
                                Required columns: GroupName, ID, MainFacility,
                                Day, Starts, Ends, Max, Min, RegTotal,
                                PercentFilled.
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                            <label className="relative inline-flex items-center gap-2 rounded-2xl border border-secondary/40 bg-bg px-4 py-2 text-sm font-semibold text-secondary transition hover:-translate-y-0.5 hover:bg-accent">
                                <span>
                                    {selectedFile
                                        ? selectedFile.name
                                        : "Choose CSV File"}
                                </span>
                                <input
                                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                                    type="file"
                                    accept=".csv"
                                    onChange={(event) => {
                                        const file = event.target.files?.[0] ??
                                            null;
                                        setSelectedFile(file);
                                        setLastFilename(null);
                                    }}
                                />
                            </label>

                            <button
                                type="button"
                                className="rounded-2xl bg-primary px-5 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
                                onClick={handleGenerate}
                                disabled={isGenerating}
                            >
                                {isGenerating
                                    ? "Generating..."
                                    : "Generate Workbook"}
                            </button>
                        </div>

                        {lastFilename && (
                            <p className="text-sm text-secondary">
                                Downloaded:{" "}
                                <span className="font-semibold">
                                    {lastFilename}
                                </span>
                            </p>
                        )}
                    </div>
                </div>
            </section>

            <div className="rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md">
                <h3 className="text-lg font-semibold">Next Tools</h3>
                <p className="mt-2 text-secondary">
                    Tell me what should come next and I will wire it in here.
                </p>
            </div>
        </div>
    );
}

export default FullTimerToolsPage;


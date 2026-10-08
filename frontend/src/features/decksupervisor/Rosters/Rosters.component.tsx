import FullTimeSchedule from "./FullTimeSchedule/FullTimeSchedule.component";

import FullTimeRostersPanel from "../Schematic/FullTimeRostersPanel/FullTimeRostersPanel.component";

import CustomRostersPanel from "./CustomRostersPanel/CustomRostersPanel.component";

import FullTimeInstructorAssignmentsPanel from "./FullTimeInstructorAssignmentsPanel/FullTimeInstructorAssignmentsPanel.component";

import FullTimeRequestListPanel from "./FullTimeRequestListPanel/FullTimeRequestListPanel.component";

import RosterFiltersBar from "./RosterFiltersBar/RosterFiltersBar.component";

import RosterList from "./RosterList/RosterList.component";

import RostersTabs from "./RostersTabs/RostersTabs.component";

import PrintPopupBlockedNotice from "../../../components/PrintPopupBlockedNotice";

import { useRostersLogic } from "./Rosters.logic";
function RostersPage() {
    const viewModel = useRostersLogic();
    if (viewModel.view === "fullTime") {
        const {
            fullTimeUploadInputRef,
            handleFullTimeRosterUpload,
            fullTimeViewTab,
            setFullTimeViewTab,
            currentTeamId,
            fullTimeRosterFileName,
            currentTerm,
            fullTimeUploadError,
            fullTimeRosterDayOptions,
            fullTimeRosterLevelOptions,
            fullTimeDayFilter,
            fullTimeLevelFilter,
            fullTimeSearchQuery,
            handleClearFullTimeRosterAssignments,
            handleFullTimeInstructorChange,
            setFullTimeDayFilter,
            setFullTimeLevelFilter,
            setFullTimeSearchQuery,
            filteredFullTimeRosters,
            fullTimeInstructorDayKeys,
            fullTimeInstructorPeriodsByDay,
            fullTimeInstructorAssignments,
            handleFullTimeInstructorAssignmentChange,
            handleAddFullTimeInstructorAssignment,
            handleRemoveFullTimeInstructorAssignment,
            fullTimeRequestDraft,
            fullTimeRequestEntries,
            handleFullTimeRequestDraftChange,
            handleAddFullTimeRequest,
            handleImportFullTimeRequests,
            handleAutoAssignFullTimeRequests,
            handleReattemptFullTimeRequestAssignment,
            handleFullTimeRequestEntryChange,
            handleDeleteFullTimeRequest,
            fullTimeUploading,
        } = viewModel;
        return (
            <div
                id="rosters-page"
                data-component="rosters-page"
                className="mx-auto flex w-full max-w-6xl flex-col gap-6"
            >
                <input
                    ref={fullTimeUploadInputRef}
                    className="hidden"
                    type="file"
                    accept=".csv"
                    onChange={(event) => {
                        void handleFullTimeRosterUpload(
                            event.target.files?.[0] ?? null,
                        );
                        event.target.value = "";
                    }}
                />
                <header>
                    <h2 className="text-2xl font-semibold text-secondary">
                        Rosters
                    </h2>
                </header>
                <div className="rounded-card border-2 border-secondary/20 bg-accent p-4 text-secondary shadow-md md:p-6">
                    <div
                        role="group"
                        aria-label="Roster views"
                        className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,10rem),1fr))] gap-2"
                    >
                        {([
                            ["rosters", "Roster View"],
                            ["schematic", "Schematic View"],
                            ["instructors", "Instructors"],
                            ["requests", "Request List"],
                        ] as const).map(([view, label]) => (
                            <button
                                key={view}
                                type="button"
                                aria-pressed={fullTimeViewTab === view}
                                className={`min-h-11 rounded-2xl border-2 px-4 py-2 text-sm font-semibold transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${fullTimeViewTab === view
                                    ? "border-secondary bg-secondary text-accent shadow-sm"
                                    : "border-secondary/20 bg-accent text-secondary hover:border-primary hover:shadow-sm"
                                    }`}
                                onClick={() => setFullTimeViewTab(view)}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>

                {!currentTeamId
                    ? (
                        <div className="rounded-card border-2 border-secondary/30 bg-bg p-4 text-sm font-semibold text-secondary">
                            Select a team on the home page to view uploaded
                            rosters.
                        </div>
                    )
                    : (
                        <>
                            {fullTimeRosterFileName
                                ? (
                                    <div className="rounded-card border-2 border-secondary/20 bg-accent p-4 text-sm font-semibold text-secondary shadow-md">
                                        Loaded roster file:{" "}
                                        {fullTimeRosterFileName}
                                        {currentTerm?.label
                                            ? ` • Current term: ${currentTerm.label}`
                                            : ""}
                                    </div>
                                )
                                : null}
                            {fullTimeUploadError
                                ? (
                                    <div className="rounded-card border-2 border-danger/30 bg-danger/10 p-4 text-sm font-semibold text-danger">
                                        {fullTimeUploadError}
                                    </div>
                                )
                                : null}
                            {fullTimeViewTab === "rosters"
                                ? (
                                    <FullTimeRostersPanel
                                        dayOptions={fullTimeRosterDayOptions}
                                        levelOptions={fullTimeRosterLevelOptions}
                                        dayFilter={fullTimeDayFilter}
                                        levelFilter={fullTimeLevelFilter}
                                        searchQuery={fullTimeSearchQuery}
                                        onUploadRoster={() =>
                                            fullTimeUploadInputRef.current
                                                ?.click()}
                                        onClearAssignments={handleClearFullTimeRosterAssignments}
                                        onInstructorChange={handleFullTimeInstructorChange}
                                        onDayFilterChange={setFullTimeDayFilter}
                                        onLevelFilterChange={setFullTimeLevelFilter}
                                        onSearchChange={setFullTimeSearchQuery}
                                        rosters={filteredFullTimeRosters}
                                    />
                                )
                                : fullTimeViewTab === "instructors"
                                    ? (
                                        <FullTimeInstructorAssignmentsPanel
                                            dayKeys={fullTimeInstructorDayKeys}
                                            periodMap={fullTimeInstructorPeriodsByDay}
                                            assignments={fullTimeInstructorAssignments}
                                            onInstructorChange={handleFullTimeInstructorAssignmentChange}
                                            onAddInstructor={handleAddFullTimeInstructorAssignment}
                                            onRemoveInstructor={handleRemoveFullTimeInstructorAssignment}
                                        />
                                    )
                                    : fullTimeViewTab === "requests"
                                        ? (
                                            <FullTimeRequestListPanel
                                                draft={fullTimeRequestDraft}
                                                entries={fullTimeRequestEntries}
                                                onDraftChange={handleFullTimeRequestDraftChange}
                                                onAddRequest={handleAddFullTimeRequest}
                                                onImportCsv={(file) => {
                                                    void handleImportFullTimeRequests(
                                                        file,
                                                    );
                                                }}
                                                onAutoAssign={handleAutoAssignFullTimeRequests}
                                                onReattemptEntry={handleReattemptFullTimeRequestAssignment}
                                                onEntryChange={handleFullTimeRequestEntryChange}
                                                onDeleteRequest={handleDeleteFullTimeRequest}
                                            />
                                        )
                                        : (
                                            <FullTimeSchedule model={viewModel} />
                                        )}
                            {fullTimeUploading
                                ? (
                                    <p className="text-sm font-semibold text-secondary/80">
                                        Processing roster upload...
                                    </p>
                                )
                                : null}
                        </>
                    )}
            </div>
        );
    }
    const {
        activeTab,
        setActiveTab,
        blockedPrintJob,
        retryBlockedPrint,
        clearBlockedPrintJob,
        rosters,
        instructorOptions,
        customRosters,
        handlePrintRoster,
        saveCustomRosters,
        levelOptions,
        instructorFilter,
        levelFilter,
        searchQuery,
        setInstructorFilter,
        setLevelFilter,
        setSearchQuery,
        filteredRosters,
        emptyMessage,
        handleRosterLevelChange,
        updateCustomRosterLevel,
        handleStudentLevelChange,
        studentLevelEditMap,
        handleToggleStudentLevelEdits,
    } = viewModel;
    return (
        <div
            id="rosters-page"
            data-component="rosters-page"
            className="mx-auto flex w-full max-w-6xl flex-col gap-6"
        >
            <header>
                <h2 className="text-2xl font-semibold text-secondary">
                    Rosters
                </h2>
            </header>

            <RostersTabs activeTab={activeTab} onChange={setActiveTab} />
            <div className="flex flex-col gap-6">
                {blockedPrintJob
                    ? (
                        <PrintPopupBlockedNotice
                            jobLabel={blockedPrintJob.jobLabel}
                            onRetry={retryBlockedPrint}
                            onDismiss={clearBlockedPrintJob}
                        />
                    )
                    : null}
                {activeTab === "custom"
                    ? (
                        <CustomRostersPanel
                            rosters={rosters}
                            instructorOptions={instructorOptions}
                            customRosters={customRosters}
                            onPrintRoster={handlePrintRoster}
                            onSave={saveCustomRosters}
                        />
                    )
                    : (
                        <>
                            <RosterFiltersBar
                                instructorOptions={instructorOptions}
                                levelOptions={levelOptions}
                                instructorFilter={instructorFilter}
                                levelFilter={levelFilter}
                                searchQuery={searchQuery}
                                onInstructorFilterChange={setInstructorFilter}
                                onLevelFilterChange={setLevelFilter}
                                onSearchChange={setSearchQuery}
                            />
                            <RosterList
                                rosters={filteredRosters}
                                emptyMessage={emptyMessage}
                                onPrintRoster={handlePrintRoster}
                                onRosterLevelChange={handleRosterLevelChange}
                                onCustomRosterLevelChange={updateCustomRosterLevel}
                                onStudentLevelChange={handleStudentLevelChange}
                                studentLevelEditMap={studentLevelEditMap}
                                onToggleStudentLevelEdits={handleToggleStudentLevelEdits}
                            />
                        </>
                    )}
            </div>
        </div>
    );
}

export default RostersPage;


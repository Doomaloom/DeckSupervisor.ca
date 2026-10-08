import PlannerBoard from "./PlannerBoard/PlannerBoard.component";

import PlannerCallModal from "./PlannerCallModal/PlannerCallModal.component";

import PlannerDetailsPanel from "./PlannerDetailsPanel/PlannerDetailsPanel.component";

import PlannerHeader from "./PlannerHeader/PlannerHeader.component";

import PlannerPlannedChangesModal from "./PlannerPlannedChangesModal/PlannerPlannedChangesModal.component";

import { plannerBoardLayout } from "./hooks/usePlannerViewModel";

import { useSessionPlanningLogic } from "./SessionPlanning.logic";
function SessionPlanningPage() {
    const viewModel = useSessionPlanningLogic();
    const {
        dataset,
        error,
        isPopout,
        isSharedMode,
        isShareHost,
        isSharingBusy,
        shareCode,
        shareDisplayName,
        shareLocationOverrides,
        shareNotice,
        sharePhoneNumber,
        shareCcEmail,
        shareSession,
        statusMessage,
        plannedChangeGroups,
        handlePlannerImport,
        joinSharedPlanner,
        leaveSharedPlannerSession,
        loadPlannerState,
        openPopout,
        setIsPlannedChangesOpen,
        downloadPlannerState,
        setShareDisplayName,
        setShareLocationOverrides,
        setSharePhoneNumber,
        setShareCcEmail,
        saveSharedDetails,
        startSharing,
        stopSharing,
        shouldShowPlanner,
        isInfoPanelOpen,
        availableDays,
        availableLocations,
        boardColumns,
        scheduleHeightRem,
        scheduleStartMinutes,
        selectedClassKey,
        selectedDay,
        selectedLocation,
        setClassLanes,
        setIsInfoPanelOpen,
        setSelectedClassKey,
        setSelectedDay,
        setSelectedLocation,
        timeLabels,
        visibleClasses,
        alternatives,
        bookedParticipants,
        selectedClass,
        setCallRecord,
        setClassMove,
        setClassStatus,
        startCall,
        waitingParticipants,
        activeCallParticipant,
        activeCallRecord,
        callScriptMode,
        callerLocationName,
        callerName,
        callerPhoneNumber,
        plannedMoveLabel,
        closeCallModal,
        finishCall,
        setCallScriptMode,
        isPlannedChangesOpen,
        openPlannedChangeEmailDraft,
        toggleAcceptedChecklistItem,
        toggleBarcodeCancelled,
        togglePlannedChangeComplete,
        togglePlannedChangeEmailSent,
    } = viewModel;
    return (
        <div
            id="session-planning-page"
            data-component="session-planning-page"
            className="mx-auto flex w-full max-w-7xl flex-col gap-6"
        >
            <header>
                <h2 className="text-2xl font-semibold text-secondary">
                    Session Planning
                </h2>
            </header>
            <PlannerHeader
                dataset={dataset}
                error={error}
                isPopout={isPopout}
                isSharedMode={isSharedMode}
                isShareHost={isShareHost}
                isSharingBusy={isSharingBusy}
                shareCode={shareCode}
                shareDisplayName={shareDisplayName}
                shareLocationOverrides={shareLocationOverrides}
                shareNotice={shareNotice}
                sharePhoneNumber={sharePhoneNumber}
                shareCcEmail={shareCcEmail}
                shareSession={shareSession}
                statusMessage={statusMessage}
                showPlannedChangesButton={plannedChangeGroups.length > 0}
                onHandleImport={handlePlannerImport}
                onJoinSharedPlanner={joinSharedPlanner}
                onLeaveSharedPlannerSession={leaveSharedPlannerSession}
                onLoadState={loadPlannerState}
                onOpenPopout={openPopout}
                onOpenPlannedChanges={() => setIsPlannedChangesOpen(true)}
                onSaveState={downloadPlannerState}
                onSetShareDisplayName={setShareDisplayName}
                onSetShareLocationOverride={(facility, value) =>
                    setShareLocationOverrides((current) => ({
                        ...current,
                        [facility]: value,
                    }))}
                onSetSharePhoneNumber={setSharePhoneNumber}
                onSetShareCcEmail={setShareCcEmail}
                onSaveSharedDetails={saveSharedDetails}
                onStartSharing={startSharing}
                onStopSharing={stopSharing}
            />

            {!shouldShowPlanner
                ? (
                    <div className="rounded-card border-2 border-secondary/20 bg-accent p-8 text-secondary shadow-md">
                        <p className="text-base text-secondary/80">
                            {shareCode
                                ? "Join the shared planner to start collaborating."
                                : "Upload the matching activity summary and roster CSVs to start planning."}
                        </p>
                    </div>
                )
                : (
                    <div
                        className={`grid gap-6 ${isInfoPanelOpen
                            ? "xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]"
                            : ""
                            }`}
                    >
                        <PlannerBoard
                            availableDays={availableDays}
                            availableLocations={availableLocations}
                            boardColumns={boardColumns}
                            scheduleHeightRem={scheduleHeightRem}
                            scheduleStartMinutes={scheduleStartMinutes}
                            selectedClassKey={selectedClassKey}
                            selectedDay={selectedDay}
                            selectedLocation={selectedLocation}
                            setClassLanes={setClassLanes}
                            setIsInfoPanelOpen={setIsInfoPanelOpen}
                            setSelectedClassKey={setSelectedClassKey}
                            setSelectedDay={setSelectedDay}
                            setSelectedLocation={setSelectedLocation}
                            timeLabels={timeLabels}
                            visibleClasses={visibleClasses}
                            {...plannerBoardLayout}
                        />

                        <PlannerDetailsPanel
                            alternatives={alternatives}
                            bookedParticipants={bookedParticipants}
                            dataset={dataset}
                            isInfoPanelOpen={isInfoPanelOpen}
                            selectedClass={selectedClass}
                            setCallRecord={setCallRecord}
                            setClassMove={setClassMove}
                            setClassStatus={setClassStatus}
                            setIsInfoPanelOpen={setIsInfoPanelOpen}
                            startCall={startCall}
                            waitingParticipants={waitingParticipants}
                        />
                    </div>
                )}

            <PlannerCallModal
                activeCallParticipant={activeCallParticipant}
                activeCallRecord={activeCallRecord}
                alternatives={alternatives}
                callScriptMode={callScriptMode}
                callerLocationName={callerLocationName}
                callerName={callerName}
                callerPhoneNumber={callerPhoneNumber}
                plannedMoveLabel={plannedMoveLabel}
                onClose={closeCallModal}
                onFinishCall={finishCall}
                onSetCallRecord={setCallRecord}
                onSetCallScriptMode={setCallScriptMode}
                selectedClass={selectedClass}
            />

            {isPlannedChangesOpen && dataset
                ? (
                    <PlannerPlannedChangesModal
                        dataset={dataset}
                        groups={plannedChangeGroups}
                        onClose={() => setIsPlannedChangesOpen(false)}
                        onOpenEmailDraft={openPlannedChangeEmailDraft}
                        onToggleAcceptedChecklistItem={toggleAcceptedChecklistItem}
                        onToggleBarcodeCancelled={toggleBarcodeCancelled}
                        onToggleComplete={togglePlannedChangeComplete}
                        onToggleEmailSent={togglePlannedChangeEmailSent}
                    />
                )
                : null}
        </div>
    );
}

export default SessionPlanningPage;


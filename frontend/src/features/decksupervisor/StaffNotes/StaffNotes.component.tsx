import { PageShell } from "../../../general-components";

import NoteTab from "./NoteTab/NoteTab.component";

import ReportTab from "./report/ReportTab/ReportTab.component";

import TabBar from "./TabBar/TabBar.component";

import TodoTab from "./TodoTab/TodoTab.component";

import { useStaffNotesLogic } from "./StaffNotes.logic";
function StaffNotesPage() {
    const viewModel = useStaffNotesLogic();
    const {
        isSessionReady,
        isFullTime,
        visibleTabs,
        activeTab,
        setActiveTab,
        activeConfig,
        isEditable,
        todoText,
        setTodoText,
        handleAddTodo,
        isAddTodoDisabled,
        todos,
        canEditEntry,
        listEmptyLabel,
        handleToggleTodo,
        handleDeleteTodo,
        reports,
        activeReportId,
        handleSelectReport,
        canCreateReports,
        handleCreateReport,
        selectedReport,
        canEditSelectedReport,
        handleDeleteReport,
        handleExportReport,
        isExportingReport,
        reportStatus,
        reportTitle,
        handleReportTitleChange,
        isReportInputDisabled,
        reportDraft,
        updateReportDraft,
        reportInstructorOptions,
        instructorNames,
        employeeName,
        setEmployeeName,
        noteText,
        setNoteText,
        handleAddNote,
        isAddNoteDisabled,
        notes,
        handleDeleteNote,
    } = viewModel;
    return (
        <PageShell
            id="staff-notes-page"
            data-component="staff-notes-page"
            maxWidth="5xl"
            className="min-w-0"
        >
            <header>
                <h2 className="text-2xl font-semibold text-secondary">Notes</h2>
            </header>

            {!isSessionReady
                ? (
                    <div className="rounded-card border-2 border-secondary/30 bg-bg p-4 text-sm font-semibold text-secondary">
                        {isFullTime
                            ? "Select a team and session term on Home to view notes."
                            : "Select a session to add notes."}
                    </div>
                )
                : null}

            <div className="rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md">
                <TabBar
                    visibleTabs={visibleTabs}
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                />

                <div className="mt-6">
                    {activeConfig.type === "todo"
                        ? (
                            <TodoTab
                                isSessionReady={isSessionReady}
                                isEditable={isEditable}
                                todoText={todoText}
                                setTodoText={setTodoText}
                                onAddTodo={handleAddTodo}
                                isAddTodoDisabled={isAddTodoDisabled}
                                todos={todos}
                                canEditEntry={canEditEntry}
                                listEmptyLabel={listEmptyLabel}
                                onToggleTodo={handleToggleTodo}
                                onDeleteTodo={handleDeleteTodo}
                            />
                        )
                        : activeConfig.type === "report"
                            ? (
                                <ReportTab
                                    isSessionReady={isSessionReady}
                                    reports={reports}
                                    activeReportId={activeReportId}
                                    onSelectReport={handleSelectReport}
                                    canCreateReports={canCreateReports}
                                    onCreateReport={handleCreateReport}
                                    selectedReport={selectedReport}
                                    canEditSelectedReport={canEditSelectedReport}
                                    onDeleteReport={handleDeleteReport}
                                    onExportReport={handleExportReport}
                                    isExportingReport={isExportingReport}
                                    reportStatus={reportStatus}
                                    reportTitle={reportTitle}
                                    onReportTitleChange={handleReportTitleChange}
                                    isReportInputDisabled={isReportInputDisabled}
                                    listEmptyLabel={listEmptyLabel}
                                    reportDraft={reportDraft}
                                    updateReportDraft={updateReportDraft}
                                    reportInstructorOptions={reportInstructorOptions}
                                />
                            )
                            : (
                                <NoteTab
                                    isSessionReady={isSessionReady}
                                    isEditable={isEditable}
                                    isFullTime={isFullTime}
                                    showEmployee={Boolean(
                                        activeConfig.showEmployee,
                                    )}
                                    instructorNames={instructorNames}
                                    employeeName={employeeName}
                                    setEmployeeName={setEmployeeName}
                                    noteText={noteText}
                                    setNoteText={setNoteText}
                                    onAddNote={handleAddNote}
                                    isAddNoteDisabled={isAddNoteDisabled}
                                    notes={notes}
                                    canEditEntry={canEditEntry}
                                    listEmptyLabel={listEmptyLabel}
                                    onDeleteNote={handleDeleteNote}
                                />
                            )}
                </div>
            </div>
        </PageShell>
    );
}

export default StaffNotesPage;


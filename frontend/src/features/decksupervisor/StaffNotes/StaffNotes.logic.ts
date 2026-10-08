import { useEffect, useMemo, useState } from "react";

import { useAuth } from "../../../app/AuthContext";

import { useCurrentSession } from "../../../app/useCurrentSession";

import { useCurrentTeam } from "../../../app/useCurrentTeam";

import { useCurrentTerm } from "../../../app/useCurrentTerm";

import { getCurrentSessionId } from "../../../lib/sessionStorage";

import { showAppNotice } from "../../../lib/appNotice";

import { createSessionNote, deleteSessionNote, fetchSessionNotes, fetchSessionReports, type StaffEntry, type StaffEntryScope, updateSessionNote, } from "../../../lib/serverApi";

import { useSessionInstructors } from "../Print/hooks/useSessionInstructors";

import { formatSessionContext, tabs } from "./constants";

import { useSessionReports } from "./hooks/useSessionReports";

import type { NoteItem, ReportItem, TabKey, TodoItem } from "./types";

import { normalizeReportData } from "./utils/reportData";

import { buildStorageKey, loadJson, saveJson } from "./utils/storage";

export const createId = () =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
export function useStaffNotesLogic() {
    const { accountType, isGuest, user } = useAuth();
    const { sessionId: currentSessionId, session: currentSession, access } =
        useCurrentSession();
    const { currentTeamId } = useCurrentTeam();
    const { currentTerm } = useCurrentTerm();
    const isFullTime = accountType === "full_time";
    const sessionId = isGuest ? getCurrentSessionId() : currentSessionId;
    const isSessionReady = isFullTime
        ? Boolean(currentTeamId && currentTerm)
        : Boolean(sessionId);
    const instructorNames = useSessionInstructors(true);
    const [activeTab, setActiveTab] = useState<TabKey>("general");
    const [notes, setNotes] = useState<NoteItem[]>([]);
    const [todos, setTodos] = useState<TodoItem[]>([]);
    const [noteText, setNoteText] = useState("");
    const [employeeName, setEmployeeName] = useState("");
    const [todoText, setTodoText] = useState("");

    const currentSessionContext = useMemo(
        () =>
            formatSessionContext(
                currentSession?.session_day ?? null,
                currentSession?.location ?? null,
                currentSession?.session_season ?? null,
                currentSession?.session_year ?? null,
                currentSession?.start_date ?? null,
            ),
        [
            currentSession?.location,
            currentSession?.session_day,
            currentSession?.session_season,
            currentSession?.session_year,
            currentSession?.start_date,
        ],
    );

    const {
        reports,
        activeReportId,
        reportTitle,
        reportDraft,
        reportStatus,
        selectedReport,
        canCreateReports,
        canEditSelectedReport,
        isReportInputDisabled,
        reportInstructorOptions,
        updateReportDraft,
        handleReportTitleChange,
        handleSelectReport,
        handleCreateReport,
        handleDeleteReport,
        handleExportReport,
        isExportingReport,
        setLoadedReports,
        clearReports,
    } = useSessionReports({
        activeTab,
        sessionId,
        currentSessionContext,
        isSessionReady,
        isGuest,
        isFullTime,
        userId: user?.id ?? null,
        accessMode: access.mode,
        instructorNames,
    });

    const activeConfig = useMemo(
        () => tabs.find((tab) => tab.key === activeTab) ?? tabs[0],
        [activeTab],
    );

    const visibleTabs = useMemo(
        () => (isFullTime ? tabs.filter((tab) => tab.key !== "todo") : tabs),
        [isFullTime],
    );

    useEffect(() => {
        if (visibleTabs.some((tab) => tab.key === activeTab)) {
            return;
        }
        setActiveTab(visibleTabs[0]?.key ?? "general");
    }, [activeTab, visibleTabs]);

    useEffect(() => {
        if (!sessionId) {
            setNotes([]);
            setTodos([]);
            clearReports();
            if (!isFullTime) {
                return;
            }
        }
        if (isGuest) {
            const storageKey = buildStorageKey(sessionId, activeTab);
            if (activeTab === "todo") {
                setTodos(loadJson<TodoItem[]>(storageKey, []));
                setNotes([]);
                clearReports();
            } else if (activeTab === "report") {
                const stored = loadJson<ReportItem[]>(storageKey, []);
                const normalized = stored
                    .map((item) => {
                        const createdAt = item.createdAt ||
                            new Date().toISOString();
                        const updatedAt = item.updatedAt || createdAt;
                        return {
                            id: item.id,
                            createdAt,
                            updatedAt,
                            title: item.title || "Untitled report",
                            reportData: normalizeReportData(
                                item.reportData,
                                instructorNames,
                            ),
                            createdBy: item.createdBy,
                            authorName: item.authorName ?? "Guest",
                            sessionContext: item.sessionContext ||
                                currentSessionContext ||
                                undefined,
                        };
                    })
                    .sort((a, b) =>
                        new Date(b.updatedAt).getTime() -
                        new Date(a.updatedAt).getTime()
                    );
                setLoadedReports(normalized);
                setNotes([]);
                setTodos([]);
            } else {
                setNotes(loadJson<NoteItem[]>(storageKey, []));
                setTodos([]);
                clearReports();
            }
            return;
        }

        if (isFullTime && (!currentTeamId || !currentTerm)) {
            setNotes([]);
            setTodos([]);
            clearReports();
            return;
        }
        const scope: StaffEntryScope = isFullTime
            ? {
                teamId: currentTeamId!,
                season: currentTerm!.season,
                year: currentTerm!.year,
            }
            : { sessionId: sessionId! };
        let active = true;
        setNotes([]);
        setTodos([]);
        clearReports();
        const authorName = (row: StaffEntry) => {
            const author = row.author;
            return author
                ? `${author.first_name ?? ""} ${author.last_name ?? ""}`
                    .trim() ||
                author.email || "Unknown author"
                : "Unknown author";
        };
        const sessionContext = (row: StaffEntry) =>
            row.session
                ? formatSessionContext(
                    row.session.session_day,
                    row.session.location,
                    row.session.session_season,
                    row.session.session_year,
                    row.session.start_date,
                )
                : currentSessionContext;
        const loadFromDb = async () => {
            try {
                if (activeTab === "report") {
                    const { reports: rows } = await fetchSessionReports(scope);
                    if (!active) return;
                    setLoadedReports(rows.map((row) => ({
                        id: row.id,
                        createdAt: row.created_at,
                        updatedAt: row.updated_at ?? row.created_at,
                        title: row.title || "Untitled report",
                        reportData: normalizeReportData(
                            row.report_data,
                            isFullTime ? [] : instructorNames,
                        ),
                        createdBy: row.created_by,
                        authorName: authorName(row),
                        sessionContext: sessionContext(row) || undefined,
                    })));
                    return;
                }
                const { notes: rows } = await fetchSessionNotes(scope);
                if (!active) return;
                const filtered = rows.filter((row) =>
                    row.note_type === activeTab
                );
                if (activeTab === "todo") {
                    setTodos(
                        filtered.map((row) => ({
                            id: row.id,
                            createdAt: row.created_at,
                            createdBy: row.created_by,
                            text: row.text,
                            done: row.done ?? false,
                        })),
                    );
                } else {
                    setNotes(filtered.map((row) => ({
                        id: row.id,
                        createdAt: row.created_at,
                        createdBy: row.created_by,
                        text: row.text,
                        employeeName: row.employee_name ?? undefined,
                        authorName: isFullTime ? authorName(row) : undefined,
                        sessionContext: isFullTime
                            ? sessionContext(row) || undefined
                            : undefined,
                    })));
                }
            } catch (error) {
                if (active) {
                    showAppNotice(
                        `Failed to load ${activeTab === "report" ? "reports" : "notes"
                        }: ${error instanceof Error
                            ? error.message
                            : "Unknown error"
                        }`,
                        "error",
                    );
                }
            }
        };
        void loadFromDb();
        return () => {
            active = false;
        };
    }, [
        activeTab,
        clearReports,
        currentTeamId,
        currentTerm,
        currentSessionContext,
        instructorNames,
        isFullTime,
        isGuest,
        sessionId,
        setLoadedReports,
    ]);

    useEffect(() => {
        if (!employeeName) {
            return;
        }
        if (!instructorNames.includes(employeeName)) {
            setEmployeeName("");
        }
    }, [employeeName, instructorNames]);

    const handleAddNote = async () => {
        if (!sessionId) {
            return;
        }
        if (activeConfig.type !== "note") {
            return;
        }
        const trimmed = noteText.trim();
        if (!trimmed) {
            return;
        }
        const entry: NoteItem = {
            id: createId(),
            createdAt: new Date().toISOString(),
            text: trimmed,
            employeeName: employeeName.trim() || undefined,
        };
        if (isGuest) {
            const next = [entry, ...notes];
            setNotes(next);
            saveJson(buildStorageKey(sessionId, activeTab), next);
        } else if (
            user?.id && (access.mode === "owner" || access.mode === "shared")
        ) {
            try {
                const { note: data } = await createSessionNote({
                    session_id: sessionId,
                    note_type: activeTab,
                    text: trimmed,
                    employee_name: employeeName.trim() || null,
                });
                if (!data) {
                    return;
                }
                setNotes((current) => [
                    {
                        id: data.id,
                        createdAt: data.created_at,
                        createdBy: data.created_by,
                        text: data.text,
                        employeeName: data.employee_name ?? undefined,
                    },
                    ...current,
                ]);
            } catch (error) {
                console.error("Failed to add note", error);
                showAppNotice(
                    `Failed to add note: ${error instanceof Error ? error.message : "Unknown error"
                    }`,
                    "error",
                );
                return;
            }
        }
        setNoteText("");
        setEmployeeName("");
    };

    const handleDeleteNote = async (id: string) => {
        if (!sessionId) {
            return;
        }
        if (isGuest) {
            const next = notes.filter((item) => item.id !== id);
            setNotes(next);
            saveJson(buildStorageKey(sessionId, activeTab), next);
            return;
        }
        try {
            await deleteSessionNote(id);
            setNotes((current) => current.filter((item) => item.id !== id));
        } catch (error) {
            showAppNotice(
                `Failed to delete note: ${error instanceof Error ? error.message : "Unknown error"
                }`,
                "error",
            );
        }
    };

    const handleAddTodo = async () => {
        if (!sessionId) {
            return;
        }
        const trimmed = todoText.trim();
        if (!trimmed) {
            return;
        }
        const entry: TodoItem = {
            id: createId(),
            createdAt: new Date().toISOString(),
            text: trimmed,
            done: false,
        };
        if (isGuest) {
            const next = [entry, ...todos];
            setTodos(next);
            saveJson(buildStorageKey(sessionId, activeTab), next);
        } else if (
            user?.id && (access.mode === "owner" || access.mode === "shared")
        ) {
            try {
                const { note: data } = await createSessionNote({
                    session_id: sessionId,
                    note_type: "todo",
                    text: trimmed,
                    done: false,
                });
                if (!data) {
                    return;
                }
                setTodos((current) => [
                    {
                        id: data.id,
                        createdAt: data.created_at,
                        createdBy: data.created_by,
                        text: data.text,
                        done: data.done ?? false,
                    },
                    ...current,
                ]);
            } catch (error) {
                console.error("Failed to add todo", error);
                showAppNotice(
                    `Failed to add todo: ${error instanceof Error ? error.message : "Unknown error"
                    }`,
                    "error",
                );
                return;
            }
        }
        setTodoText("");
    };

    const handleToggleTodo = async (id: string) => {
        if (!sessionId) {
            return;
        }
        if (isGuest) {
            const next = todos.map(
                (
                    item,
                ) => (item.id === id ? { ...item, done: !item.done } : item),
            );
            setTodos(next);
            saveJson(buildStorageKey(sessionId, activeTab), next);
            return;
        }
        const target = todos.find((item) => item.id === id);
        if (!target) return;
        try {
            const { note } = await updateSessionNote(id, {
                done: !target.done,
            });
            setTodos((current) =>
                current.map((item) =>
                    item.id === id ? { ...item, done: note.done } : item
                )
            );
        } catch (error) {
            showAppNotice(
                `Failed to update todo: ${error instanceof Error ? error.message : "Unknown error"
                }`,
                "error",
            );
        }
    };

    const handleDeleteTodo = async (id: string) => {
        if (!sessionId) {
            return;
        }
        if (isGuest) {
            const next = todos.filter((item) => item.id !== id);
            setTodos(next);
            saveJson(buildStorageKey(sessionId, activeTab), next);
            return;
        }
        try {
            await deleteSessionNote(id);
            setTodos((current) => current.filter((item) => item.id !== id));
        } catch (error) {
            showAppNotice(
                `Failed to delete todo: ${error instanceof Error ? error.message : "Unknown error"
                }`,
                "error",
            );
        }
    };

    const canWriteDbNotes = !isFullTime && Boolean(user?.id) &&
        (access.mode === "owner" || access.mode === "shared");
    const isEditable = isGuest || canWriteDbNotes;
    const canEditEntry = (createdBy?: string) =>
        isGuest ||
        (canWriteDbNotes &&
            (access.mode === "owner" || createdBy === user?.id));

    const listEmptyLabel = activeConfig.type === "todo"
        ? "No todo items yet."
        : activeConfig.type === "report"
            ? isFullTime
                ? "No team member reports found for the selected term."
                : "No reports yet."
            : isFullTime
                ? "No team member notes found for this tab in the selected term."
                : "No notes yet.";
    const isAddNoteDisabled = !isSessionReady || noteText.trim() === "" ||
        !isEditable;
    const isAddTodoDisabled = !isSessionReady || todoText.trim() === "" ||
        !isEditable;

    return {
        view: "ready" as const,
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
    };

}

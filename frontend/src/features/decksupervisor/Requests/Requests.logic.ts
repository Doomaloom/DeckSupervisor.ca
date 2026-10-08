import { useEffect, useMemo, useState } from "react";

import { createRequestAssignment, deleteRequestAssignment, fetchCsvAnalyze, fetchRequestAssignments, updateRequestAssignment, } from "../../../lib/serverApi";

import type { ClassRoster, RequestAssignment } from "../../../types/app";

import { analyzeInstructorRequests, parseRequestsCsv, type RequestsAnalysisResult, } from "./requestsAnalysis";

import { buildAssignmentKey, buildRosterClassKey, sortAssignments } from "./utils/assignmentKeys";

export type LoadedRequestsFile = {
    file: File;
    rows: ReturnType<typeof parseRequestsCsv>;
};

export type LoadedRosterFile = {
    file: File;
    classes: ClassRoster[];
    defaultTerm: string;
    classTerms: Record<string, string>;
};

export type AssignmentDraft = {
    id: string;
    eventId: string;
    term: string;
    location: string;
    instructor: string;
};

export const emptyAssignmentDraft: AssignmentDraft = {
    id: "",
    eventId: "",
    term: "",
    location: "",
    instructor: "",
};

export function tabButtonClass(active: boolean) {
    return [
        "rounded-2xl border px-4 py-2 text-sm font-semibold transition",
        active
            ? "border-secondary bg-secondary text-accent"
            : "border-secondary/30 bg-bg text-secondary hover:bg-accent",
    ].join(" ");
}
export function useRequestsLogic() {
    const [activeTab, setActiveTab] = useState<"summary" | "assignments">(
        "summary",
    );
    const [requestsFile, setRequestsFile] = useState<LoadedRequestsFile | null>(
        null,
    );
    const [rosterFile, setRosterFile] = useState<LoadedRosterFile | null>(null);
    const [analysis, setAnalysis] = useState<RequestsAnalysisResult | null>(
        null,
    );
    const [assignments, setAssignments] = useState<RequestAssignment[]>([]);
    const [assignmentDraft, setAssignmentDraft] = useState<AssignmentDraft>(
        emptyAssignmentDraft,
    );
    const [error, setError] = useState("");
    const [status, setStatus] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [assignmentsLoading, setAssignmentsLoading] = useState(false);
    const [assignmentSaving, setAssignmentSaving] = useState(false);

    useEffect(() => {
        let active = true;
        const loadAssignments = async () => {
            setAssignmentsLoading(true);
            try {
                const response = await fetchRequestAssignments();
                if (!active) {
                    return;
                }
                setAssignments(sortAssignments(response.assignments ?? []));
            } catch (loadError) {
                console.error(loadError);
                if (!active) {
                    return;
                }
                setError(
                    loadError instanceof Error
                        ? loadError.message
                        : "Failed to load request assignments.",
                );
            } finally {
                if (active) {
                    setAssignmentsLoading(false);
                }
            }
        };

        void loadAssignments();
        return () => {
            active = false;
        };
    }, []);

    const availableDays = useMemo(
        () => analysis?.days.map((entry) => entry.day) ?? [],
        [analysis],
    );
    const autoAssignmentCandidates = useMemo(() => {
        if (!analysis || !rosterFile) {
            return [];
        }

        const existingKeys = new Set(
            assignments.map((assignment) =>
                buildAssignmentKey(
                    assignment.eventId,
                    assignment.term,
                    assignment.location,
                )
            ),
        );

        return analysis.days.flatMap((dayGroup) =>
            dayGroup.classes.flatMap((classSummary) => {
                const instructor =
                    classSummary.instructorCounts[0]?.instructor?.trim() ?? "";
                const location = classSummary.location.trim();
                const term = rosterFile
                    .classTerms[
                    buildRosterClassKey(
                        dayGroup.day,
                        classSummary.eventId,
                        classSummary.location,
                    )
                ] ??
                    rosterFile.defaultTerm ??
                    "";
                if (
                    !classSummary.eventId.trim() || !instructor || !location ||
                    !term.trim()
                ) {
                    return [];
                }
                const key = buildAssignmentKey(
                    classSummary.eventId,
                    term,
                    location,
                );
                if (existingKeys.has(key)) {
                    return [];
                }
                existingKeys.add(key);
                return [{
                    eventId: classSummary.eventId.trim(),
                    term: term.trim(),
                    location,
                    instructor,
                }];
            })
        );
    }, [analysis, assignments, rosterFile]);

    const handleRequestsUpload = async (file: File | null) => {
        if (!file) {
            return;
        }

        setError("");
        setStatus("Reading requests CSV...");
        setAnalysis(null);

        try {
            const text = await file.text();
            const rows = parseRequestsCsv(text);
            setRequestsFile({ file, rows });
            setStatus(`Loaded ${rows.length} request rows from ${file.name}.`);
        } catch (uploadError) {
            console.error(uploadError);
            setRequestsFile(null);
            setStatus("");
            setError(
                uploadError instanceof Error
                    ? uploadError.message
                    : "Unable to read the requests CSV.",
            );
        }
    };

    const handleRosterUpload = async (file: File | null) => {
        if (!file) {
            return;
        }

        setError("");
        setStatus("Processing roster/export CSV...");
        setAnalysis(null);
        setIsLoading(true);

        try {
            const analyzed = await fetchCsvAnalyze(file);
            const classes = analyzed.rosters ?? [];
            const extracted = analyzed.extracted;
            const classTerms: Record<string, string> = {};
            const termSet = new Set<string>();
            (extracted.sessions ?? []).forEach((session) => {
                const term = [
                    session.sessionSeason.trim(),
                    session.sessionYear > 0 ? String(session.sessionYear) : "",
                ]
                    .filter(Boolean)
                    .join(" ");
                if (term) {
                    termSet.add(term);
                }
                (extracted.classesBySession?.[session.sessionKey] ?? [])
                    .forEach(
                        (classEntry) => {
                            classTerms[
                                buildRosterClassKey(
                                    classEntry.dayOfWeek,
                                    classEntry.courseCode,
                                    classEntry.location,
                                )
                            ] = term;
                        },
                    );
            });

            setRosterFile({
                file,
                classes,
                defaultTerm: Array.from(termSet)[0] ?? "",
                classTerms,
            });
            setStatus(`Loaded ${classes.length} classes from ${file.name}.`);
        } catch (uploadError) {
            console.error(uploadError);
            setRosterFile(null);
            setStatus("");
            setError(
                uploadError instanceof Error
                    ? uploadError.message
                    : "Unable to process the roster CSV.",
            );
        } finally {
            setIsLoading(false);
        }
    };

    const handleAnalyze = () => {
        if (!requestsFile) {
            setError("Upload the requests CSV first.");
            return;
        }
        if (!rosterFile) {
            setError("Upload the roster/export CSV first.");
            return;
        }

        setError("");
        setStatus("Building request summary...");
        const result = analyzeInstructorRequests(
            requestsFile.rows,
            rosterFile.classes,
        );
        setAnalysis(result);

        if (result.days.length === 0) {
            setStatus(
                "No matching classes were found for the uploaded requests.",
            );
            return;
        }

        setStatus(
            `Matched ${result.matchedDayEntries} request entries across ${result.days.length} day${result.days.length === 1 ? "" : "s"
            }.`,
        );
    };

    const beginAssignmentDraft = (draft: Partial<AssignmentDraft>) => {
        setAssignmentDraft((current) => ({
            ...current,
            ...draft,
        }));
        setActiveTab("assignments");
    };

    const handleAddFromSummary = (
        day: string,
        classSummary: RequestsAnalysisResult["days"][number]["classes"][number],
    ) => {
        const key = buildRosterClassKey(
            day,
            classSummary.eventId,
            classSummary.location,
        );
        const term = rosterFile?.classTerms[key] ?? rosterFile?.defaultTerm ??
            "";
        const existing = assignments.find(
            (assignment) =>
                assignment.eventId === classSummary.eventId &&
                assignment.location === classSummary.location &&
                assignment.term === term,
        );
        const topInstructor = classSummary.instructorCounts[0]?.instructor ??
            "";

        beginAssignmentDraft(
            existing
                ? {
                    id: existing.id,
                    eventId: existing.eventId,
                    term: existing.term,
                    location: existing.location,
                    instructor: existing.instructor,
                }
                : {
                    id: "",
                    eventId: classSummary.eventId,
                    term,
                    location: classSummary.location,
                    instructor: topInstructor,
                },
        );
        setStatus(
            existing
                ? "Loaded existing assignment for editing."
                : "Assignment draft created from summary.",
        );
        setError("");
    };

    const handleEditAssignment = (assignment: RequestAssignment) => {
        beginAssignmentDraft({
            id: assignment.id,
            eventId: assignment.eventId,
            term: assignment.term,
            location: assignment.location,
            instructor: assignment.instructor,
        });
        setStatus("Assignment loaded for editing.");
        setError("");
    };

    const resetAssignmentDraft = () => {
        setAssignmentDraft(emptyAssignmentDraft);
    };

    const handleSaveAssignment = async (
        event: React.FormEvent<HTMLFormElement>,
    ) => {
        event.preventDefault();

        const eventId = assignmentDraft.eventId.trim();
        const term = assignmentDraft.term.trim();
        const location = assignmentDraft.location.trim();
        const instructor = assignmentDraft.instructor.trim();

        if (!eventId || !term || !location || !instructor) {
            setError(
                "Event ID, term, location, and instructor are all required.",
            );
            return;
        }

        setError("");
        setAssignmentSaving(true);
        try {
            const response = assignmentDraft.id
                ? await updateRequestAssignment(assignmentDraft.id, {
                    eventId,
                    term,
                    location,
                    instructor,
                })
                : await createRequestAssignment({
                    eventId,
                    term,
                    location,
                    instructor,
                });
            const nextAssignment = response.assignment;
            setAssignments((current) => {
                const filtered = current.filter((assignment) =>
                    assignment.id !== nextAssignment.id
                );
                return sortAssignments([...filtered, nextAssignment]);
            });
            resetAssignmentDraft();
            setStatus(
                assignmentDraft.id
                    ? "Assignment updated."
                    : "Assignment saved.",
            );
        } catch (saveError) {
            console.error(saveError);
            setError(
                saveError instanceof Error
                    ? saveError.message
                    : "Failed to save assignment.",
            );
        } finally {
            setAssignmentSaving(false);
        }
    };

    const handleDeleteAssignment = async (assignment: RequestAssignment) => {
        if (
            !confirm(
                `Delete assignment for ${assignment.eventId} (${assignment.term})?`,
            )
        ) {
            return;
        }

        setError("");
        setAssignmentSaving(true);
        try {
            await deleteRequestAssignment(assignment.id);
            setAssignments((current) =>
                current.filter((entry) => entry.id !== assignment.id)
            );
            if (assignmentDraft.id === assignment.id) {
                resetAssignmentDraft();
            }
            setStatus("Assignment deleted.");
        } catch (deleteError) {
            console.error(deleteError);
            setError(
                deleteError instanceof Error
                    ? deleteError.message
                    : "Failed to delete assignment.",
            );
        } finally {
            setAssignmentSaving(false);
        }
    };

    const handleAutoAssignMissing = async () => {
        if (autoAssignmentCandidates.length === 0) {
            setStatus(
                "No missing assignments were found in the current summary.",
            );
            setError("");
            return;
        }

        setError("");
        setAssignmentSaving(true);

        const created: RequestAssignment[] = [];
        const failures: string[] = [];

        for (const candidate of autoAssignmentCandidates) {
            try {
                const response = await createRequestAssignment(candidate);
                created.push(response.assignment);
            } catch (saveError) {
                console.error(saveError);
                failures.push(
                    `${candidate.eventId} (${candidate.term} • ${candidate.location})`,
                );
            }
        }

        if (created.length > 0) {
            setAssignments((current) =>
                sortAssignments([...current, ...created])
            );
        }

        if (failures.length > 0) {
            setError(
                `Failed to save ${failures.length} assignment${failures.length === 1 ? "" : "s"
                }: ${failures.join(", ")}`,
            );
        }

        setStatus(
            failures.length > 0
                ? `Saved ${created.length} missing assignment${created.length === 1 ? "" : "s"
                }.`
                : `Saved ${created.length} missing assignment${created.length === 1 ? "" : "s"
                } automatically.`,
        );
        setAssignmentSaving(false);
    };

    return {
        view: "ready" as const,
        activeTab,
        setActiveTab,
        handleAnalyze,
        requestsFile,
        rosterFile,
        isLoading,
        handleRequestsUpload,
        handleRosterUpload,
        status,
        error,
        analysis,
        autoAssignmentCandidates,
        handleAutoAssignMissing,
        assignmentSaving,
        availableDays,
        handleAddFromSummary,
        handleSaveAssignment,
        assignmentDraft,
        setAssignmentDraft,
        resetAssignmentDraft,
        assignments,
        assignmentsLoading,
        handleEditAssignment,
        handleDeleteAssignment,
    };

}

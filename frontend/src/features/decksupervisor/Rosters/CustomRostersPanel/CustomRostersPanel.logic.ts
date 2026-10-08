import { useEffect, useMemo, useState } from "react";

import { extractEndTime, extractStartTime } from "../../../../lib/time";

import { showAppNotice } from "../../../../lib/appNotice";

import type { CustomRoster } from "../../../../types/app";

import type { RosterGroup } from "../types";

export type CustomRostersPanelProps = {
    rosters: RosterGroup[];
    instructorOptions: string[];
    customRosters: CustomRoster[];
    onPrintRoster: (roster: RosterGroup) => void;
    onSave: (next: CustomRoster[]) => void;
};

export function buildTimeKey(time: string) {
    const start = extractStartTime(time);
    const end = extractEndTime(time);
    return `${start}-${end}`;
}
export function useCustomRostersPanelLogic({
    rosters,
    instructorOptions,
    customRosters,
    onPrintRoster,
    onSave,
}: CustomRostersPanelProps) {
    const [isCreating, setIsCreating] = useState(false);
    const [editingRosterId, setEditingRosterId] = useState<string | null>(null);
    const [newLevel, setNewLevel] = useState("");
    const [newInstructor, setNewInstructor] = useState("");
    const [selectedSourceCodes, setSelectedSourceCodes] = useState<string[]>(
        [],
    );
    const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);

    const rosterByCode = useMemo(
        () => new Map(rosters.map((roster) => [roster.code, roster])),
        [rosters],
    );
    const studentsById = useMemo(() => {
        const map = new Map<string, RosterGroup["students"][number]>();
        rosters.forEach((roster) => {
            roster.students.forEach((student) => map.set(student.id, student));
        });
        return map;
    }, [rosters]);
    const timeConstraint = useMemo(() => {
        for (const code of selectedSourceCodes) {
            const roster = rosterByCode.get(code);
            if (roster) {
                return buildTimeKey(roster.time);
            }
        }
        return null;
    }, [selectedSourceCodes, rosterByCode]);
    const availableSourceRosters = useMemo(() => {
        if (!timeConstraint) {
            return rosters;
        }
        return rosters.filter((roster) =>
            buildTimeKey(roster.time) === timeConstraint
        );
    }, [rosters, timeConstraint]);
    const selectedRosters = useMemo(
        () =>
            selectedSourceCodes.map((code) => rosterByCode.get(code)).filter(
                Boolean,
            ) as RosterGroup[],
        [rosterByCode, selectedSourceCodes],
    );
    const selectedTimeLabel = selectedRosters[0]?.time ?? "";
    const availableStudentIds = useMemo(() => {
        const ids = new Set<string>();
        selectedRosters.forEach((roster) => {
            roster.students.forEach((student) => ids.add(student.id));
        });
        return ids;
    }, [selectedRosters]);
    useEffect(() => {
        setSelectedSourceCodes((current) =>
            current.filter((code) => rosterByCode.has(code))
        );
    }, [rosterByCode]);

    useEffect(() => {
        setSelectedStudentIds((current) =>
            current.filter((id) => availableStudentIds.has(id))
        );
    }, [availableStudentIds]);

    const handleToggleSourceCode = (code: string) => {
        setSelectedSourceCodes((current) => {
            const roster = rosterByCode.get(code);
            if (!roster) {
                return current;
            }
            const rosterTimeKey = buildTimeKey(roster.time);
            if (timeConstraint && rosterTimeKey !== timeConstraint) {
                return current;
            }
            const exists = current.includes(code);
            const next = exists
                ? current.filter((entry) => entry !== code)
                : [...current, code];
            return next;
        });
    };

    const handleToggleStudent = (studentId: string) => {
        setSelectedStudentIds((current) =>
            current.includes(studentId)
                ? current.filter((id) => id !== studentId)
                : [...current, studentId]
        );
    };

    const handleSelectAll = (roster: RosterGroup) => {
        setSelectedStudentIds((current) => {
            const ids = roster.students.map((student) => student.id);
            const next = new Set(current);
            ids.forEach((id) => next.add(id));
            return Array.from(next);
        });
    };

    const handleClearSelection = () => {
        setSelectedSourceCodes([]);
        setSelectedStudentIds([]);
    };

    const resetEditor = () => {
        setIsCreating(false);
        setEditingRosterId(null);
        setNewLevel("");
        setNewInstructor("");
        handleClearSelection();
    };

    const handleCreateCustomRoster = () => {
        if (!newLevel) {
            showAppNotice("Please select a level for the new class.", "error");
            return;
        }
        if (selectedSourceCodes.length === 0) {
            showAppNotice("Please choose at least one source class.", "error");
            return;
        }
        if (selectedStudentIds.length === 0) {
            showAppNotice("Please select at least one student.", "error");
            return;
        }

        const next = editingRosterId
            ? customRosters.map((roster) =>
                roster.id === editingRosterId
                    ? {
                        ...roster,
                        serviceName: newLevel,
                        instructor: newInstructor || undefined,
                        sourceCodes: selectedSourceCodes,
                        studentIds: selectedStudentIds,
                    }
                    : roster
            )
            : [
                ...customRosters,
                {
                    id: typeof crypto !== "undefined" && "randomUUID" in crypto
                        ? crypto.randomUUID()
                        : `${Date.now()}-${Math.random().toString(16).slice(2)
                        }`,
                    serviceName: newLevel,
                    instructor: newInstructor || undefined,
                    sourceCodes: selectedSourceCodes,
                    studentIds: selectedStudentIds,
                    createdAt: new Date().toISOString(),
                },
            ];
        onSave(next);
        resetEditor();
    };

    const handleEditRoster = (roster: CustomRoster) => {
        setIsCreating(true);
        setEditingRosterId(roster.id);
        setNewLevel(roster.serviceName);
        setNewInstructor(roster.instructor ?? "");
        setSelectedSourceCodes(
            roster.sourceCodes.filter((code) => rosterByCode.has(code)),
        );
        setSelectedStudentIds(roster.studentIds);
    };

    const handleDeleteRoster = (rosterId: string) => {
        if (!confirm("Delete this custom roster?")) {
            return;
        }
        const next = customRosters.filter((roster) => roster.id !== rosterId);
        onSave(next);
        if (editingRosterId === rosterId) {
            resetEditor();
        }
    };

    return {
        view: "ready" as const,
        isCreating,
        resetEditor,
        setIsCreating,
        customRosters,
        rosterByCode,
        studentsById,
        onPrintRoster,
        handleEditRoster,
        handleDeleteRoster,
        editingRosterId,
        newLevel,
        setNewLevel,
        newInstructor,
        instructorOptions,
        setNewInstructor,
        handleClearSelection,
        selectedSourceCodes,
        selectedTimeLabel,
        availableSourceRosters,
        handleToggleSourceCode,
        selectedRosters,
        handleSelectAll,
        selectedStudentIds,
        handleToggleStudent,
        handleCreateCustomRoster,
    };

}

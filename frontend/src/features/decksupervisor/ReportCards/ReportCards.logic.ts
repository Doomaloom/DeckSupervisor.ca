import { useEffect, useMemo, useRef, useState } from "react";

import { useAuth } from "../../../app/AuthContext";

import { useCurrentSession } from "../../../app/useCurrentSession";

import { useCurrentTeam } from "../../../app/useCurrentTeam";

import { useCurrentTerm } from "../../../app/useCurrentTerm";

import { getSessionTermLabel, syncReportCardsForDay, } from "../../../lib/reportCardSync";

import { applyPersistedLevelEdits, fetchRosterLevelEdits, fetchRosterStudentEdits, hashStudentNames, } from "../../../lib/rosterEditsApi";

import { fetchReportCardTotals } from "../../../lib/serverApi";

import { useDay } from "../../../app/DayContext";

import { getStudentsForDay, onStudentsUpdated, setStudentsForDay, } from "../../../lib/storage";

import type { Student } from "../../../types/app";

import { buildEmployeeReportCardSummaries, buildStudentReportCardSummary, } from "./utils";

export function useReportCardsLogic() {
    const { selectedDay } = useDay();
    const { accountType, isGuest, user } = useAuth();
    const { access, session: currentSession, sessionId } = useCurrentSession();
    const { currentTeam, currentTeamId } = useCurrentTeam();
    const { currentTerm } = useCurrentTerm();
    const [students, setStudents] = useState<Student[]>([]);
    const [employeeTotals, setEmployeeTotals] = useState<
        ReturnType<typeof buildEmployeeReportCardSummaries>
    >([]);
    const [employeeTotalsLoading, setEmployeeTotalsLoading] = useState(false);
    const [syncWarning, setSyncWarning] = useState("");
    const appliedEditsKey = useRef("");

    useEffect(() => {
        if (accountType === "full_time") {
            setStudents([]);
            return;
        }
        setStudents(getStudentsForDay(selectedDay));
    }, [accountType, selectedDay]);

    useEffect(() => {
        if (accountType === "full_time") {
            return () => { };
        }
        return onStudentsUpdated((day) => {
            if (day === selectedDay) {
                setStudents(getStudentsForDay(selectedDay));
            }
        });
    }, [accountType, selectedDay]);

    useEffect(() => {
        if (
            accountType === "full_time" || !sessionId || isGuest ||
            students.length === 0
        ) {
            return;
        }

        let active = true;
        const applyEdits = async () => {
            const [rosterEdits, studentEdits] = await Promise.all([
                fetchRosterLevelEdits(sessionId),
                fetchRosterStudentEdits(sessionId),
            ]);
            if (!active) {
                return;
            }

            const editsKey = JSON.stringify({
                sessionId,
                rosterEdits,
                studentEdits,
                studentCount: students.length,
            });
            if (editsKey === appliedEditsKey.current) {
                return;
            }
            appliedEditsKey.current = editsKey;

            const nameHashMap = await hashStudentNames(
                students.map((student) => student.name),
            );
            if (!active) {
                return;
            }

            const next = applyPersistedLevelEdits(
                students,
                rosterEdits,
                studentEdits,
                nameHashMap,
            );
            if (next === students) {
                return;
            }

            setStudents(next);
            setStudentsForDay(selectedDay, next);
        };

        void applyEdits().catch((error) => {
            console.error(
                "Failed to apply roster level edits to report cards",
                error,
            );
        });

        return () => {
            active = false;
        };
    }, [accountType, isGuest, selectedDay, sessionId, students]);

    useEffect(() => {
        if (accountType !== "full_time") {
            setEmployeeTotals([]);
            setEmployeeTotalsLoading(false);
            return;
        }
        if (!currentTeamId || !currentTerm?.label) {
            setEmployeeTotals([]);
            setEmployeeTotalsLoading(false);
            return;
        }

        let active = true;
        const loadEmployeeTotals = async () => {
            setEmployeeTotalsLoading(true);
            try {
                const response = await fetchReportCardTotals(
                    currentTeamId,
                    currentTerm.label,
                );
                if (!active) {
                    return;
                }
                setEmployeeTotals(
                    buildEmployeeReportCardSummaries(response.totals ?? []),
                );
            } catch (error) {
                console.error(
                    "Failed to load full-time report card totals",
                    error,
                );
                setEmployeeTotals([]);
            }
            setEmployeeTotalsLoading(false);
        };

        void loadEmployeeTotals();
        return () => {
            active = false;
        };
    }, [accountType, currentTeamId, currentTerm?.label]);

    const { instructorSummaries, lessonBlockTotals, totalStudents } = useMemo(
        () => buildStudentReportCardSummary(students),
        [students],
    );

    const totalEmployeeReportCards = useMemo(
        () => employeeTotals.reduce((sum, employee) => sum + employee.total, 0),
        [employeeTotals],
    );
    const sessionLabel = useMemo(
        () =>
            getSessionTermLabel(
                currentSession?.session_season,
                currentSession?.session_year,
                currentSession?.start_date,
            ),
        [
            currentSession?.session_season,
            currentSession?.session_year,
            currentSession?.start_date,
        ],
    );

    useEffect(() => {
        if (
            accountType === "full_time" ||
            !selectedDay ||
            isGuest ||
            !user ||
            access.mode !== "owner" ||
            !sessionLabel
        ) {
            setSyncWarning("");
            return;
        }

        const sync = async () => {
            const result = await syncReportCardsForDay({
                day: selectedDay,
                students,
                sessionLabel,
                teamId: currentSession?.team_id ?? null,
            });
            if (result.status === "blocked_unassigned") {
                setSyncWarning(
                    "Report card totals were not saved because some students are missing instructor assignments. Assign instructors in Schematic and save, then return to Report Cards.",
                );
                return;
            }
            setSyncWarning("");
        };

        void sync().catch((error) => {
            console.error("Failed to sync report card totals", error);
            setSyncWarning(
                "Failed to sync report card totals. Please try again.",
            );
        });
    }, [
        accountType,
        access.mode,
        currentSession?.team_id,
        isGuest,
        selectedDay,
        sessionLabel,
        students,
        user,
    ]);

    return {
        view: "ready" as const,
        accountType,
        currentTeamId,
        currentTerm,
        employeeTotalsLoading,
        employeeTotals,
        currentTeam,
        totalEmployeeReportCards,
        selectedDay,
        students,
        syncWarning,
        totalStudents,
        lessonBlockTotals,
        instructorSummaries,
    };

}

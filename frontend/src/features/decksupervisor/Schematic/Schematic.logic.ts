import React from "react";

import { useAuth } from "../../../app/AuthContext";

import { useDay } from "../../../app/DayContext";

import { useCurrentSession } from "../../../app/useCurrentSession";

import { useCurrentTeam } from "../../../app/useCurrentTeam";

import { useCurrentTerm } from "../../../app/useCurrentTerm";

import { formatMiniSessionTitle } from "../../../shared/session/sessionLabels";

import { dayNames } from "../../../shared/schedule/constants";

import { useFullTimeSchematicView } from "./hooks/useFullTimeSchematicView";

import { useSchematicSchedule } from "./hooks/useSchematicSchedule";

export function pageWidthForSchematic(columnCount: number) {
    const preferredWidthRem = 8 + columnCount * 8;
    return `min(calc(100% + 1rem), max(min(100%, 72rem), ${preferredWidthRem}rem))`;
}
export function useSchematicLogic() {
    const { accountType } = useAuth();
    const { selectedDay, setSelectedDay } = useDay();
    const { access, session } = useCurrentSession();
    const { currentTeam, currentTeamId } = useCurrentTeam();
    const { currentTerm } = useCurrentTerm();

    const fullTimeView = useFullTimeSchematicView(accountType === "full_time");

    React.useEffect(() => {
        if (accountType !== "full_time") {
            return;
        }
        if (selectedDay === fullTimeView.selectedDay) {
            return;
        }
        setSelectedDay(fullTimeView.selectedDay);
    }, [accountType, fullTimeView.selectedDay, selectedDay, setSelectedDay]);

    const {
        columns,
        instructors,
        instructorIds,
        lockedInstructors,
        selectedCourseCodes,
        draggedCourseCodes,
        draggedColumnIndex,
        timeLabels,
        scheduleHeightRem,
        scheduleStartMinutes,
        instructorOptions,
        toggleCourseSelection,
        handleDragStart,
        handleDrop,
        handleDropOnCourse,
        handleSaveSchedule,
        addTemporaryColumn,
        removeEmptyColumn,
        setInstructorAt,
    } = useSchematicSchedule(selectedDay);

    const dayLabel = selectedDay
        ? (dayNames[selectedDay] ?? selectedDay)
        : "Select Day";
    const seasonLabel = session?.session_season?.trim() ?? "";
    const yearLabel = session?.start_date
        ? new Date(session.start_date).getFullYear()
        : NaN;
    const miniSessionLabel = formatMiniSessionTitle(
        selectedDay,
        session?.session_year ?? null,
        session?.start_date ?? null,
    );
    const sessionLabel = miniSessionLabel ||
        [
            dayLabel,
            seasonLabel,
            Number.isFinite(yearLabel) ? String(yearLabel) : "",
        ]
            .filter(Boolean)
            .join(" ");
    const isReadOnly = access.mode === "shared";
    const tabButtonClass = (isActive: boolean, isDisabled: boolean) =>
        [
            "rounded-2xl border px-4 py-2 text-sm font-semibold transition",
            isActive
                ? "border-secondary bg-secondary text-accent"
                : "border-secondary/30 bg-bg text-secondary hover:bg-accent",
            isDisabled ? "cursor-not-allowed opacity-50 hover:bg-bg" : "",
        ].join(" ");

    if (accountType === "full_time") {
        return {
            view: "fullTime" as const,
            fullTimeView,
            columns,
            selectedDay,
            tabButtonClass,
            setSelectedDay,
            currentTeam,
            currentTerm,
            currentTeamId,
            instructors,
            timeLabels,
            scheduleHeightRem,
            scheduleStartMinutes,
            instructorOptions,
            sessionLabel,
        };
    }

    return {
        view: "session" as const,
        columns,
        instructors,
        instructorIds,
        lockedInstructors,
        selectedCourseCodes,
        draggedCourseCodes,
        draggedColumnIndex,
        timeLabels,
        scheduleHeightRem,
        scheduleStartMinutes,
        instructorOptions,
        sessionLabel,
        isReadOnly,
        addTemporaryColumn,
        removeEmptyColumn,
        setInstructorAt,
        toggleCourseSelection,
        handleDrop,
        handleDropOnCourse,
        handleDragStart,
        handleSaveSchedule,
    };

}

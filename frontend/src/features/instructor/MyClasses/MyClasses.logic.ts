import useInstructorClasses from "../session/useInstructorClasses";

import { SCHEDULE_HEADER_HEIGHT, SCHEDULE_SLOT_HEIGHT, SLOT_MINUTES } from "../../../shared/schedule/constants";

import { buildTimeLabels, timeToMinutes } from "../../../shared/schedule/time";

export const slotHeight = SCHEDULE_SLOT_HEIGHT;

export const headerHeight = SCHEDULE_HEADER_HEIGHT;
export function useMyClassesLogic() {
    const { session, classes, loading, error, refresh } =
        useInstructorClasses();
    const start = classes.length
        ? Math.floor(
            Math.min(...classes.map((c) => timeToMinutes(c.start_time))) /
            SLOT_MINUTES,
        ) * SLOT_MINUTES
        : 0;
    const end = classes.length
        ? Math.max(...classes.map((c) => timeToMinutes(c.end_time)))
        : 0;
    const clock = (minutes: number) =>
        `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")
        }`;
    const labels = buildTimeLabels(clock(start), clock(end));
    const assignments = Array.from(
        new Set(classes.map((c) => c.assignment_id)),
    );
    return {
        view: "ready" as const,
        session,
        loading,
        error,
        refresh,
        classes,
        labels,
        assignments,
        start,
    };

}

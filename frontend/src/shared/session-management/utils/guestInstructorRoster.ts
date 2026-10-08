import type { ScheduleConfig } from "../../../types/app";
import type { InstructorEntry } from "../types";

export function reconcileGuestInstructorRoster(
    schedule: ScheduleConfig,
    previous: InstructorEntry[],
    next: InstructorEntry[],
): ScheduleConfig {
    const ids = schedule.instructors.map((name, index) => {
        if (schedule.instructorIds && index < schedule.instructorIds.length) {
            return schedule.instructorIds[index];
        }
        const matches = previous.filter((row) => row.name && row.name === name);
        if (matches.length !== 1) return null;
        if (matches[0].id) return matches[0].id;
        return next.filter((row) => row.name === name).length === 1
            ? next.find((row) => row.name === name)?.id ?? null
            : null;
    });
    const retained = ids.map((id) =>
        next.some((row) => row.id === id) ? id : null
    );
    return {
        ...schedule,
        instructorIds: retained,
        instructors: retained.map((id) =>
            next.find((row) => row.id === id)?.name ?? ""
        ),
    };
}

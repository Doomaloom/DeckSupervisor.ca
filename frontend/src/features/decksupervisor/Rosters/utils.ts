import { extractStartTime } from "../../../lib/time";
import { formatLevelName } from "../../../shared/levels/formatLevelName";
import { sanitizeLevel } from "../../../shared/levels/sanitizeLevel";
import type { CustomRoster, Student } from "../../../types/app";
import type { RosterGroup, RosterListItem } from "./types";
export { sanitizeLevel } from "../../../shared/levels/sanitizeLevel";

type AttendanceRosterPayload = {
    code: string;
    level: string;
    serviceName: string;
    time: string;
    instructor: string;
    location: string;
    schedule: string;
    students: Array<{
        name: string;
    }>;
};

export type AttendancePrintItem = {
    template: string;
    roster: AttendanceRosterPayload;
};

// The order swimmers are listed in on Rosters and the blank attendance sheets.
// Attendance and Results reuses it so completed sheets list rows the same way.
export function compareStudentNames(
    a: { name: string },
    b: { name: string },
) {
    return a.name.localeCompare(b.name, "en", { sensitivity: "base" });
}

export function buildRosterGroups(students: Student[]): RosterGroup[] {
    const classesMap = new Map<string, RosterGroup>();

    students.forEach((student) => {
        const existing = classesMap.get(student.code);
        if (!existing) {
            classesMap.set(student.code, {
                code: student.code,
                serviceName: student.service_name,
                level: formatLevelName(student.level || student.service_name),
                time: student.time,
                instructor: student.instructor ?? "",
                location: student.location,
                schedule: student.schedule,
                students: [student],
            });
        } else {
            if (!existing.instructor && student.instructor) {
                existing.instructor = student.instructor;
            }
            existing.students.push(student);
        }
    });

    const sorted = Array.from(classesMap.values());
    sorted.forEach((group) => {
        group.students.sort(compareStudentNames);
    });

    sorted.sort((a, b) => {
        const timeA = extractStartTime(a.time);
        const timeB = extractStartTime(b.time);
        return timeA.localeCompare(timeB);
    });

    return sorted;
}

export function getVisibleRosterStudents(students: Student[]): Student[] {
    return students.filter((student) => !student.waitlist);
}

export function buildAttendanceRosterStudents(students: Student[]) {
    return getVisibleRosterStudents(students).map((student) => ({
        name: student.name,
    }));
}

export function buildAttendancePrintItems(
    roster: RosterGroup,
): AttendancePrintItem[] {
    // Group by level key, so "Splash 5" and an older "Splash5" share a sheet.
    const grouped = new Map<string, { level: string; students: Student[] }>();

    getVisibleRosterStudents(roster.students).forEach((student) => {
        const level = formatLevelName(student.level?.trim() || roster.level);
        const key = sanitizeLevel(level);
        const existing = grouped.get(key);
        if (existing) {
            existing.students.push(student);
            return;
        }
        grouped.set(key, { level, students: [student] });
    });

    const items = Array.from(grouped.entries()).map((
        [template, { level, students }],
    ) => ({
        template,
        roster: {
            code: roster.code,
            level,
            serviceName: level,
            time: roster.time,
            instructor: roster.instructor,
            location: roster.location,
            schedule: roster.schedule,
            students: buildAttendanceRosterStudents(students),
        },
    }));

    if (items.length > 0) {
        return items;
    }

    return [
        {
            template: sanitizeLevel(roster.level),
            roster: {
                code: roster.code,
                level: roster.level,
                serviceName: roster.serviceName,
                time: roster.time,
                instructor: roster.instructor,
                location: roster.location,
                schedule: roster.schedule,
                students: [],
            },
        },
    ];
}

export function buildCustomRosterGroups(
    customRosters: CustomRoster[],
    rosterByCode: Map<string, RosterGroup>,
    studentsById: Map<string, Student>,
): RosterGroup[] {
    return customRosters.map((customRoster) => {
        const sourceRoster = customRoster.sourceCodes
            .map((code) => rosterByCode.get(code))
            .find(Boolean);
        const students = customRoster.studentIds
            .map((id) => studentsById.get(id))
            .filter(Boolean) as Student[];
        students.sort((a, b) =>
            a.name.localeCompare(b.name, "en", { sensitivity: "base" })
        );
        return {
            code: `custom-${customRoster.id}`,
            customRosterId: customRoster.id,
            serviceName: formatLevelName(customRoster.serviceName),
            level: formatLevelName(customRoster.serviceName),
            time: sourceRoster?.time ?? "",
            instructor: customRoster.instructor ?? "",
            location: sourceRoster?.location ?? "",
            schedule: sourceRoster?.schedule ?? "",
            students,
        };
    });
}

export function filterRosterItems(
    rosters: RosterListItem[],
    instructorFilter: string,
    levelFilter: string,
    searchQuery: string,
) {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    return rosters.filter((item) => {
        const roster = item.roster;
        if (instructorFilter && roster.instructor !== instructorFilter) {
            return false;
        }
        if (levelFilter && roster.serviceName !== levelFilter) {
            return false;
        }
        if (normalizedQuery) {
            const codeMatch = roster.code.toLowerCase().includes(
                normalizedQuery,
            );
            const studentMatch = roster.students.some((student) =>
                student.name.toLowerCase().includes(normalizedQuery)
            );
            if (!codeMatch && !studentMatch) {
                return false;
            }
        }
        return true;
    });
}

export function getEmptyMessage(studentsCount: number) {
    return studentsCount
        ? "No rosters match the current filters."
        : "No rosters loaded. Upload a CSV file to see rosters.";
}

export function tabButtonClass(active: boolean) {
    return `min-h-11 flex-1 rounded-2xl border-2 px-4 py-2 text-sm font-semibold transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${active
        ? "border-secondary bg-secondary text-accent shadow-sm"
        : "border-secondary/20 bg-accent text-secondary hover:border-primary hover:shadow-sm"
        }`;
}

import { extractStartTime } from "../../../lib/time";
import { formatLevelName } from "../../../shared/levels/formatLevelName";
import { sanitizeLevel } from "../../../shared/levels/sanitizeLevel";
import type { CustomRoster, Student } from "../../../types/app";
import { LEGACY_ATTENDANCE_TEMPLATE_KEYS } from "../../../shared/attendance-print/templateRegistry";
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

function studentLevel(student: Student) {
    return formatLevelName(student.level || student.service_name);
}

// Booked swimmers whose level differs from the class level. Waitlisted
// swimmers follow the class and never count.
export function getOwnLevelStudents(
    students: Student[],
    classLevel: string,
): Student[] {
    return getVisibleRosterStudents(students).filter((student) =>
        studentLevel(student) !== classLevel
    );
}

export function buildRosterGroups(students: Student[]): RosterGroup[] {
    const classesMap = new Map<string, RosterGroup>();

    students.forEach((student) => {
        const existing = classesMap.get(student.code);
        if (!existing) {
            const registeredLevel = formatLevelName(student.service_name);
            classesMap.set(student.code, {
                code: student.code,
                serviceName: student.service_name,
                level: registeredLevel,
                registeredLevel,
                hasClassEdit: false,
                hasOwnLevels: false,
                mixedInFile: false,
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
        // The class level never follows a swimmer: it is the saved class
        // edit, else the level the class was registered with.
        const classEdit = group.students.find((student) => student.class_level)
            ?.class_level;
        if (classEdit) {
            group.level = formatLevelName(classEdit);
            group.hasClassEdit = true;
        }
        group.hasOwnLevels =
            getOwnLevelStudents(group.students, group.level).length > 0;
        group.mixedInFile = group.students.some((student) =>
            formatLevelName(
                student.registered_level || student.service_name,
            ) !== group.registeredLevel
        );
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

export function getWaitlistedRosterStudents(students: Student[]): Student[] {
    return students.filter((student) => student.waitlist);
}

export function buildAttendanceRosterStudents(students: Student[]) {
    return getVisibleRosterStudents(students).map((student) => ({
        name: student.name,
    }));
}

function hasAttendanceTemplate(level: string) {
    return (LEGACY_ATTENDANCE_TEMPLATE_KEYS as readonly string[]).includes(
        sanitizeLevel(level),
    );
}

export function buildAttendancePrintItems(
    roster: RosterGroup,
): AttendancePrintItem[] {
    // A custom roster prints on its own level's sheet, one sheet for everyone
    // in it. A level with no sheet falls back to each swimmer's own level.
    if (roster.customRosterId && hasAttendanceTemplate(roster.level)) {
        const booked = getVisibleRosterStudents(roster.students);
        if (booked.length > 0) {
            return [{
                template: sanitizeLevel(roster.level),
                roster: {
                    code: roster.code,
                    level: roster.level,
                    serviceName: roster.level,
                    time: roster.time,
                    instructor: roster.instructor,
                    location: roster.location,
                    schedule: roster.schedule,
                    students: buildAttendanceRosterStudents(booked),
                },
            }];
        }
    }
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
            registeredLevel: formatLevelName(customRoster.serviceName),
            hasClassEdit: false,
            hasOwnLevels: false,
            mixedInFile: false,
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

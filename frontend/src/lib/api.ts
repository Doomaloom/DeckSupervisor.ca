import { getCurrentSessionId } from "./sessionStorage";
import { setLoadedRosterSession } from "./loadedRosterSession";
import type { ClassRoster, InstructorEntry, Student } from "../types/app";
import { setStudentsForDay } from "./storage";

// Same rule as the backend's NormalizeEventID: all-digit codes ignore leading zeros.
function normalizeCourseCode(value: string) {
    const trimmed = value.trim();
    if (!/^\d+$/.test(trimmed)) {
        return trimmed;
    }
    return trimmed.replace(/^0+/, "") || "0";
}

// Guests have no saved Schematic, so the server cannot assign instructors.
// Apply the browser's own instructor-to-class setup to the analyzed rosters.
export function applyLocalInstructorsToRosters(
    rosters: ClassRoster[],
    instructors: InstructorEntry[],
): ClassRoster[] {
    const nameByCode = new Map<string, string>();
    instructors.forEach((instructor) => {
        const name = instructor.name.trim();
        if (!name) {
            return;
        }
        instructor.codes.split(",").forEach((code) => {
            const normalized = normalizeCourseCode(code);
            if (normalized) {
                nameByCode.set(normalized, name);
            }
        });
    });
    if (nameByCode.size === 0) {
        return rosters;
    }
    return rosters.map((roster) => {
        const name = nameByCode.get(normalizeCourseCode(roster.code));
        if (!name) {
            return roster;
        }
        return {
            ...roster,
            instructor: name,
            students: roster.students.map((student) => ({
                ...student,
                instructor: name,
            })),
        };
    });
}

export function rosterToStudents(rosters: ClassRoster[]): Student[] {
    const students: Student[] = [];
    rosters.forEach((roster) => {
        roster.students.forEach((student) => {
            const id =
                `${roster.code}-${student.name}-${roster.time}-${roster.day}`
                    .replace(/\s+/g, "-");
            students.push({
                id,
                service_name: roster.serviceName,
                code: roster.code,
                day: roster.day,
                time: roster.time,
                location: roster.location,
                schedule: roster.schedule,
                name: student.name,
                phone: student.phone,
                age: student.age,
                instructor: student.instructor || roster.instructor,
                level: student.level || roster.serviceName,
                waitlist: Boolean(student.waitlist),
            });
        });
    });
    return students;
}

export function storeProcessedRosters(
    classes: ClassRoster[],
    sessionId = getCurrentSessionId(),
) {
    if (classes.length === 0) {
        return;
    }

    const students = rosterToStudents(classes);
    const grouped = students.reduce<Record<string, Student[]>>(
        (acc, student) => {
            acc[student.day] = acc[student.day] || [];
            acc[student.day].push(student);
            return acc;
        },
        {},
    );
    Object.entries(grouped).forEach(([key, list]) => {
        setLoadedRosterSession(key, sessionId);
        setStudentsForDay(key, list, sessionId);
    });
}

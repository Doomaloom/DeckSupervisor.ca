import type {
    CustomRoster,
    FormatOptions,
    InstructorConfig,
    InstructorCourseConfig,
    ScheduleConfig,
    Student,
} from "../types/app";
import { getStoredItem, removeStoredItem, setStoredItem } from "./browserStorage";
import { getExtractedClassesForSession } from "./extractedClassesStorage";
import { getLoadedRosterSession } from "./loadedRosterSession";
import { getCurrentSessionId } from "./sessionStorage";
import { getScopedKey } from "./storageScope";

const selectedDayKey = () => getScopedKey("selectedDay");
// Roster rows are cached per session, then per weekday: two sessions on the
// same weekday must never share or overwrite each other's swimmers.
const studentsKey = () => getScopedKey("studentsBySession");
// Before triage W10 rows were cached by weekday only. Entries are moved into
// a session's cache once they can be attributed to it (adoptLegacyStudents).
const legacyStudentsKey = () => getScopedKey("studentsByDay");
const instructorsKey = () => getScopedKey("instructorsByDay");
const formatOptionsKey = () => getScopedKey("formatOptions");
const masterlistDraftOptionsKey = () => getScopedKey("masterlistDraftOptions");
const schedulesKey = () => getScopedKey("schedulesByDay");
const instructorCoursesKey = () => getScopedKey("instructorCoursesByDay");
const customRostersKey = () => getScopedKey("customRostersByDay");
const studentsUpdatedEvent = () => getScopedKey("students-updated");

type StudentsByDay = Record<string, Student[]>;
type StudentsBySession = Record<string, StudentsByDay>;
type InstructorsByDay = Record<string, InstructorConfig>;
type SchedulesByDay = Record<string, ScheduleConfig>;
type InstructorCoursesByDay = Record<string, InstructorCourseConfig>;
type CustomRostersByDay = Record<string, CustomRoster[]>;

const defaultFormatOptions: FormatOptions = {
    layout: "class-time",
    alphabetical_name_basis: "last-name",
    time_headers: false,
    instructor_headers: false,
    course_headers: false,
    borders: false,
    center_time: false,
    bold_time: false,
    center_course: false,
    bold_course: false,
    font_size: 11,
};

function clampFormatFontSize(value: unknown): number {
    if (typeof value !== "number" || Number.isNaN(value)) {
        return defaultFormatOptions.font_size;
    }
    return Math.min(18, Math.max(8, Math.round(value)));
}

function normalizeFormatOptions(
    value: Partial<FormatOptions> | null | undefined,
): FormatOptions {
    const layout = value?.layout === "alphabetical"
        ? "alphabetical"
        : "class-time";
    const alphabeticalNameBasis =
        value?.alphabetical_name_basis === "first-name"
            ? "first-name"
            : "last-name";
    return {
        ...defaultFormatOptions,
        ...(value ?? {}),
        layout,
        alphabetical_name_basis: alphabeticalNameBasis,
        font_size: clampFormatFontSize(value?.font_size),
    };
}

function loadJson<T>(key: string, fallback: T): T {
    if (typeof window === "undefined") {
        return fallback;
    }

    try {
        const value = getStoredItem(key);
        if (!value) {
            return fallback;
        }
        return JSON.parse(value) as T;
    } catch (error) {
        console.error(`Failed to parse ${key} from session storage`, error);
        return fallback;
    }
}

function saveJson<T>(key: string, value: T) {
    if (typeof window === "undefined") {
        return;
    }
    setStoredItem(key, JSON.stringify(value));
}

export function getSelectedDay(): string {
    if (typeof window === "undefined") {
        return "";
    }
    return getStoredItem(selectedDayKey()) ?? "";
}

export function setSelectedDay(day: string) {
    if (typeof window === "undefined") {
        return;
    }
    setStoredItem(selectedDayKey(), day);
}

export function getFormatOptions(): FormatOptions {
    return normalizeFormatOptions(
        loadJson<Partial<FormatOptions>>(
            formatOptionsKey(),
            defaultFormatOptions,
        ),
    );
}

export function setFormatOptions(options: FormatOptions) {
    saveJson(formatOptionsKey(), options);
}

export function getMasterlistDraftOptions(): FormatOptions {
    return normalizeFormatOptions(
        loadJson<Partial<FormatOptions>>(
            masterlistDraftOptionsKey(),
            getFormatOptions(),
        ),
    );
}

export function setMasterlistDraftOptions(options: FormatOptions) {
    saveJson(masterlistDraftOptionsKey(), options);
}

// Omitted means the current session; "" is the cache used with no session.
function resolveRosterSessionId(sessionId?: string) {
    return (sessionId ?? getCurrentSessionId()).trim();
}

function loadStudentsBySession(): StudentsBySession {
    return loadJson<StudentsBySession>(studentsKey(), {});
}

function rowsMatchSessionClasses(rows: Student[], sessionId: string) {
    const codes = new Set(
        getExtractedClassesForSession(sessionId)
            .map((entry) => entry.courseCode.trim())
            .filter(Boolean),
    );
    return codes.size > 0 && rows.every((row) => codes.has(row.code.trim()));
}

// Move a weekday-only entry into this session's cache when it provably belongs
// to it: the upload recorded this session, or (for uploads older than that
// record) every row is one of this session's classes. Otherwise leave it.
function adoptLegacyStudents(day: string, sessionId: string): Student[] | null {
    if (!sessionId) {
        return null;
    }
    const legacy = loadJson<StudentsByDay>(legacyStudentsKey(), {});
    const rows = legacy[day];
    if (!Array.isArray(rows) || rows.length === 0) {
        return null;
    }
    const owner = getLoadedRosterSession(day);
    const belongs = owner
        ? owner === sessionId
        : rowsMatchSessionClasses(rows, sessionId);
    if (!belongs) {
        return null;
    }
    const all = loadStudentsBySession();
    all[sessionId] = { ...(all[sessionId] ?? {}), [day]: rows };
    saveJson(studentsKey(), all);
    delete legacy[day];
    if (Object.keys(legacy).length === 0) {
        removeStoredItem(legacyStudentsKey());
    } else {
        saveJson(legacyStudentsKey(), legacy);
    }
    return rows;
}

export function getStudentsByDay(sessionId?: string): StudentsByDay {
    return loadStudentsBySession()[resolveRosterSessionId(sessionId)] ?? {};
}

export function getStudentsForDay(day: string, sessionId?: string): Student[] {
    if (!day) {
        return [];
    }
    const id = resolveRosterSessionId(sessionId);
    const cached = getStudentsByDay(id)[day];
    if (cached) {
        return cached;
    }
    return adoptLegacyStudents(day, id) ?? [];
}

export function setStudentsForDay(
    day: string,
    students: Student[],
    sessionId?: string,
) {
    if (!day) {
        return;
    }
    const id = resolveRosterSessionId(sessionId);
    const all = loadStudentsBySession();
    all[id] = { ...(all[id] ?? {}), [day]: students };
    saveJson(studentsKey(), all);
    if (typeof window !== "undefined") {
        window.dispatchEvent(
            new CustomEvent(studentsUpdatedEvent(), {
                detail: { day, sessionId: id },
            }),
        );
    }
}

export function updateStudentForDay(
    day: string,
    studentId: string,
    update: Partial<Student>,
    sessionId?: string,
) {
    if (!day) {
        return;
    }
    const students = getStudentsForDay(day, sessionId);
    const updated = students.map((student) =>
        student.id === studentId ? { ...student, ...update } : student
    );
    setStudentsForDay(day, updated, sessionId);
}

export function onStudentsUpdated(
    handler: (day: string, sessionId: string) => void,
) {
    if (typeof window === "undefined") {
        return () => {};
    }
    const listener = (event: Event) => {
        const custom = event as CustomEvent<{ day?: string; sessionId?: string }>;
        handler(custom.detail?.day ?? "", custom.detail?.sessionId ?? "");
    };
    const eventName = studentsUpdatedEvent();
    window.addEventListener(eventName, listener);
    return () => window.removeEventListener(eventName, listener);
}

export function getInstructorsByDay(): InstructorsByDay {
    return loadJson(instructorsKey(), {});
}

export function getInstructorsForDay(day: string): InstructorConfig | null {
    if (!day) {
        return null;
    }
    const all = getInstructorsByDay();
    return all[day] ?? null;
}

export function setInstructorsForDay(
    day: string,
    instructors: InstructorConfig,
) {
    if (!day) {
        return;
    }
    const all = getInstructorsByDay();
    all[day] = instructors;
    saveJson(instructorsKey(), all);
}

export function getSchedulesByDay(): SchedulesByDay {
    return loadJson(schedulesKey(), {});
}

export function getScheduleForDay(day: string): ScheduleConfig | null {
    if (!day) {
        return null;
    }
    const all = getSchedulesByDay();
    return all[day] ?? null;
}

export function setScheduleForDay(day: string, schedule: ScheduleConfig) {
    if (!day) {
        return;
    }
    const all = getSchedulesByDay();
    all[day] = schedule;
    saveJson(schedulesKey(), all);
}

export function getCustomRostersByDay(): CustomRostersByDay {
    return loadJson(customRostersKey(), {});
}

export function getCustomRostersForDay(day: string): CustomRoster[] {
    if (!day) {
        return [];
    }
    const all = getCustomRostersByDay();
    return all[day] ?? [];
}

export function setCustomRostersForDay(day: string, rosters: CustomRoster[]) {
    if (!day) {
        return;
    }
    const all = getCustomRostersByDay();
    all[day] = rosters;
    saveJson(customRostersKey(), all);
}

export function getCustomRosterDayKey(
    day: string,
    sessionId?: string,
    isGuest = false,
): string {
    if (!day) {
        return "";
    }
    if (isGuest || !sessionId) {
        return day;
    }
    return `${day}::${sessionId}`;
}

export function getInstructorCoursesByDay(): InstructorCoursesByDay {
    return loadJson(instructorCoursesKey(), {});
}

export function getInstructorCoursesForDay(
    day: string,
): InstructorCourseConfig | null {
    if (!day) {
        return null;
    }
    const all = getInstructorCoursesByDay();
    return all[day] ?? null;
}

export function setInstructorCoursesForDay(
    day: string,
    config: InstructorCourseConfig,
) {
    if (!day) {
        return;
    }
    const all = getInstructorCoursesByDay();
    all[day] = config;
    saveJson(instructorCoursesKey(), all);
}

export function clearDayData(day: string) {
    if (!day) {
        return;
    }
    const studentsBySession = loadStudentsBySession();
    const sessionId = resolveRosterSessionId();
    const instructors = getInstructorsByDay();
    const schedules = getSchedulesByDay();
    const instructorCourses = getInstructorCoursesByDay();
    const customRosters = getCustomRostersByDay();

    delete studentsBySession[sessionId]?.[day];
    delete instructors[day];
    delete schedules[day];
    delete instructorCourses[day];
    delete customRosters[day];

    saveJson(studentsKey(), studentsBySession);
    saveJson(instructorsKey(), instructors);
    saveJson(schedulesKey(), schedules);
    saveJson(instructorCoursesKey(), instructorCourses);
    saveJson(customRostersKey(), customRosters);
}

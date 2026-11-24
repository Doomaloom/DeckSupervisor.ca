export type AttendancePrintStudent = {
    name: string;
    enrollmentId?: string;
    results?: {
        attendance: Record<string, "present" | "absent" | "unmarked">;
        successfulAttempts: Record<string, number>;
    };
};

export type AttendancePrintRoster = {
    code: string;
    level: string;
    serviceName: string;
    time: string;
    instructor: string;
    location: string;
    schedule: string;
    students: AttendancePrintStudent[];
    completed?: {
        curriculumVersion: string;
        lessonDates: string[];
        unresolvedConflicts?: boolean;
    };
};

export type AttendancePrintItem = {
    template: string;
    roster: AttendancePrintRoster;
    /** Row number of the first student on a completed continuation sheet. */
    firstRowNumber?: number;
    /** Day number of the first [Day n] slot when a long session continues on another sheet. */
    firstDayNumber?: number;
};

export type AttendancePrintRequest = {
    session?: string;
    title?: string;
    roster?: AttendancePrintRoster;
    rosters?: AttendancePrintItem[];
    template?: string;
};

export type AttendancePrintResult =
    | { status: "printed" }
    | { status: "popup-blocked" }
    | { status: "failed"; error: Error };

export type AttendanceTemplateSections = {
    key: string;
    styles: string[];
    pageAttributes: Record<string, string>;
    frontFragment: HTMLElement;
    backFragment: HTMLElement;
};

export type AttendancePrintPage = {
    kind: "attendance-front" | "attendance-back" | "schematic-cover" | "blank";
    element: HTMLElement;
};

export type AttendanceSchematicCoverOptions = {
    request: import("../pdf/types").SchematicPdfRequest;
    highlightEachInstructor?: boolean;
    blankBack?: boolean;
};

export type AttendancePrintOptions = {
    schematicCover?: AttendanceSchematicCoverOptions;
};

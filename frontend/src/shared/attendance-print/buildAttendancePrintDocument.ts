import sansBold from "../pdf/fonts/LiberationSans-Bold.ttf?url";
import sansRegular from "../pdf/fonts/LiberationSans-Regular.ttf?url";
import serifBold from "../pdf/fonts/LiberationSerif-Bold.ttf?url";
import serifRegular from "../pdf/fonts/LiberationSerif-Regular.ttf?url";
import compatibilityCss from "./attendanceCompatibility.css?inline";
import { buildSchematicCoverElement } from "./schematicCover";
import { extractAttendanceTemplateSections, fillAttendanceRoster, } from "./templateDom";
import { loadAttendanceTemplate } from "./templateRegistry";
import { fillCompletedMarks, validateCompletedRoster } from './completedAttendance';
import type { AttendancePrintItem, AttendancePrintOptions, AttendancePrintRequest, } from "./types";

export function groupAttendancePrintItems(items: AttendancePrintItem[]) {
    const groups: AttendancePrintItem[][] = [];
    for (let index = 0; index < items.length;) {
        const next = items[index + 1];
        if (next && !next.roster.completed && !items[index].roster.completed && next.roster.code === items[index].roster.code) {
            groups.push([items[index], next]);
            index += 2;
        } else {
            groups.push([items[index]]);
            index += 1;
        }
    }
    return groups;
}

function requestItems(request: AttendancePrintRequest) {
    if (request.rosters?.length) return request.rosters;
    if (request.roster) {
        return [{
            template: request.template?.trim() || "SplashFitness",
            roster: request.roster,
        }];
    }
    throw new Error("No attendance rosters were provided.");
}

export function attendanceFontCss() {
    return `
@font-face { font-family: Arial; src: url("${sansRegular}"); font-weight: 400; }
@font-face { font-family: Arial; src: url("${sansBold}"); font-weight: 700; }
@font-face { font-family: "Liberation Serif"; src: url("${serifRegular}"); font-weight: 400; }
@font-face { font-family: "Liberation Serif"; src: url("${serifBold}"); font-weight: 700; }
body { font-family: "Liberation Serif", serif; }
`;
}

function printPage(document: Document, kind: string) {
    const page = document.createElement("section");
    page.className = "print-page";
    page.dataset.pageKind = kind;
    return page;
}

function adjacentInstructorPackets(items: AttendancePrintItem[]) {
    const packets: AttendancePrintItem[][] = [];
    items.forEach((item) => {
        const current = packets.at(-1);
        if (current?.[0].roster.instructor === item.roster.instructor) {
            current.push(item);
        } else packets.push([item]);
    });
    return packets;
}

export async function buildAttendancePrintDocument(
    request: AttendancePrintRequest,
    options: AttendancePrintOptions = {},
): Promise<Document> {
    const items = requestItems(request).flatMap(item => {
        if (!item.roster.completed) return [item];
        validateCompletedRoster(item.roster, item.template);
        // Repeat the original front/back template for each student/date slice.
        const pages: AttendancePrintItem[] = [];
        const dates = [...item.roster.completed.lessonDates].sort();
        for (let student = 0; student < Math.max(1, item.roster.students.length); student += 8) {
            for (let date = 0; date < dates.length; date += 14) {
                const lessonDates = dates.slice(date, date + 14);
                pages.push({ ...item, firstRowNumber: student + 1, roster: {
                    ...item.roster,
                    completed: { ...item.roster.completed, lessonDates },
                    students: item.roster.students.slice(student, student + 8).map(person => ({
                        ...person,
                        results: { ...person.results!, attendance: Object.fromEntries(Object.entries(person.results!.attendance).filter(([day]) => lessonDates.includes(day))) },
                    })),
                } });
            }
        }
        return pages;
    });
    const document = window.document.implementation.createHTMLDocument(
        request.title?.trim() || "Attendance Sheets",
    );
    document.documentElement.lang = "en";
    const meta = document.createElement("meta");
    meta.setAttribute("http-equiv", "Content-Security-Policy");
    meta.content =
        "default-src 'self' data: blob:; script-src 'none'; style-src 'unsafe-inline'; font-src 'self' data: blob:";
    document.head.append(meta);
    const style = document.createElement("style");
    style.textContent = `${attendanceFontCss()}\n${compatibilityCss}`;
    document.head.append(style);
    document.body.className = "attendance-print-document";

    const loaded = await Promise.all(items.map(async (item) => {
        const template = await loadAttendanceTemplate(item.template);
        return {
            item,
            sections: extractAttendanceTemplateSections(
                template.key,
                template.html,
            ),
        };
    }));
    const templateStyles = new Set(
        loaded.flatMap((entry) => entry.sections.styles),
    );
    templateStyles.forEach((css) => {
        const templateStyle = document.createElement("style");
        templateStyle.textContent = css;
        document.head.append(templateStyle);
    });

    const byItem = new Map(
        items.map((item, index) => [item, loaded[index].sections]),
    );
    const packets = options.schematicCover
        ? adjacentInstructorPackets(items)
        : [items];
    for (const packet of packets) {
        if (options.schematicCover) {
            const instructor = packet[0]?.roster.instructor ?? "";
            const coverRequest = {
                ...options.schematicCover.request,
                ...(options.schematicCover.highlightEachInstructor
                    ? {
                        highlightInstructor: true,
                        selectedInstructor: instructor,
                    }
                    : {}),
            };
            const cover = printPage(document, "schematic-cover");
            cover.append(buildSchematicCoverElement(document, coverRequest));
            document.body.append(cover);
            if (options.schematicCover.blankBack !== false) {
                document.body.append(printPage(document, "blank"));
            }
        }
        for (const group of groupAttendancePrintItems(packet)) {
            const paired = group.length === 2;
            for (const side of ["front", "back"] as const) {
                const page = printPage(document, `attendance-${side}`);
                if (paired) page.classList.add("combined-page");
                for (const item of group) {
                    const sections = byItem.get(item);
                    if (!sections) continue;
                    const source = side === "front"
                        ? sections.frontFragment
                        : sections.backFragment;
                    const fragment = document.importNode(source, true);
                    fillAttendanceRoster(
                        fragment,
                        item.roster,
                        request.session?.trim() || "Session",
                        { firstRowNumber: item.firstRowNumber },
                    );
                    fillCompletedMarks(fragment, item.roster, item.template);
                    if (paired) {
                        const slot = document.createElement("div");
                        slot.className = "combined-slot";
                        slot.append(fragment);
                        page.append(slot);
                    } else {
                        page.append(fragment);
                    }
                }
                document.body.append(page);
            }
        }
    }
    return document;
}

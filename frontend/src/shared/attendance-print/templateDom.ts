import type { AttendancePrintRoster, AttendanceTemplateSections, } from "./types";

const REQUIRED_PLACEHOLDERS = [
    "instructor",
    "start_time",
    "session",
    "location",
    "barcode",
] as const;

function copyAttributes(element: Element) {
    return Object.fromEntries(
        Array.from(element.attributes).map(
            (attribute) => [attribute.name, attribute.value],
        ),
    );
}

function clonePageFragment(page: Element, nodes: Node[]) {
    const clone = page.cloneNode(false) as HTMLElement;
    nodes.forEach((node) => clone.appendChild(node.cloneNode(true)));
    return clone;
}

export function extractAttendanceTemplateSections(
    key: string,
    html: string,
): AttendanceTemplateSections {
    const parsed = new DOMParser().parseFromString(html, "text/html");
    parsed.querySelectorAll("script, link[href]").forEach((element) =>
        element.remove()
    );
    const page = parsed.querySelector(".templatePage");
    const boundary = page?.querySelector(":scope > .break-before-page");
    if (!page || !boundary) {
        throw new Error(
            `Attendance template ${key} is missing its front/back boundary.`,
        );
    }

    const nodes = Array.from(page.childNodes);
    const boundaryIndex = nodes.indexOf(boundary);
    const frontFragment = clonePageFragment(
        page,
        nodes.slice(0, boundaryIndex),
    );
    const backFragment = clonePageFragment(
        page,
        nodes.slice(boundaryIndex + 1),
    );
    const combinedText = `${frontFragment.textContent ?? ""}${backFragment.textContent ?? ""
        }`;
    if (!combinedText.trim()) {
        throw new Error(`Attendance template ${key} is empty.`);
    }

    REQUIRED_PLACEHOLDERS.forEach((id) => {
        if (!frontFragment.querySelector(`#${id}`)) {
            throw new Error(`Attendance template ${key} is missing #${id}.`);
        }
    });
    if (
        !frontFragment.querySelector("#attendance-rows") ||
        !frontFragment.querySelector("#student-rows")
    ) {
        throw new Error(
            `Attendance template ${key} is missing its attendance row elements.`,
        );
    }

    return {
        key,
        styles: Array.from(parsed.head.querySelectorAll("style")).map((style) =>
            style.textContent ?? ""
        ),
        pageAttributes: copyAttributes(page),
        frontFragment,
        backFragment,
    };
}

function setText(root: ParentNode, id: string, value: string) {
    const element = root.querySelector<HTMLElement>(`#${id}`);
    if (element) element.textContent = value;
}

export function fillAttendanceRoster(
    root: HTMLElement,
    roster: AttendancePrintRoster,
    session: string,
    // firstRowNumber keeps numbering continuous when a class is split across sheets.
    options: { dailyAttendance?: boolean; firstRowNumber?: number } = {},
) {
    const firstRowNumber = options.firstRowNumber ?? 1;
    const startDate = roster.completed
        ? [...roster.completed.lessonDates].sort()[0] ?? ""
        : roster.schedule.trim().split(/\s+/)[1] ?? "";
    setText(root, "instructor", roster.instructor);
    setText(
        root,
        "start_time",
        [startDate, roster.time].filter(Boolean).join(" ").trim(),
    );
    setText(root, "session", session);
    setText(root, "location", roster.location);
    setText(root, "barcode", roster.code);

    const body = root.querySelector<HTMLTableSectionElement>(
        "#attendance-rows",
    );
    const header = root.querySelector<HTMLTableRowElement>("#student-rows");
    if (!body || !header) return;
    Array.from(body.querySelectorAll(":scope > tr")).forEach((row) => {
        if (row !== header) row.remove();
    });
    const blankCells = Math.max(header.children.length - 1, 0);

    roster.students.forEach((student, index) => {
        const row = root.ownerDocument.createElement("tr");
        row.dataset.generatedAttendanceRow = "true";
        const nameCell = root.ownerDocument.createElement("td");
        const strong = root.ownerDocument.createElement("strong");
        strong.style.fontFamily = "Arial";
        strong.textContent = `${firstRowNumber + index}. ${student.name}`;
        nameCell.append(strong);

        const font = root.ownerDocument.createElement("font");
        font.append(root.ownerDocument.createElement("br"));

        const absent = root.ownerDocument.createElement("span");
        absent.style.textDecoration = "underline";
        absent.textContent = "A";
        font.append(absent, "bsent/");
        const present = root.ownerDocument.createElement("span");
        present.style.textDecoration = "underline";
        present.textContent = "P";
        font.append(present, "resent", root.ownerDocument.createElement("br"));
        const days = root.ownerDocument.createElement("span");
        days.style.color = "rgb(98, 98, 98)";
        days.style.fontSize = "10.5px";
        if (roster.completed) {
            days.style.fontFamily = 'Arial';
            days.style.fontSize = '9px';
            days.textContent = [...roster.completed.lessonDates].sort().map(date => {
                const status = student.results?.attendance[date];
                const mark = status === 'present' ? '✓' : status === 'absent' ? '×' : ' ';
                return `[${date.slice(5).replace('-', '/')} ${mark}]`;
            }).join(' ');
        } else {
            days.textContent = Array.from(
                { length: 14 },
                (_, day) => `[Day ${day + 1}]`,
            ).join(" ");
        }
        font.append(days);
        if (options.dailyAttendance !== false) nameCell.append(font);
        row.append(nameCell);
        for (let cellIndex = 0; cellIndex < blankCells; cellIndex += 1) {
            const cell = root.ownerDocument.createElement("td");
            cell.append("\u00a0");
            row.append(cell);
        }
        body.append(row);
    });
}

import { buildSchematicMatrix, effectiveSchematicScale, formatSchematicTime, } from "../pdf/schematic/schematicModel";
import type { SchematicPdfRequest } from "../pdf/types";

function element(
    document: Document,
    tag: string,
    styles: Partial<CSSStyleDeclaration> = {},
) {
    const node = document.createElement(tag);
    Object.assign(node.style, styles);
    return node;
}

function textCell(
    document: Document,
    text: string,
    width: number,
    height: number,
    styles: Partial<CSSStyleDeclaration> = {},
) {
    const cell = element(document, "div", {
        width: `${width}pt`,
        height: `${height}pt`,
        border: "var(--schematic-border-width, 1pt) solid #000",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        overflow: "hidden",
        boxSizing: "border-box",
        flexShrink: "0",
        fontSize: "inherit",
        lineHeight: "1.1",
        ...styles,
    });
    cell.textContent = text;
    return cell;
}

export function buildSchematicCoverElement(
    document: Document,
    request: SchematicPdfRequest,
) {
    const orientation = request.orientation === "landscape"
        ? "landscape"
        : "portrait";
    const model = buildSchematicMatrix(request);
    if (!model) {
        throw new Error("No schematic data found for the attendance cover.");
    }
    const scale = effectiveSchematicScale(
        orientation,
        model.totalRows,
        request.scalePercent,
    );
    const printableWidth = orientation === "landscape" ? 756 : 576;
    const timeWeight = 16.5;
    const classWeight = 26;
    const totalWeight = timeWeight * 2 + classWeight * model.columnCount;
    const timeWidth = printableWidth * scale * timeWeight / totalWeight;
    const classWidth = printableWidth * scale * classWeight / totalWeight;
    const tableWidth = printableWidth * scale;
    const highlighted = (index: number) =>
        Boolean(
            request.highlightInstructor && request.selectedInstructor &&
            !["none", "one-each"].includes(request.selectedInstructor) &&
            request.instructors?.[index]?.trim().toLowerCase() ===
            request.selectedInstructor.trim().toLowerCase(),
        );

    const table = element(document, "div", {
        flexShrink: "0",
        fontSize: `${11 * scale}pt`,
        width: `${tableWidth}pt`,
        fontFamily: "Arial, sans-serif",
        color: "#111",
    });
    table.style.setProperty("--schematic-border-width", `${Math.max(0.35, scale)}pt`);
    const band = (value: string, height: number, fontSize: number) => {
        const node = textCell(document, value, tableWidth, height * scale, {
            backgroundColor: "#000",
            color: "#fff",
            fontSize: `${fontSize * scale}pt`,
            fontWeight: "700",
        });
        table.append(node);
    };
    band(request.title?.trim() || "Schematic", 30, 20);
    table.append(element(document, "div", { height: `${3.75 * scale}pt` }));
    band(request.dateRange ?? "", 30, 16);

    const metadata = element(document, "div", {
        display: "flex",
        height: `${30 * scale}pt`,
    });
    metadata.append(
        textCell(
            document,
            `Deck Supervisor:${request.deckSupervisorName?.trim()
                ? ` ${request.deckSupervisorName.trim()}`
                : ""
            }`,
            tableWidth / 2,
            30 * scale,
            { fontWeight: "600" },
        ),
        textCell(
            document,
            `Cancelled Dates:${request.weeksLabel ? `\n${request.weeksLabel}` : ""
            }`,
            tableWidth / 2,
            30 * scale,
            { fontWeight: "600", whiteSpace: "pre-line" },
        ),
    );
    table.append(metadata);

    const header = element(document, "div", {
        display: "flex",
        height: `${36 * scale}pt`,
    });
    header.append(
        textCell(document, "TIME", timeWidth, 36 * scale, {
            fontWeight: "700",
        }),
    );
    const instructorHeader = element(document, "div", {
        width: `${classWidth * model.columnCount}pt`,
    });
    instructorHeader.append(
        textCell(
            document,
            "Instructors / Level",
            classWidth * model.columnCount,
            18 * scale,
            { fontWeight: "700" },
        ),
    );
    const instructorRow = element(document, "div", { display: "flex" });
    Array.from({ length: model.columnCount }, (_, index) => {
        instructorRow.append(
            textCell(
                document,
                request.instructors?.[index]?.trim() ||
                `Instructor ${index + 1}`,
                classWidth,
                18 * scale,
                {
                    backgroundColor: highlighted(index) ? "#FFEB3B" : "#fff",
                    fontWeight: "600",
                },
            ),
        );
    });
    instructorHeader.append(instructorRow);
    header.append(
        instructorHeader,
        textCell(document, "TIME", timeWidth, 36 * scale, {
            fontWeight: "700",
        }),
    );
    table.append(header);

    model.matrix.forEach((row, rowIndex) => {
        const rowNode = element(document, "div", {
            display: "flex",
            height: `${15 * scale}pt`,
        });
        const time = rowIndex % 4 === 0
            ? formatSchematicTime(
                model.baseMinutes + Math.floor(rowIndex / 4) * 30,
            )
            : "";
        rowNode.append(textCell(document, time, timeWidth, 15 * scale));
        row.forEach((cell, columnIndex) => {
            const cellNode = textCell(
                document,
                cell.text ?? "",
                classWidth,
                15 * scale,
                {
                    backgroundColor: highlighted(columnIndex)
                        ? "#FFEB3B"
                        : cell.kind === "empty"
                            ? "#D9D9D9"
                            : cell.color ?? "#fff",
                    borderTopWidth:
                        cell.border === "middle" || cell.border === "bottom"
                            ? "0"
                            : "var(--schematic-border-width)",
                    borderBottomWidth:
                        cell.border === "middle" || cell.border === "top"
                            ? "0"
                            : "var(--schematic-border-width)",
                    borderLeftWidth: cell.kind === "empty" ? "0" : "var(--schematic-border-width)",
                    borderRightWidth: cell.kind === "empty" ? "0" : "var(--schematic-border-width)",
                },
            );
            rowNode.append(cellNode);
        });
        rowNode.append(textCell(document, time, timeWidth, 15 * scale));
        table.append(rowNode);
    });

    const viewport = element(document, "div", {
        width: "10.5in",
        height: "8in",
        flexShrink: "0",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "flex-start",
        overflow: "hidden",
    });
    if (orientation === "portrait") {
        const rotated = element(document, "div", {
            position: "relative",
            width: "8in",
            height: "10.5in",
            flexShrink: "0",
            transform: "translateY(8in) rotate(-90deg)",
            transformOrigin: "top left",
            display: "flex",
            justifyContent: "flex-start",
            alignItems: "flex-start",
        });
        rotated.append(table);
        viewport.append(rotated);
    } else {
        viewport.append(table);
    }
    return viewport;
}

// Attendance templates intentionally overflow the printable width. Browsers fit
// the entire job to that width, which also shrinks the otherwise point-sized
// schematic. Measure with the print-only template styles in beforeprint and
// compensate only the cover, leaving the historical attendance layout intact.
export function prepareSchematicCoversForPrint(printWindow: Window) {
    const document = printWindow.document;
    const covers = Array.from(document.querySelectorAll<HTMLElement>(
        '[data-page-kind="schematic-cover"]',
    ));
    if (!covers.length) return;
    // Chromium fires beforeprint before activating print media. Temporarily
    // activate our inline print rules and disable screen-only template utilities
    // so the measurement also works when the dialog starts from screen media.
    const mediaRules = Array.from(document.styleSheets).flatMap((sheet) =>
        Array.from(sheet.cssRules).filter((rule) => rule.type === 4)
            .map((rule) => rule as CSSMediaRule)
            .filter((rule) => ["screen", "print"].includes(rule.media.mediaText))
            .map((rule) => ({ rule, media: rule.media.mediaText }))
    );
    let contentWidth: number;
    let leftMargin: number;
    let topMargin: number;
    const printableWidth = 10.6 * 96; // Letter landscape with 0.2-inch margins.
    try {
        mediaRules.forEach(({ rule, media }) => {
            rule.media.mediaText = media === "print" ? "all" : "not all";
        });
        const bodyStyle = printWindow.getComputedStyle(document.body);
        leftMargin = parseFloat(bodyStyle.marginLeft) || 0;
        topMargin = parseFloat(bodyStyle.marginTop) || 0;
        const bodyLeft = document.body.getBoundingClientRect().left;
        contentWidth = Math.max(printableWidth, ...Array.from(
            document.querySelectorAll<HTMLElement>('[data-page-kind^="attendance-"] table'),
            (table) => {
                const bounds = table.getBoundingClientRect();
                return bounds.left - bodyLeft + Math.max(bounds.width, table.scrollWidth)
                    + leftMargin;
            },
        ));
    } finally {
        mediaRules.forEach(({ rule, media }) => { rule.media.mediaText = media; });
    }
    const compensation = contentWidth / printableWidth;
    covers.forEach((cover, index) => {
        const viewport = cover.firstElementChild as HTMLElement;
        viewport.style.transform = `translateY(${index === 0 ? -topMargin : 0}px) scale(${compensation})`;
        viewport.style.transformOrigin = "top left";
        // Match the standalone PDF's quarter-inch inset, within the job's
        // 0.2-inch page margin, after the browser's fit-to-width reduction.
        cover.style.marginLeft = `${4.8 * compensation - leftMargin}px`;
        cover.style.paddingTop = `${4.8 * compensation}px`;
    });
}

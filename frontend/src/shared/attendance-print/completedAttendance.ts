import manifest from './completedPrintMap.json';
import type { AttendancePrintRoster } from './types';
import { handMarkSvg, handTextSvg } from './handMarks';
import { levelResult } from './levelProgression';

export const COMPLETED_PRINT_CURRICULUM_VERSION = manifest.curriculumVersion;
export type CompletedPrintColumn = {cellIndex: number; heading: string; skillIds: string[]; aggregation: 'all' | 'any'};
const mappings = manifest.levels as Record<string, CompletedPrintColumn[]>;
const clean = (value: string) => value.replace(/\s+/g, ' ').trim();

/** Current catalog preserves separate printed columns, including repeated numbers.
 * Explicit aggregation also supports a reviewed shared-column mapping without
 * matching by title or accidentally summing different required components. */
export function earnedChecks(column: CompletedPrintColumn, attempts: Record<string, number>): number {
    if (!column.skillIds.length) return 0;
    const counts = column.skillIds.map(id => Math.min(3, Math.max(0, Math.floor(attempts[id] || 0))));
    return column.aggregation === 'any' ? Math.max(...counts) : Math.min(...counts);
}

export function validateCompletedRoster(roster: AttendancePrintRoster, template: string): void {
    if (!roster.completed) return;
    if (roster.completed.unresolvedConflicts) throw new Error('Resolve result conflicts before printing completed sheets.');
    if (roster.completed.curriculumVersion !== manifest.curriculumVersion) throw new Error('These results use a different curriculum. Review the curriculum before printing.');
    if (!mappings[template]?.length) throw new Error('Choose the swimmer’s assessed curriculum sheet for completed printing.');
    const ids = new Set<string>();
    for (const student of roster.students) {
        if (!student.name.trim() || !student.enrollmentId || !student.results) throw new Error('Resolve every student from the local roster before printing completed sheets.');
        if (ids.has(student.enrollmentId)) throw new Error('A student identity occurs twice in the completed sheet.');
        ids.add(student.enrollmentId);
        if (Object.values(student.results.successfulAttempts).some(n => !Number.isInteger(n) || n < 0)) throw new Error('Invalid saved skill progress.');
        if (Object.entries(student.results.attendance).some(([date, value]) => !roster.completed!.lessonDates.includes(date) || !['present', 'absent', 'unmarked'].includes(value))) throw new Error('Attendance does not match the selected lesson dates.');
    }
    if (!roster.completed.lessonDates.length || new Set(roster.completed.lessonDates).size !== roster.completed.lessonDates.length || roster.completed.lessonDates.some(date => !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date)) throw new Error('Completed sheets need valid, unique lesson dates.');
}

export function fillCompletedMarks(root: HTMLElement, roster: AttendancePrintRoster, template: string): void {
    if (!roster.completed) return;
    validateCompletedRoster(roster, template);
    const header = root.querySelector('#student-rows');
    if (!header) return; // Back page retains the historical requirements verbatim.
    const columns = mappings[template];
    for (const column of columns) {
        if (clean(header.children[column.cellIndex]?.textContent || '') !== column.heading) throw new Error('The attendance template changed. Regenerate and review its curriculum mapping.');
    }
    // The sheet's own "Result: Complete (c) Incomplete (I)" and "Register in" columns, found by their printed heading.
    const headings = [...header.children].map(cell => clean(cell.textContent || '').toLowerCase());
    const resultIndex = headings.findIndex(text => text.startsWith('result')), registerIndex = headings.findIndex(text => text.startsWith('register in'));
    const rows = root.querySelectorAll<HTMLTableRowElement>('[data-generated-attendance-row]');
    rows.forEach((row, index) => {
        const student = roster.students[index];
        const id = student.enrollmentId!;
        row.dataset.enrollmentId = id;
        // Marks are pen strokes laid over the untouched blank sheet, so it reads like one filled in by hand.
        for (const column of columns) {
            const cell = row.children[column.cellIndex] as HTMLElement;
            const count = earnedChecks(column, student.results!.successfulAttempts);
            cell.dataset.earnedChecks = String(count);
            if (!count) continue;
            cell.style.position = 'relative';
            const marks = root.ownerDocument.createElement('span');
            marks.className = 'hand-checks';
            marks.dataset.count = String(count);
            for (let mark = 0; mark < count; mark += 1) marks.append(handMarkSvg(root.ownerDocument, 'check', `${id}:${column.cellIndex}:${mark}`));
            cell.append(marks);
        }
        const outcome = levelResult(template, student.results!.successfulAttempts);
        for (const [index, text, name] of [[resultIndex, outcome.result, 'result'], [registerIndex, outcome.registerIn, 'registerIn']] as const) {
            const cell = row.children[index] as HTMLElement | undefined;
            if (index < 0 || !cell) continue;
            cell.dataset[name] = text;
            cell.style.position = 'relative';
            const holder = root.ownerDocument.createElement('span');
            holder.className = 'hand-outcome';
            holder.append(handTextSvg(root.ownerDocument, text, `${id}:${name}`, { strokeWidth: ATTENDANCE_STROKE }));
            cell.append(holder);
        }
        row.querySelectorAll<HTMLElement>('[data-date]').forEach(slot => {
            const status = student.results!.attendance[slot.dataset.date!];
            if (status !== 'present' && status !== 'absent') return;
            slot.dataset.attendance = status;
            slot.style.position = 'relative';
            const mark = handMarkSvg(root.ownerDocument, status === 'present' ? 'P' : 'A', `${id}:${slot.dataset.date}`, { strokeWidth: ATTENDANCE_STROKE });
            mark.classList.add('hand-attendance');
            slot.append(mark);
        });
    });
}

/** Pen weight of the P and A letters (viewBox units; checks use the default of about 7), bold enough to read over the grey [Day n] text. */
export const ATTENDANCE_STROKE = 13;

/** Sizes and places the pen marks inside their cells; part of the print document's stylesheet. */
export const HAND_MARK_CSS = `
.hand-checks{position:absolute;inset:6% 8%;display:flex;flex-direction:column;align-items:center;justify-content:space-evenly;pointer-events:none}
.hand-checks .hand-mark{width:78%;height:30%;flex:0 0 30%;overflow:visible}
.hand-checks .hand-mark:nth-child(2){transform:translateX(8%)}
.hand-checks .hand-mark:nth-child(3){transform:translateX(-5%)}
.hand-attendance{position:absolute;left:50%;top:-0.62em;width:1.9em;height:1.9em;margin-left:-0.95em;overflow:visible;pointer-events:none}
.hand-outcome{position:absolute;inset:22% 8%;display:flex;align-items:center;justify-content:center;pointer-events:none}
.hand-outcome .hand-mark{width:100%;height:100%;max-height:2.4em}
.hand-mark{-webkit-print-color-adjust:exact;print-color-adjust:exact}
`;

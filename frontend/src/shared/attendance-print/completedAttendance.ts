import manifest from './completedPrintMap.json';
import type { AttendancePrintRoster } from './types';

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
    const rows = root.querySelectorAll<HTMLTableRowElement>('[data-generated-attendance-row]');
    rows.forEach((row, index) => {
        const student = roster.students[index];
        row.dataset.enrollmentId = student.enrollmentId!;
        for (const column of columns) {
            const cell = row.children[column.cellIndex] as HTMLElement;
            const count = earnedChecks(column, student.results!.successfulAttempts);
            cell.textContent = count ? '✓'.repeat(count) : '\u00a0';
            cell.style.fontFamily = 'Arial';
            cell.style.fontSize = '10px';
            cell.style.textAlign = 'center';
            cell.dataset.earnedChecks = String(count);
        }
    });
}

// Completion-audit regressions for completed attendance sheets: every assessable template is
// actually rendered (the mapping test only inspects the manifest), and the result is compared
// with the unchanged blank pipeline for the same roster.
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import resultsCurriculum from '../../features/results/curriculum.json';
import planningLevels from '../../features/instructor/LessonPlans/lessonSkills.json';
import { buildAttendancePrintDocument, COMPLETED_STUDENTS_PER_SHEET as LIMIT } from './buildAttendancePrintDocument';
import { earnedChecks, type CompletedPrintColumn } from './completedAttendance';
import { levelCode } from './levelProgression';
import manifest from './completedPrintMap.json';
import { LEGACY_ATTENDANCE_TEMPLATE_KEYS } from './templateRegistry';
import type { AttendancePrintRoster } from './types';

const levels = manifest.levels as Record<string, CompletedPrintColumn[]>;
const assessable = LEGACY_ATTENDANCE_TEMPLATE_KEYS.filter(key => levels[key]?.length);
const DATES = ['2026-09-07', '2026-09-14', '2026-09-21'];
const blankRoster = (template: string, names: string[]): AttendancePrintRoster => ({
    code: '001', level: template, serviceName: template, time: '09:00', instructor: 'Alex', location: 'Pool',
    schedule: `Mon ${DATES[0]}`, students: names.map(name => ({ name })),
});
const count = (studentIndex: number, columnIndex: number) => (studentIndex + columnIndex) % 5; // 0..4: 4 must cap at 3
const completedRoster = (template: string, names: string[]): AttendancePrintRoster => ({
    ...blankRoster(template, names),
    completed: { curriculumVersion: manifest.curriculumVersion, lessonDates: DATES },
    students: names.map((name, studentIndex) => ({
        name, enrollmentId: `enrollment-${studentIndex}`,
        results: {
            attendance: { [DATES[0]]: 'present', [DATES[1]]: 'absent', [DATES[2]]: 'unmarked' },
            successfulAttempts: Object.fromEntries(levels[template].map((column, columnIndex) => [column.skillIds[0], count(studentIndex, columnIndex)])),
        },
    })),
});
const page = (document: Document, kind: string) => document.querySelector<HTMLElement>(`[data-page-kind="${kind}"]`)!;
function withoutStudentRows(front: HTMLElement) {
    const clone = front.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('[data-generated-attendance-row]').forEach(row => row.remove());
    return clone.innerHTML;
}

describe('completed sheets across every production template', () => {
    it('has exactly 23 template keys, 22 of them assessable, and the unassessed private sheet is refused', async () => {
        expect(LEGACY_ATTENDANCE_TEMPLATE_KEYS).toHaveLength(23);
        expect(Object.keys(levels).sort()).toEqual([...LEGACY_ATTENDANCE_TEMPLATE_KEYS].sort());
        expect(LEGACY_ATTENDANCE_TEMPLATE_KEYS.filter(key => !levels[key].length)).toEqual(['SplashPrivate']);
        expect(assessable).toHaveLength(22);
        await expect(buildAttendancePrintDocument({ template: 'SplashPrivate', roster: { ...completedRoster('Splash1', ['A']), level: 'SplashPrivate' } })).rejects.toThrow('assessed curriculum');
    });

    it.each(assessable)('%s: fills mapped columns with 0–3 checks, leaves every other cell blank, and keeps the template and reverse side identical to blank printing', async template => {
        const names = ['First Swimmer', 'Second Swimmer'];
        const completed = await buildAttendancePrintDocument({ template, roster: completedRoster(template, names), session: 'Fall 2026' });
        const blank = await buildAttendancePrintDocument({ template, roster: blankRoster(template, names), session: 'Fall 2026' });
        const columns = levels[template], mapped = new Map(columns.map((column, index) => [column.cellIndex, index]));
        const rows = [...completed.querySelectorAll<HTMLTableRowElement>('[data-generated-attendance-row]')];
        const blankRows = [...blank.querySelectorAll<HTMLTableRowElement>('[data-generated-attendance-row]')];
        expect(rows).toHaveLength(2);
        const seen = new Set<number>();
        rows.forEach((row, studentIndex) => {
            expect(row.dataset.enrollmentId).toBe(`enrollment-${studentIndex}`);
            expect(row.children).toHaveLength(blankRows[studentIndex].children.length);
            expect(row.children[0].textContent).toContain(`${studentIndex + 1}. ${names[studentIndex]}`);
            expect(row.children[0].textContent).toContain('Absent/Present');
            expect([...row.querySelectorAll<HTMLElement>('[data-date]')].map(slot => `${slot.textContent}${slot.querySelector('svg')?.dataset.mark ?? ''}`)).toEqual(['[Day 1]P', '[Day 2]A', '[Day 3]']);
            [...row.children].slice(1).forEach((cell, offset) => {
                const cellIndex = offset + 1, columnIndex = mapped.get(cellIndex), element = cell as HTMLElement;
                const heading = (completed.querySelector('#student-rows')!.children[cellIndex].textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
                if (heading.startsWith('result') || heading.startsWith('register in')) {
                    // Result and Register in are written by hand: I and the same level, since no swimmer here completed every skill.
                    const text = heading.startsWith('result') ? 'I' : levelCode(template);
                    expect(element.querySelector('svg[data-mark="text"]')?.getAttribute('data-text'), `${template} ${heading}`).toBe(text);
                    return;
                }
                if (columnIndex === undefined) {
                    // Administrative and unnumbered columns stay exactly as the blank sheet prints them.
                    expect(element.dataset.earnedChecks, `${template} cell ${cellIndex}`).toBeUndefined();
                    expect(element.outerHTML).toBe(blankRows[studentIndex].children[cellIndex].outerHTML);
                    expect(element.textContent!.trim()).toBe('');
                    return;
                }
                const expected = Math.min(3, count(studentIndex, columnIndex));
                seen.add(expected);
                expect(element.dataset.earnedChecks, `${template} ${columns[columnIndex].heading}`).toBe(String(expected));
                expect(element.querySelectorAll('svg[data-mark="check"]')).toHaveLength(expected);
                expect(element.textContent!.trim()).toBe('');
            });
        });
        expect(row0Checks(rows[0])).toHaveLength(columns.length);
        if (columns.length >= 4) expect([...seen].sort()).toEqual([0, 1, 2, 3]);
        expect(page(completed, 'attendance-back').innerHTML).toBe(page(blank, 'attendance-back').innerHTML);
        expect(page(completed, 'attendance-back').querySelector('[data-earned-checks]')).toBeNull();
        expect(withoutStudentRows(page(completed, 'attendance-front'))).toBe(withoutStudentRows(page(blank, 'attendance-front')));
        expect(completed.querySelectorAll('.print-page')).toHaveLength(2);
    });

    it('leaves blank (non-completed) printing free of completed markup', async () => {
        for (const template of LEGACY_ATTENDANCE_TEMPLATE_KEYS) {
            const blank = await buildAttendancePrintDocument({ template, roster: blankRoster(template, ['Student']) });
            expect(blank.querySelector('[data-earned-checks]'), template).toBeNull();
            expect(blank.querySelector('[data-enrollment-id]'), template).toBeNull();
            const row = blank.querySelector('[data-generated-attendance-row]')!;
            expect(row.children[0].textContent).toContain(Array.from({ length: 14 }, (_, day) => `[Day ${day + 1}]`).join(' '));
            expect(row.textContent).not.toContain('✓');
            expect(blank.querySelectorAll('.print-page')).toHaveLength(2);
        }
    });

    it('splits continuation pages so each student and lesson date is printed exactly once with its own marks', async () => {
        const dates = Array.from({ length: 15 }, (_, i) => `2026-09-${String(i + 1).padStart(2, '0')}`);
        const roster = completedRoster('Splash1', Array.from({ length: LIMIT + 1 }, (_, i) => `Swimmer ${i}`));
        // Deliberately unsorted input dates: slices must still be chronological.
        roster.completed!.lessonDates = [...dates].reverse();
        roster.students.forEach((student, index) => { student.results!.attendance = { [dates[0]]: 'present', [dates[14]]: index === LIMIT ? 'absent' : 'present' }; });
        const document = await buildAttendancePrintDocument({ template: 'Splash1', roster });
        const fronts = [...document.querySelectorAll<HTMLElement>('[data-page-kind="attendance-front"]')];
        const summary = fronts.map(front => [...front.querySelectorAll<HTMLTableRowElement>('[data-generated-attendance-row]')].map(row => ({ id: row.dataset.enrollmentId!, text: row.children[0].textContent!, checks: row0Checks(row) })));
        expect(summary.map(rows => rows.map(row => row.id))).toEqual([
            Array.from({ length: LIMIT }, (_, i) => `enrollment-${i}`), Array.from({ length: LIMIT }, (_, i) => `enrollment-${i}`), [`enrollment-${LIMIT}`], [`enrollment-${LIMIT}`],
        ]);
        const dateLabels = (front: number, row: number) => [...fronts[front].querySelectorAll<HTMLTableRowElement>('[data-generated-attendance-row]')[row].querySelectorAll<HTMLElement>('[data-date]')].map(slot => `${slot.textContent}=${slot.dataset.date}${slot.querySelector('svg')?.dataset.mark ?? ''}`);
        expect(dateLabels(0, 0)).toEqual(dates.slice(0, 14).map((date, i) => `[Day ${i + 1}]=${date}${i === 0 ? 'P' : ''}`));
        // A continuation sheet numbers its slots on from the first sheet: lesson 15 is [Day 15].
        expect(dateLabels(1, 0)).toEqual([`[Day 15]=${dates[14]}P`]);
        expect(dateLabels(3, 0)).toEqual([`[Day 15]=${dates[14]}A`]);
        // Earned checks are cumulative for the session and repeat unchanged on each continuation sheet.
        expect(summary[1][0].checks).toEqual(summary[0][0].checks);
        expect(summary[3][0].checks).toEqual(summary[2][0].checks);
        expect(summary[2][0].checks).toEqual(levels.Splash1.map((_, columnIndex) => Math.min(3, count(LIMIT, columnIndex))));
    });

    it('rejects malformed completed input instead of printing a misleading sheet', async () => {
        const build = (change: (roster: AttendancePrintRoster) => void) => { const roster = completedRoster('Splash1', ['A', 'B']); change(roster); return buildAttendancePrintDocument({ template: 'Splash1', roster }); };
        await expect(build(r => { r.students[1].enrollmentId = r.students[0].enrollmentId; })).rejects.toThrow('occurs twice');
        await expect(build(r => { r.students[0].name = '  '; })).rejects.toThrow('Resolve every student');
        await expect(build(r => { r.students[0].results = undefined; })).rejects.toThrow('Resolve every student');
        await expect(build(r => { r.students[0].results!.successfulAttempts['Splash1:1'] = 1.5; })).rejects.toThrow('Invalid saved skill progress');
        await expect(build(r => { r.students[0].results!.successfulAttempts['Splash1:1'] = -1; })).rejects.toThrow('Invalid saved skill progress');
        await expect(build(r => { r.completed!.lessonDates = []; r.students.forEach(s => { s.results!.attendance = {}; }); })).rejects.toThrow('valid, unique lesson dates');
        await expect(build(r => { r.completed!.lessonDates = [DATES[0], DATES[0]]; r.students.forEach(s => { s.results!.attendance = {}; }); })).rejects.toThrow('valid, unique lesson dates');
        await expect(build(r => { r.completed!.lessonDates = ['2026-02-30']; r.students.forEach(s => { s.results!.attendance = {}; }); })).rejects.toThrow('valid, unique lesson dates');
        await expect(build(r => { r.completed!.unresolvedConflicts = true; })).rejects.toThrow('Resolve result conflicts');
    });
});

function row0Checks(row: HTMLTableRowElement) {
    return [...row.querySelectorAll<HTMLElement>('[data-earned-checks]')].map(cell => Number(cell.dataset.earnedChecks));
}

describe('curriculum-column mapping completeness against generated curriculum metadata', () => {
    const skills = resultsCurriculum.skills as Record<string, string>, criteria = resultsCurriculum.criteria as Record<string, string>;
    const mappedIds = Object.values(levels).flatMap(columns => columns.flatMap(column => column.skillIds));

    it('maps every generated skill to exactly one column and no column to a nonexistent skill', () => {
        expect(resultsCurriculum.version).toBe(manifest.curriculumVersion);
        expect(new Set(mappedIds).size).toBe(mappedIds.length);
        expect([...mappedIds].sort()).toEqual(Object.keys(skills).sort());
        for (const [level, columns] of Object.entries(levels)) for (const column of columns) {
            expect(column.skillIds.length, `${level} ${column.heading}`).toBeGreaterThan(0);
            expect(['all', 'any']).toContain(column.aggregation);
            expect(column.cellIndex).toBeGreaterThan(0);
            for (const id of column.skillIds) expect(id.startsWith(`${level}:`), `${id} is printed on ${level}`).toBe(true);
        }
        for (const columns of Object.values(levels)) expect(new Set(columns.map(column => column.cellIndex)).size).toBe(columns.length);
    });

    it('has assessable criteria for every mapped skill and no criterion outside a mapped skill', () => {
        const withCriteria = new Set(Object.keys(criteria).map(id => id.slice(0, id.lastIndexOf(':'))));
        expect([...withCriteria].sort()).toEqual([...new Set(mappedIds)].sort());
        for (const id of ['Splash7:10', 'Splash8:9', 'Splash9:11']) expect(mappedIds, `timed benchmark ${id}`).toContain(id);
    });

    it('keeps lesson-planning metadata on the same levels and skill IDs', () => {
        expect(planningLevels.map(level => level.id).sort()).toEqual(Object.keys(levels).sort());
        expect(planningLevels.flatMap(level => level.skills.map(skill => skill.id)).sort()).toEqual(Object.keys(skills).sort());
    });

    it('aggregates multi-skill columns by required minimum or alternative maximum with a cap of three', () => {
        const column = { cellIndex: 1, heading: 'shared', skillIds: ['a', 'b', 'c'], aggregation: 'all' as const };
        expect(earnedChecks(column, { a: 9, b: 2, c: 5 })).toBe(2);
        expect(earnedChecks(column, { a: 9, b: 7, c: 5 })).toBe(3);
        expect(earnedChecks({ ...column, aggregation: 'any' }, { a: 0, b: 2, c: 1 })).toBe(2);
        expect(earnedChecks({ ...column, aggregation: 'any' }, { a: 9 })).toBe(3);
        expect(earnedChecks({ ...column, aggregation: 'any' }, {})).toBe(0);
        expect(earnedChecks({ ...column, skillIds: [] }, { a: 3 })).toBe(0);
    });

    const catalogPath = resolve(process.cwd(), '../../rec-tablet/src/workflows/swimming/curriculum/catalog.json');
    it.runIf(existsSync(catalogPath))('matches the tablet catalog verbatim: version, skill names, criterion IDs and text, and print headings', () => {
        const catalog = JSON.parse(readFileSync(catalogPath, 'utf8')) as { version: string; levels: { id: string; skills: { id: string; number: string; name: string; subskills: { id: string; text: string }[] }[] }[] };
        const expectedSkills: Record<string, string> = {}, expectedCriteria: Record<string, string> = {};
        for (const level of catalog.levels) for (const skill of level.skills) { expectedSkills[skill.id] = skill.name; for (const criterion of skill.subskills) expectedCriteria[criterion.id] = criterion.text; }
        expect(resultsCurriculum.version).toBe(catalog.version);
        expect(skills).toEqual(expectedSkills);
        expect(criteria).toEqual(expectedCriteria);
        expect(Object.keys(criteria)).toHaveLength(catalog.levels.reduce((total, level) => total + level.skills.reduce((sum, skill) => sum + skill.subskills.length, 0), 0));
        const squash = (value: string) => value.replace(/\s/g, '');
        for (const level of catalog.levels) {
            expect(levels[level.id].map(column => column.skillIds)).toEqual(level.skills.map(skill => [skill.id]));
            levels[level.id].forEach((column, index) => expect(squash(column.heading)).toBe(squash(`${level.skills[index].number}. ${level.skills[index].name}`)));
        }
    });
});

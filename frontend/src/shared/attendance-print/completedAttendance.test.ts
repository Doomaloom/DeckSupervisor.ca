import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import planningLevels from '../../features/instructor/LessonPlans/lessonSkills.json';
import { buildAttendancePrintDocument, COMPLETED_STUDENTS_PER_SHEET } from './buildAttendancePrintDocument';
import { COMPLETED_PRINT_CURRICULUM_VERSION, earnedChecks } from './completedAttendance';
import manifest from './completedPrintMap.json';
import { LEGACY_ATTENDANCE_TEMPLATE_KEYS, loadAttendanceTemplate } from './templateRegistry';
import { extractAttendanceTemplateSections } from './templateDom';
import type { AttendancePrintRoster } from './types';
const roster = (): AttendancePrintRoster => ({
    code:'001', level:'Splash1', serviceName:'Splash 1', time:'09:00', instructor:'Alex', location:'Pool', schedule:'Mon 2026-09-07',
    completed:{curriculumVersion:COMPLETED_PRINT_CURRICULUM_VERSION, lessonDates:['2026-09-07','2026-09-14','2026-09-21']},
    students:[{name:'Avery <Test>', enrollmentId:'enrollment-1', results:{attendance:{'2026-09-07':'present','2026-09-14':'absent'},successfulAttempts:{'Splash1:1':1,'Splash1:2':2,'Splash1:3':4}}}],
});
describe('completed historical attendance sheets', () => {
    it('fills earned checks and dated attendance safely, leaves administrative fields blank', async () => {
        const document = await buildAttendancePrintDocument({template:'Splash1', roster:roster()});
        const row = document.querySelector('[data-generated-attendance-row]')!;
        expect([...row.querySelectorAll('[data-earned-checks]')].slice(0,4).map(cell => cell.textContent?.trim())).toEqual(['✓','✓✓','✓✓✓','']);
        expect(row.textContent).toContain('Avery <Test>');
        expect(row.querySelector('test')).toBeNull();
        expect(row.textContent).toContain('[09/07 ✓] [09/14 ×] [09/21  ]');
        expect(row.children[1].textContent?.trim()).toBe('');
        expect(document.querySelector('#start_time')?.textContent).toBe('2026-09-07 09:00');
        expect(document.querySelector('[data-page-kind="attendance-back"]')?.textContent).toContain('Foot-first entry');
    });
    it('blocks unresolved names, conflicts, unknown curriculum, or wrong lesson attendance', async () => {
        for (const change of [
            (r:AttendancePrintRoster) => {r.students[0].enrollmentId = undefined;},
            (r:AttendancePrintRoster) => {r.completed!.unresolvedConflicts = true;},
            (r:AttendancePrintRoster) => {r.completed!.curriculumVersion = 'unknown';},
            (r:AttendancePrintRoster) => {r.students[0].results!.attendance['2026-01-01'] = 'present';},
        ]) { const r=roster(); change(r); await expect(buildAttendancePrintDocument({template:'Splash1',roster:r})).rejects.toThrow(); }
        await expect(buildAttendancePrintDocument({template:'SplashPrivate',roster:roster()})).rejects.toThrow('assessed curriculum');
    });
    it('repeats complete sheets only for classes over the one-sheet limit and long sessions', async () => {
        const r=roster(); r.students=Array.from({length:COMPLETED_STUDENTS_PER_SHEET+1},(_,i)=>({...r.students[0],enrollmentId:`e${i}`}));
        r.completed!.lessonDates=Array.from({length:15},(_,i)=>`2026-09-${String(i+1).padStart(2,'0')}`);
        r.students.forEach(s=>s.results={attendance:{},successfulAttempts:{}});
        const document=await buildAttendancePrintDocument({template:'Splash1',roster:r});
        expect(document.querySelectorAll('[data-page-kind="attendance-front"]')).toHaveLength(4);
        expect(document.querySelectorAll('[data-page-kind="attendance-back"]')).toHaveLength(4);
        expect(document.querySelectorAll('.combined-page')).toHaveLength(0);
        expect(document.querySelectorAll('.print-page:not([data-completed="true"])')).toHaveLength(0);
    });
    const classOf = (count: number, lessonDates = ['2026-09-10','2026-09-17']): AttendancePrintRoster => ({
        code:'98012', level:'Splash7', serviceName:'Splash 7', time:'17:00', instructor:'Alex', location:'Pool', schedule:'Thu 2026-09-10',
        completed:{curriculumVersion:COMPLETED_PRINT_CURRICULUM_VERSION, lessonDates},
        students:Array.from({length:count},(_,i)=>({
            name:`Swimmer ${i+1}`, enrollmentId:`e${i+1}`,
            results:{attendance:{[lessonDates[0]]:i%2?'absent':'present'}, successfulAttempts:{'Splash7:1':i%3+1,'Splash7:2':(i+1)%3}},
        })),
    });
    const fronts = (document: Document) => [...document.querySelectorAll('[data-page-kind="attendance-front"]')].map(page =>
        [...page.querySelectorAll<HTMLElement>('[data-generated-attendance-row]')].map(row => {
            const marks = [...row.querySelectorAll<HTMLElement>('[data-earned-checks]')].map(cell => Number(cell.dataset.earnedChecks));
            return {label: row.querySelector('td strong')!.textContent, id: row.dataset.enrollmentId, marks: marks.slice(0,2), ticks: row.querySelector('td font span:last-child')!.textContent};
        }));
    const expected = (n: number, lessonDates = ['2026-09-10','2026-09-17']) => ({
        label:`${n}. Swimmer ${n}`, id:`e${n}`, marks:[(n-1)%3+1, n%3],
        ticks:lessonDates.map((date,d)=>`[${date.slice(5).replace('-','/')} ${d===0 && date==='2026-09-10' ? ((n-1)%2?'×':'✓') : ' '}]`).join(' '),
    });
    it('keeps every realistic class on one sheet numbered 1 to N with each swimmer\'s results on their row', async () => {
        for (const count of [1, 8, 11, 12, 14, COMPLETED_STUDENTS_PER_SHEET]) {
            const document = await buildAttendancePrintDocument({template:'Splash7', roster:classOf(count)});
            expect(fronts(document), `${count} swimmers`).toEqual([Array.from({length:count},(_,i)=>expected(i+1))]);
            expect(document.querySelectorAll('[data-page-kind="attendance-back"]'), `${count} swimmers`).toHaveLength(1);
        }
    });
    it('maps marks by enrolment ID whatever order the roster lists swimmers in', async () => {
        const r = classOf(12); r.students.reverse();
        const rows = fronts(await buildAttendancePrintDocument({template:'Splash7', roster:r}))[0];
        expect(rows.map(row => row.id)).toEqual(Array.from({length:12},(_,i)=>`e${12-i}`));
        rows.forEach((row, i) => expect(row).toEqual({...expected(12-i), label:`${i+1}. Swimmer ${12-i}`}));
    });
    it('continues a class over the one-sheet limit on a second sheet numbered on from the first', async () => {
        const limit = COMPLETED_STUDENTS_PER_SHEET;
        const pages = fronts(await buildAttendancePrintDocument({template:'Splash7', roster:classOf(limit+2)}));
        expect(pages).toEqual([
            Array.from({length:limit},(_,i)=>expected(i+1)),
            [expected(limit+1), expected(limit+2)],
        ]);
    });
    it('repeats the same row numbers on date-continuation sheets', async () => {
        const dates = Array.from({length:15},(_,i)=>`2026-09-${String(i+10).padStart(2,'0')}`);
        const pages = fronts(await buildAttendancePrintDocument({template:'Splash7', roster:classOf(11, dates)}));
        expect(pages.map(rows => rows.map(row => row.label))).toEqual([
            Array.from({length:11},(_,i)=>i+1), Array.from({length:11},(_,i)=>i+1),
        ].map(sheet => sheet.map(n => `${n}. Swimmer ${n}`)));
        expect(pages[0][1]).toEqual(expected(2, dates.slice(0,14)));
        expect(pages[1][10]).toEqual(expected(11, dates.slice(14)));
    });
    it('drops the handwritten Absent/Present prompt only on completed rows', async () => {
        const completed = await buildAttendancePrintDocument({template:'Splash7', roster:classOf(2)});
        expect(completed.querySelector('[data-generated-attendance-row] td')!.textContent).not.toContain('bsent/');
        const r = classOf(2); delete r.completed; r.students.forEach(s => { delete s.results; delete s.enrollmentId; });
        const blank = await buildAttendancePrintDocument({template:'Splash7', roster:r});
        expect(blank.querySelector('[data-generated-attendance-row] td')!.textContent).toContain('Absent/Present');
        expect(blank.querySelectorAll('.print-page[data-completed]')).toHaveLength(0);
    });
    it('numbers blank sheets from 1 in one table for every level template', async () => {
        for (const key of LEGACY_ATTENDANCE_TEMPLATE_KEYS) {
            const r = classOf(20); delete r.completed; r.students.forEach(s => { delete s.results; delete s.enrollmentId; });
            const document = await buildAttendancePrintDocument({template:key, roster:r});
            expect(document.querySelectorAll('[data-page-kind="attendance-front"]'), key).toHaveLength(1);
            expect([...document.querySelectorAll('[data-generated-attendance-row] td strong')].map(cell => cell.textContent), key)
                .toEqual(Array.from({length:20},(_,i)=>`${i+1}. Swimmer ${i+1}`));
        }
    });
    it('uses required minimum and alternative maximum, never sums components', () => {
        const column={cellIndex:1,heading:'group',skillIds:['front','back'],aggregation:'all' as const};
        expect(earnedChecks(column,{front:3,back:1})).toBe(1);
        expect(earnedChecks({...column,aggregation:'any'},{front:3,back:1})).toBe(3);
        expect(earnedChecks(column,{front:3})).toBe(0);
    });
    it('maps every numbered column and curriculum ID in all production templates', async () => {
        const source=resolve(process.cwd(),'../../rec-tablet/src/workflows/swimming/curriculum/catalog.json');
        const catalog=existsSync(source) ? JSON.parse(readFileSync(source,'utf8')) : {levels:planningLevels,version:manifest.curriculumVersion};
        expect(manifest.curriculumVersion).toBe(catalog.version);
        for(const key of LEGACY_ATTENDANCE_TEMPLATE_KEYS) {
            const template=await loadAttendanceTemplate(key);
            const {frontFragment}=extractAttendanceTemplateSections(key,template.html);
            const cells=[...frontFragment.querySelector('#student-rows')!.children];
            const columns=manifest.levels[key];
            const numbered=cells.filter(cell=>/^\d+[a-z]?\s*\./i.test(cell.textContent!.trim()));
            expect(columns.length,key).toBe(numbered.length);
            expect(columns.flatMap(c=>c.skillIds),key).toEqual(catalog.levels.find((l:{id:string})=>l.id===key).skills.map((s:{id:string})=>s.id));
            for(const column of columns) expect(cells[column.cellIndex].textContent!.replace(/\s+/g,' ').trim()).toBe(column.heading);
        }
    });
});

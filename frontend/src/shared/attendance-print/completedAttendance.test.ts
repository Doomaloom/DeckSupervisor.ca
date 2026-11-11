import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import planningLevels from '../../features/instructor/LessonPlans/lessonSkills.json';
import { buildAttendancePrintDocument } from './buildAttendancePrintDocument';
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
    it('repeats complete sheets for large classes and long sessions', async () => {
        const r=roster(); r.students=Array.from({length:9},(_,i)=>({...r.students[0],enrollmentId:`e${i}`}));
        r.completed!.lessonDates=Array.from({length:15},(_,i)=>`2026-09-${String(i+1).padStart(2,'0')}`);
        r.students.forEach(s=>s.results={attendance:{},successfulAttempts:{}});
        const document=await buildAttendancePrintDocument({template:'Splash1',roster:r});
        expect(document.querySelectorAll('[data-page-kind="attendance-front"]')).toHaveLength(4);
        expect(document.querySelectorAll('[data-page-kind="attendance-back"]')).toHaveLength(4);
        expect(document.querySelectorAll('.combined-page')).toHaveLength(0);
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

import type * as api from '../../lib/resultsApi';
import type {AttendancePrintItem} from '../../shared/attendance-print/types';
import {findCurriculumLevel} from '../instructor/LessonPlans/lessonSkills';
import type {LocalIdentity} from './identity';
import {CURRENT_CURRICULUM_VERSION,PREVIOUS_CURRICULUM_VERSION,successfulByCurrentSkill,columnSuccesses} from './translate';
import {COMPLETED_PRINT_CURRICULUM_VERSION} from '../../shared/attendance-print/completedAttendance';
import {reportCardMap,reportCardMarks,type ReportCardPrint} from '../../shared/report-cards/reportCards';

export type CompletedSwimmer={enrollmentId:string;local?:LocalIdentity};
export type CompletedClassInput={course:api.ResultCourse;swimmers:CompletedSwimmer[];data:api.Results};

/** Builds one class's completed sheets, or throws the reason it cannot print yet. Swimmers arrive in blank-sheet order. */
export function buildCompletedClass({course,swimmers,data}:CompletedClassInput):AttendancePrintItem[]{
 assertClassPrintable({course,swimmers,data});
 const accepted=data.records.filter(r=>r.classId===course.classId&&!r.deleted);
 if(!accepted.some(r=>r.curriculumVersion===CURRENT_CURRICULUM_VERSION||r.curriculumVersion===PREVIOUS_CURRICULUM_VERSION))throw new Error('Completed printing needs submitted results from the current or previous curriculum version.');
 // Private and mixed classes split into the sheet of each swimmer's own level.
 const groups=new Map<string,CompletedSwimmer[]>();
 for(const s of swimmers){const level=findCurriculumLevel(s.local!.level);if(!level)throw new Error(`Choose a supported curriculum level for ${s.local!.name}.`);groups.set(level.id,[...(groups.get(level.id)??[]),s]);}
 return [...groups].map(([template,group])=>{const info=group[0].local!.course;return {template,roster:{code:info.code,level:template,serviceName:info.name,time:info.startTime,instructor:info.instructor,location:info.location,schedule:course.lessonDates.join(', '),completed:{curriculumVersion:COMPLETED_PRINT_CURRICULUM_VERSION,lessonDates:course.lessonDates},
  students:group.map(s=>{const attendance:Record<string,'present'|'absent'|'unmarked'>={},mine=accepted.filter(r=>r.enrollmentId===s.enrollmentId);
   for(const r of mine)if(r.kind==='attendance'&&r.payload.status)attendance[r.lessonDate]=r.payload.status;
   // Old and new results count together per current skill; the sheet's own columns are the previous skills.
   const currentAttempts=successfulByCurrentSkill(mine);
   return {name:s.local!.name,enrollmentId:s.enrollmentId,results:{attendance,successfulAttempts:columnSuccesses(currentAttempts),currentAttempts}};})}};});
}

export type PrintBatch<T>={items:T[];printed:string[];skipped:{label:string;reason:string}[]};
export type CompletedBatch=PrintBatch<AttendancePrintItem>;
/** Prints every class that is ready and reports the rest instead of failing the whole batch. */
export function buildBatch<I extends {label:string},T>(classes:I[],build:(c:I)=>T[]):PrintBatch<T>{
 const batch:PrintBatch<T>={items:[],printed:[],skipped:[]};
 for(const c of classes){try{batch.items.push(...build(c));batch.printed.push(c.label);}catch(e){batch.skipped.push({label:c.label,reason:e instanceof Error?e.message:String(e)});}}
 return batch;
}
export const buildCompletedBatch=(classes:(CompletedClassInput&{label:string})[])=>buildBatch(classes,buildCompletedClass);

/** Checks shared by completed sheets and report cards: no open conflicts, and every swimmer named. */
export function assertClassPrintable({course,swimmers,data}:CompletedClassInput){
 if(data.conflicts.some(c=>!c.resolved&&c.operation.classId===course.classId))throw new Error('Resolve this class’s conflicts before printing.');
 if(!swimmers.length||swimmers.some(s=>!s.local))throw new Error('Load and reconcile every student name before printing.');
}

/** One filled report card per swimmer, on the card of the swimmer's own level. */
export function buildReportCardClass(input:CompletedClassInput&{session:string;curriculumVersion:string}):ReportCardPrint[]{
 assertClassPrintable(input);
 const {course,swimmers,data,session,curriculumVersion}=input,date=[...course.lessonDates].sort().at(-1)??'';
 return swimmers.map(s=>{
  const local=s.local!,level=findCurriculumLevel(local.level);
  if(!level)throw new Error(`Choose a supported curriculum level for ${local.name}.`);
  const map=reportCardMap(level.id);if(!map)throw new Error(`There is no report card scan for ${local.name}’s level (${level.id}) yet.`);
  const records=data.records.filter(r=>r.enrollmentId===s.enrollmentId&&r.classId===course.classId);
  return {map,participant:local.name,instructor:local.course.instructor,date,session,marks:reportCardMarks(records,level.id,curriculumVersion)};
 });
}

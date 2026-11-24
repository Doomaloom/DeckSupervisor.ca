import type * as api from '../../lib/resultsApi';
import type {AttendancePrintItem} from '../../shared/attendance-print/types';
import {findCurriculumLevel} from '../instructor/LessonPlans/lessonSkills';
import type {LocalIdentity} from './identity';

export type CompletedSwimmer={enrollmentId:string;local?:LocalIdentity};
export type CompletedClassInput={course:api.ResultCourse;swimmers:CompletedSwimmer[];data:api.Results};

/** Builds one class's completed sheets, or throws the reason it cannot print yet. Swimmers arrive in blank-sheet order. */
export function buildCompletedClass({course,swimmers,data}:CompletedClassInput):AttendancePrintItem[]{
 if(data.conflicts.some(c=>!c.resolved&&c.operation.classId===course.classId))throw new Error('Resolve this class’s conflicts before printing.');
 if(!swimmers.length||swimmers.some(s=>!s.local))throw new Error('Load and reconcile every student name before printing.');
 const accepted=data.records.filter(r=>r.classId===course.classId&&!r.deleted),versions=[...new Set(accepted.map(r=>r.curriculumVersion))];
 if(versions.length!==1)throw new Error('Completed printing needs submitted results from one curriculum version.');
 // Private and mixed classes split into the sheet of each swimmer's own level.
 const groups=new Map<string,CompletedSwimmer[]>();
 for(const s of swimmers){const level=findCurriculumLevel(s.local!.level);if(!level)throw new Error(`Choose a supported curriculum level for ${s.local!.name}.`);groups.set(level.id,[...(groups.get(level.id)??[]),s]);}
 return [...groups].map(([template,group])=>{const info=group[0].local!.course;return {template,roster:{code:info.code,level:template,serviceName:info.name,time:info.startTime,instructor:info.instructor,location:info.location,schedule:course.lessonDates.join(', '),completed:{curriculumVersion:versions[0],lessonDates:course.lessonDates},
  students:group.map(s=>{const attendance:Record<string,'present'|'absent'|'unmarked'>={},successfulAttempts:Record<string,number>={};
   for(const r of accepted){if(r.enrollmentId!==s.enrollmentId)continue;if(r.kind==='attendance'&&r.payload.status)attendance[r.lessonDate]=r.payload.status;if(r.kind==='attempt'&&r.success&&r.payload.skillId)successfulAttempts[r.payload.skillId]=(successfulAttempts[r.payload.skillId]??0)+1;}
   return {name:s.local!.name,enrollmentId:s.enrollmentId,results:{attendance,successfulAttempts}};})}};});
}

export type CompletedBatch={items:AttendancePrintItem[];printed:string[];skipped:{label:string;reason:string}[]};
/** Prints every class that is ready and reports the rest instead of failing the whole batch. */
export function buildCompletedBatch(classes:(CompletedClassInput&{label:string})[]):CompletedBatch{
 const batch:CompletedBatch={items:[],printed:[],skipped:[]};
 for(const c of classes){try{batch.items.push(...buildCompletedClass(c));batch.printed.push(c.label);}catch(e){batch.skipped.push({label:c.label,reason:e instanceof Error?e.message:String(e)});}}
 return batch;
}

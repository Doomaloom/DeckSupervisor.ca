import type {ExportCourse,ExportRegistry} from '../decksupervisor/DeviceExport/services/exportPackage';
import {studentMatchKey,courseSourceId,matchesKey} from '../decksupervisor/DeviceExport/services/resultRegistry';
import type {ResultRegistry} from '../../lib/resultsApi';
export type LocalIdentity={course:ExportCourse;name:string;level:string;matchKey:string;sourceId?:string;enrollmentId?:string;ambiguous?:boolean};
export async function resolveLocalIdentities(sessionId:string,courses:ExportCourse[],registry:ResultRegistry):Promise<LocalIdentity[]>{
 const output:LocalIdentity[]=[];
 for(const course of courses){const saved=registry.courses.find(c=>c.sourceId===courseSourceId(sessionId,course.code));const pupils=course.students.filter(s=>!s.waitlist);const keys=await Promise.all(pupils.map(s=>studentMatchKey(courseSourceId(sessionId,course.code),s)));
 for(let index=0;index<pupils.length;index++){const student=pupils[index],matchKey=keys[index],candidates=saved?.swimmers.filter(s=>matchesKey(s,matchKey))??[],ambiguous=keys.filter(k=>k===matchKey).length!==1;const match=candidates.length===1&&!ambiguous?candidates[0]:undefined;output.push({course,name:student.name,level:student.level||course.level,matchKey,sourceId:match?.sourceId,enrollmentId:match?.enrollmentId,ambiguous});}}
 return output;
}
export function bindLocalAlias(local:ExportRegistry,identity:LocalIdentity,sourceId:string):ExportRegistry{return {...local,people:{...local.people,[identity.matchKey]:{sourceId,courseId:courseSourceId(local.sessionId,identity.course.code),name:identity.name}}};}
/** Class packages supply names locally; they never create or modify server identities. */
export function localNamesFromPackage(value:unknown,registry:ResultRegistry):LocalIdentity[]{
 const pkg=value as {schemaVersion:number;kind:string;datasetId:string;instructor:string;courses:{sourceId:string;name:string;level:string;startTime:string;location:string;lessonDates:string[];swimmers:{sourceId:string;name:string;level?:string}[]}[]};
 if(pkg?.schemaVersion!==1||pkg.kind!=='rec-tablet-classes'||pkg.datasetId!==registry.datasetId||!Array.isArray(pkg.courses))throw new Error('Choose a class package from this registered session.');
 const output:LocalIdentity[]=[],seen=new Set<string>();
 for(const item of pkg.courses){const course=registry.courses.find(c=>c.sourceId===item.sourceId);if(!course)continue;if(!Array.isArray(item.swimmers))throw new Error('Invalid local class package.');for(const swimmer of item.swimmers){const saved=course.swimmers.filter(s=>s.sourceId===swimmer.sourceId);if(saved.length!==1||typeof swimmer.name!=='string'||!swimmer.name.trim()||seen.has(swimmer.sourceId))throw new Error('Ambiguous or unregistered student in local package.');seen.add(swimmer.sourceId);output.push({name:swimmer.name,level:swimmer.level||item.level,matchKey:saved[0].matchKey,sourceId:swimmer.sourceId,enrollmentId:saved[0].enrollmentId,course:{code:item.sourceId.split(':course:').at(-1)!,name:item.name,level:item.level,startTime:item.startTime,location:item.location,instructor:pkg.instructor,lessonDates:course.lessonDates,students:[]}});}}
 return output;
}

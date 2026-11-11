import {fetchResultRegistry,putResultRegistry,fetchResultClasses,type ResultRegistry,type ResultIdentity} from '../../../../lib/resultsApi';
import {fingerprint,type ExportCourse,type ExportRegistry,newRegistry} from './exportPackage';
import {loadRegistry,saveRegistry} from './exportStorage';
export const courseSourceId=(session:string,code:string)=>`session:${session}:course:${code}`;
export const studentMatchKey=(sourceId:string,student:{name:string;phone:string})=>fingerprint([sourceId,student.name.trim(),student.phone.trim()]);
export const matchesKey=(identity:ResultIdentity,key:string)=>identity.matchKey===key||!!identity.matchKeys?.includes(key);
/** Durable registry stores opaque signatures only. Resolve personal display data locally. */
export async function recoverRegistry(sessionId:string,courses:ExportCourse[]):Promise<ExportRegistry>{
 const remote=await fetchResultRegistry(sessionId),local=loadRegistry(sessionId);
 if(!remote)return local??newRegistry(sessionId);
 if(local&&local.datasetId!==remote.datasetId)throw new Error('Saved export IDs differ from the registered session. Restore the original ID backup.');
 const registry=local??{...newRegistry(sessionId),datasetId:remote.datasetId};
 for(const course of courses){const saved=remote.courses.find(c=>c.sourceId===courseSourceId(sessionId,course.code));if(!saved)continue;
 for(const student of course.students){const key=await studentMatchKey(saved.sourceId,student);const matches=saved.swimmers.filter(s=>matchesKey(s,key));if(matches.length===1)registry.people[key]={sourceId:matches[0].sourceId,courseId:saved.sourceId,name:student.name.trim()};}
 registry.dates={...registry.dates,[course.code]:saved.lessonDates};}
 saveRegistry(registry);return registry;
}
export async function assertRegisteredRoster(sessionId:string,courses:ExportCourse[]){
 const remote=await fetchResultRegistry(sessionId);if(!remote)return;
 for(const course of courses){const saved=remote.courses.find(c=>c.sourceId===courseSourceId(sessionId,course.code));if(!saved)continue;for(const student of course.students.filter(s=>!s.waitlist)){const key=await studentMatchKey(saved.sourceId,student);if(!saved.swimmers.some(s=>matchesKey(s,key)))throw new Error(`Review ${student.name} in Results: changed details, new students and transfers require explicit reconciliation.`);}}
}
export async function registerResults(sessionId:string,courses:ExportCourse[],registry:ExportRegistry,replaceSnapshot=false){
 const previous=await fetchResultRegistry(sessionId),mapping=await fetchResultClasses(sessionId);
 const result:ResultRegistry={schemaVersion:1,sessionId,datasetId:registry.datasetId,courses:[]};
 for(const course of courses.filter(c=>c.instructor)){
 const sourceId=courseSourceId(sessionId,course.code),matches=mapping.classes.filter(c=>c.code===course.code);
 if(matches.length!==1)throw new Error(`Class ${course.code} needs one saved instructor assignment before sharing.`);
 const old=previous?.courses.find(c=>c.sourceId===sourceId),swimmers:ResultIdentity[]=[];
 for(const student of course.students.filter(s=>!s.waitlist)){const key=await studentMatchKey(sourceId,student),person=registry.people[key];if(!person)throw new Error(`Resolve ${student.name} before sharing.`);const prior=old?.swimmers.find(s=>s.sourceId===person.sourceId);if(old&&!prior)throw new Error(`Reconcile ${student.name} in Results before sharing.`);swimmers.push({sourceId:person.sourceId,enrollmentId:prior?.enrollmentId??crypto.randomUUID(),matchKey:prior?.matchKey??key});}
 result.courses.push({sourceId,classId:matches[0].id,instructorId:matches[0].instructorId,lessonDates:registry.dates?.[course.code]??course.lessonDates,swimmers});}
 if(!replaceSnapshot)result.courses.push(...(previous?.courses??[]).filter(old=>!result.courses.some(next=>next.sourceId===old.sourceId)));
 await putResultRegistry(result);return result;
}

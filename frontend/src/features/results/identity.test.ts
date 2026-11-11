import {webcrypto} from 'node:crypto';
import {beforeEach,expect,it,vi} from 'vitest';
import {resolveLocalIdentities,localNamesFromPackage} from './identity';
import {studentMatchKey,courseSourceId} from '../decksupervisor/DeviceExport/services/resultRegistry';
import {buildCourses} from '../decksupervisor/DeviceExport/services/exportPackage';
import {session,classes,students} from '../decksupervisor/DeviceExport/fixtures';
import type {ResultRegistry} from '../../lib/resultsApi';
beforeEach(()=>vi.stubGlobal('crypto',webcrypto));
it('recovers unchanged IDs and requires review for spelling/contact changes, duplicates and transfers',async()=>{
 const courses=buildCourses(session,classes,students),c=courses[0],person=c.students[0],sourceId=courseSourceId(session.id,c.code),matchKey=await studentMatchKey(sourceId,person);
 const registry:ResultRegistry={schemaVersion:1,sessionId:session.id,datasetId:'durable',courses:[{sourceId,classId:'class',instructorId:'instructor',lessonDates:c.lessonDates,swimmers:[{sourceId:'old-id',enrollmentId:'old-enrollment',matchKey}]}]};
 expect((await resolveLocalIdentities(session.id,[c],registry))[0].sourceId).toBe('old-id');
 for(const changed of [{...person,name:person.name+' corrected'},{...person,phone:'changed'}])expect((await resolveLocalIdentities(session.id,[{...c,students:[changed]}],registry))[0].enrollmentId).toBeUndefined();
 expect((await resolveLocalIdentities(session.id,[{...c,students:[person,person]}],registry)).every(i=>i.ambiguous&&!i.enrollmentId)).toBe(true);
 expect((await resolveLocalIdentities(session.id,[{...c,code:'transfer',students:[person]}],registry))[0].enrollmentId).toBeUndefined();
 registry.courses[0].swimmers[0].matchKeys=[await studentMatchKey(sourceId,{...person,name:person.name+' corrected'})];
 expect((await resolveLocalIdentities(session.id,[{...c,students:[{...person,name:person.name+' corrected'}]}],registry))[0].sourceId).toBe('old-id');
});
it('requires matching dataset and registered source IDs for local display packages',()=>{
 const registry:ResultRegistry={schemaVersion:1,sessionId:'session',datasetId:'durable',courses:[{sourceId:'course',classId:'class',instructorId:'instructor',lessonDates:[],swimmers:[{sourceId:'student',enrollmentId:'enrollment',matchKey:'opaque'}]}]};
 const pkg={schemaVersion:1,kind:'rec-tablet-classes',datasetId:'durable',instructor:'Local teacher',courses:[{sourceId:'course',name:'Class',level:'Splash1',startTime:'10:00',location:'Pool',lessonDates:[],swimmers:[{sourceId:'student',name:'Local synthetic student'}]}]};
 expect(localNamesFromPackage(pkg,registry)[0].enrollmentId).toBe('enrollment');expect(()=>localNamesFromPackage({...pkg,datasetId:'other'},registry)).toThrow();
 expect(()=>localNamesFromPackage({...pkg,courses:[{...pkg.courses[0],swimmers:[{sourceId:'unknown',name:'Wrong person'}]}]},registry)).toThrow();
});
it('resolves historical inactive names from their own class package without matching same names across instructors',()=>{
 const registry:ResultRegistry={schemaVersion:1,sessionId:'session',datasetId:'durable',courses:[{sourceId:'original-class',classId:'old-class',instructorId:'teacher-one',lessonDates:[],swimmers:[{sourceId:'old-student',enrollmentId:'old-enrollment',matchKey:'old-key',active:false}]},{sourceId:'destination-class',classId:'new-class',instructorId:'teacher-two',lessonDates:[],swimmers:[{sourceId:'new-student',enrollmentId:'new-enrollment',matchKey:'new-key',active:true}]}]};
 const packageFor=(course:string,student:string)=>({schemaVersion:1,kind:'rec-tablet-classes',datasetId:'durable',instructor:'Synthetic instructor',courses:[{sourceId:course,name:'Class',level:'Splash1',startTime:'10:00',location:'Pool',lessonDates:[],swimmers:[{sourceId:student,name:'Same synthetic name'}]}]});
 expect(localNamesFromPackage(packageFor('original-class','old-student'),registry)[0].enrollmentId).toBe('old-enrollment');
 expect(localNamesFromPackage(packageFor('destination-class','new-student'),registry)[0].enrollmentId).toBe('new-enrollment');
 expect(()=>localNamesFromPackage(packageFor('destination-class','old-student'),registry)).toThrow('unregistered');
});

import {expect,it} from 'vitest';
import {acceptedProgress} from './progress';
import {CURRENT_CURRICULUM_VERSION,PREVIOUS_CURRICULUM_VERSION} from './translate';
import type {ResultRecord} from '../../lib/resultsApi';
const record={enrollmentId:'student',kind:'attempt',curriculumVersion:CURRENT_CURRICULUM_VERSION,payload:{skillId:'Splash1:2',results:[{subskillId:'Splash1:2:1',status:'successful'}]},deleted:false,success:true} as ResultRecord;
it('caps accepted successes at three and reduces progress after correction or deletion',()=>{
 const records=[1,2,3,4].map(i=>({...record,recordId:String(i)}));expect(acceptedProgress(records).get('student')?.get('Splash1:2')).toBe(3);
 records[0]={...records[0],success:false};records[1]={...records[1],deleted:true};expect(acceptedProgress(records).get('student')?.get('Splash1:2')).toBe(2);
 expect(acceptedProgress(records.map(r=>({...r,curriculumVersion:'other'}))).size).toBe(0);
});
it('counts previous-version attempts through translation, split skills each on their own',()=>{
 const old={...record,curriculumVersion:PREVIOUS_CURRICULUM_VERSION,payload:{skillId:'Splash1:7',results:['1','2','3'].map(n=>({subskillId:`Splash1:7:${n}`,status:'successful' as const}))}};
 const progress=acceptedProgress([1,2].map(i=>({...old,recordId:`o${i}`})));
 expect(Object.fromEntries(progress.get('student')!)).toEqual({'Splash1:7-front-to-back':2,'Splash1:7-back-to-front':2});
});

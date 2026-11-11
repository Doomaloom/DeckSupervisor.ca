import {expect,it} from 'vitest';
import {acceptedProgress} from './progress';
import type {ResultRecord} from '../../lib/resultsApi';
it('caps accepted successes at three and reduces progress after correction or deletion',()=>{
 const record={enrollmentId:'student',kind:'attempt',curriculumVersion:'catalog',payload:{skillId:'skill'},deleted:false,success:true} as ResultRecord;
 const records=[1,2,3,4].map(i=>({...record,recordId:String(i)}));expect(acceptedProgress(records,'catalog').get('student')?.get('skill')).toBe(3);
 records[0]={...records[0],success:false};records[1]={...records[1],deleted:true};expect(acceptedProgress(records,'catalog').get('student')?.get('skill')).toBe(2);
 expect(acceptedProgress(records,'other').size).toBe(0);
});

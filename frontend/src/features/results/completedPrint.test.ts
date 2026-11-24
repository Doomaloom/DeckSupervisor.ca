import {describe,expect,it} from 'vitest';
import current from './curriculum.json';
import previous from './curriculum-previous.json';
import migration from './curriculum-migration.json';
import {buildCompletedClass,buildReportCardClass} from './completedPrint';
import {CURRENT_CURRICULUM_VERSION as NEW,PREVIOUS_CURRICULUM_VERSION as OLD} from './translate';
import type {ResultRecord,Results} from '../../lib/resultsApi';

const LEVEL='Splash1',DATE='2026-09-04';
const oldSkills=Object.keys(previous.skills).filter(id=>id.startsWith(`${LEVEL}:`));
const oldCriteria=(skill:string)=>Object.keys(previous.criteria).filter(id=>id.startsWith(`${skill}:`));
const course={sourceId:'src',classId:'class-one',instructorId:'i',lessonDates:[DATE,'2026-09-11'],swimmers:[]};
const local={name:'Sam',level:'Splash 1',matchKey:'k',enrollmentId:'enr',course:{code:'1',name:'Splash 1',level:'Splash 1',startTime:'16:00',location:'Pool',instructor:'Pat',lessonDates:course.lessonDates,students:[]}};
const swimmers=[{enrollmentId:'enr',local}] as never;
let n=0;
const rec=(skill:string,ok:string[],over:Partial<ResultRecord>={}):ResultRecord=>{
 const results=oldCriteria(skill).map(subskillId=>({subskillId,status:ok.includes(subskillId)?'successful' as const:'not_yet' as const}));
 return {operationId:`o${n}`,sessionId:'s',datasetId:'d',classId:'class-one',enrollmentId:'enr',recordId:`r${n++}`,kind:'attempt',action:'upsert',baseRevision:0,lessonDate:DATE,curriculumVersion:OLD,payload:{skillId:skill,results},revision:1,deleted:false,success:results.every(r=>r.status==='successful'),updatedAt:'x',...over};
};
/** Varied old results: skills with 0..3 full successes, and every third skill with only its first criterion marked three times. */
const oldRecords=oldSkills.flatMap((skill,k)=>k%3===0?[0,1,2].map(()=>rec(skill,[oldCriteria(skill)[0]])):Array.from({length:k%4},()=>rec(skill,oldCriteria(skill))));
const data=(records:ResultRecord[]):Results=>({schemaVersion:1,records:[...records,{...rec('x',[]),kind:'attendance',recordId:'att',payload:{status:'present'},lessonDate:DATE,success:false}],history:[],conflicts:[]});

describe('a class whose results are all in the previous curriculum',()=>{
 it('prints the same completed sheet columns and level result as the old counts',()=>{
  const [item]=buildCompletedClass({course,swimmers,data:data(oldRecords)});
  const results=item.roster.students[0].results!;
  const expected:Record<string,number>={};
  for(const r of oldRecords)if(r.success)expected[r.payload.skillId!]=(expected[r.payload.skillId!]??0)+1;
  expect(results.successfulAttempts).toEqual(expected);
  expect(results.attendance).toEqual({[DATE]:'present'});
  expect(item.roster.completed?.curriculumVersion).toBeTruthy();
  expect(Object.keys(results.currentAttempts!).every(id=>id in current.skills)).toBe(true);
 });
 it('prints the same report card ticks for every unsplit, unmerged box',()=>{
  const [card]=buildReportCardClass({course,swimmers,data:data(oldRecords),session:'Fall 2026',curriculumVersion:NEW});
  // The previous rule, restated over old ids: 3 successful marks on a criterion, or 3 successful attempts of its skill.
  const skillOk=new Map<string,number>(),mark=new Map<string,number>();
  for(const r of oldRecords){if(r.success)skillOk.set(r.payload.skillId!,(skillOk.get(r.payload.skillId!)??0)+1);for(const c of r.payload.results!)if(c.status==='successful')mark.set(c.subskillId,(mark.get(c.subskillId)??0)+1);}
  const oldTicked=(id:string)=>(mark.get(id)??0)>=3||(skillOk.get(id.slice(0,id.lastIndexOf(':')))??0)>=3;
  let compared=0;
  for(const [y,rule] of Object.entries(migration.subskills)){
   const skill=y.slice(0,y.lastIndexOf(':')),from=migration.skills[skill as keyof typeof migration.skills];
   if(!y.startsWith(`${LEVEL}:`)||rule.from.length!==1||from.length!==1||from[0]!==skill||Object.values(migration.skills as Record<string,string[]>).filter(o=>o.includes(skill)).length!==1)continue;
   expect(card.marks.ticked.has(y),y).toBe(oldTicked(rule.from[0]));compared+=1;
  }
  expect(compared).toBeGreaterThan(10);
  expect(card.marks.ticked.size).toBeGreaterThan(0);
 });
 it('counts old and new results of one class together',()=>{
  const skill='Splash1:2',fresh={...rec(skill,[]),curriculumVersion:NEW,payload:{skillId:skill,results:Object.keys(current.criteria).filter(id=>id.startsWith(`${skill}:`)).map(subskillId=>({subskillId,status:'successful' as const}))},success:true};
  const records=[rec(skill,oldCriteria(skill)),{...fresh,recordId:'n1'},{...fresh,recordId:'n2'}];
  expect(buildCompletedClass({course,swimmers,data:data(records)})[0].roster.students[0].results!.successfulAttempts[skill]).toBe(3);
 });
 it('refuses a class with results only in unknown versions',()=>{
  const unknown={...data([]),records:oldRecords.map(r=>({...r,curriculumVersion:'templates-older'}))};
  expect(()=>buildCompletedClass({course,swimmers,data:unknown})).toThrow(/current or previous curriculum/);
 });
});

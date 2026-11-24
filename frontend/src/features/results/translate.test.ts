import {existsSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {describe,expect,it} from 'vitest';
import current from './curriculum.json';
import previous from './curriculum-previous.json';
import migration from './curriculum-migration.json';
import {CURRENT_CURRICULUM_VERSION as NEW,PREVIOUS_CURRICULUM_VERSION as OLD,columnSuccesses,criterionNameFor,currentFromColumns,isTranslated,skillNameFor,successfulByCurrentSkill,toCurrentRecords} from './translate';
import type {ResultRecord} from '../../lib/resultsApi';

let n=0;
const oldSub=(skill:string)=>Object.keys(previous.criteria).filter(id=>id.startsWith(`${skill}:`));
const newSub=(skill:string)=>Object.keys(current.criteria).filter(id=>id.startsWith(`${skill}:`));
/** An attempt in the given version; `ok` lists successful subskills ('all' = every subskill of the skill in that version). */
function attempt(skill:string,ok:string[]|'all',over:Partial<ResultRecord>={}):ResultRecord{
 const version=over.curriculumVersion??OLD,ids=(version===NEW?newSub:oldSub)(skill);
 const results=ids.map(subskillId=>({subskillId,status:ok==='all'||ok.includes(subskillId)?'successful' as const:'not_yet' as const}));
 return {operationId:`op${n}`,sessionId:'s',datasetId:'d',classId:'c',enrollmentId:'e',recordId:`r${n++}`,kind:'attempt',action:'upsert',baseRevision:0,lessonDate:'2025-05-01',curriculumVersion:OLD,
  payload:{skillId:skill,createdAt:'2025-05-01T10:00:00Z',submittedAt:'2025-05-01T10:05:00Z',results},revision:2,deleted:false,success:results.every(r=>r.status==='successful'),updatedAt:'x',...over};
}


describe('catalog data',()=>{
 it('keeps both versions and the migration between them',()=>{
  expect(NEW).toBe(migration.to);expect(OLD).toBe(migration.from);expect(NEW).not.toBe(OLD);
  expect(Object.keys(migration.skills).sort()).toEqual(Object.keys(current.skills).sort());
  expect(Object.keys(migration.subskills).sort()).toEqual(Object.keys(current.criteria).sort());
 });
 it('labels a record in its own version',()=>{
  expect(skillNameFor(OLD,'Splash1:7')).toBe(previous.skills['Splash1:7' as keyof typeof previous.skills]);
  expect(skillNameFor(NEW,'Splash1:7')).toBe('Splash1:7');
  expect(skillNameFor(NEW,'Splash1:7-front-to-back')).toBe(current.skills['Splash1:7-front-to-back' as keyof typeof current.skills]);
  expect(skillNameFor(undefined,'Splash1:1')).toBe(current.skills['Splash1:1' as keyof typeof current.skills]);
  expect(criterionNameFor(OLD,'Splash1:7:2')).toBe(previous.criteria['Splash1:7:2' as keyof typeof previous.criteria]);
  expect(criterionNameFor('other','Splash1:1:1')).toBe('Splash1:1:1');
 });
});

const tablet=resolve(process.cwd(),'../../rec-tablet/src/workflows/swimming/curriculum');
describe('generated labels',()=>{
 for(const [file,labels] of [['catalog.json',current],[`catalog-${OLD}.json`,previous]] as const)
  it.runIf(existsSync(resolve(tablet,file)))(`match the tablet ${file} verbatim`,()=>{
   const catalog=JSON.parse(readFileSync(resolve(tablet,file),'utf8')) as {version:string;levels:{skills:{id:string;name:string;subskills:{id:string;text:string}[]}[]}[]};
   const skills:Record<string,string>={},criteria:Record<string,string>={};
   for(const l of catalog.levels)for(const s of l.skills){skills[s.id]=s.name;for(const c of s.subskills)criteria[c.id]=c.text;}
   expect(labels).toEqual({version:catalog.version,skills,criteria});
  });
 it.runIf(existsSync(resolve(tablet,'catalog-migration.json')))('include the tablet migration verbatim',()=>{
  expect(migration).toEqual(JSON.parse(readFileSync(resolve(tablet,'catalog-migration.json'),'utf8')));
 });
});

describe('toCurrentRecords',()=>{
 it('passes current-version attempts and attendance through, and ignores unknown versions',()=>{
  const cur=attempt('Splash1:1','all',{curriculumVersion:NEW}),att=attempt('Splash1:1',[],{kind:'attendance',curriculumVersion:'whatever',payload:{status:'present'}});
  const out=toCurrentRecords([cur,att,attempt('Splash1:1','all',{curriculumVersion:'templates-older'})]);
  expect(out).toEqual([cur,att]);expect(out.some(isTranslated)).toBe(false);
 });
 it('translates an unsplit old attempt one to one, marking it as translated',()=>{
  const old=attempt('Splash1:1',['Splash1:1:1']),[t,...rest]=toCurrentRecords([old]);
  expect(rest).toEqual([]);
  expect(t).toMatchObject({translatedFrom:old.recordId,curriculumVersion:NEW,lessonDate:old.lessonDate,enrollmentId:old.enrollmentId,classId:old.classId,success:false,payload:{skillId:'Splash1:1',createdAt:old.payload.createdAt}});
  expect(t.recordId).not.toBe(old.recordId);
  expect(t.payload.results).toEqual(newSub('Splash1:1').map(subskillId=>({subskillId,status:subskillId==='Splash1:1:1'?'successful':'not_yet'})));
  expect(toCurrentRecords([attempt('Splash1:1','all')])[0].success).toBe(true);
 });
 it('turns a split skill into one attempt per new skill, each judged on its own subskills',()=>{
  const all=toCurrentRecords([attempt('Splash1:7','all')]);
  expect(all.map(r=>r.payload.skillId)).toEqual(['Splash1:7-front-to-back','Splash1:7-back-to-front']);
  expect(all.every(r=>r.success&&r.translatedFrom)).toBe(true);
  expect(new Set(all.map(r=>r.recordId)).size).toBe(2);
  const partial=toCurrentRecords([attempt('Splash1:7',['Splash1:7:1','Splash1:7:3'])]);
  for(const r of partial){expect(r.success).toBe(false);expect(r.payload.results!.filter(x=>x.status==='successful').map(x=>x.subskillId.split(':')[2])).toEqual(['1','3']);}
 });
 it('merges boxes: successful when every old criterion present in the record is successful',()=>{
  const sub='LittleSplash3:9a:1',from=migration.subskills[sub as keyof typeof migration.subskills].from;
  expect(from.length).toBeGreaterThan(1);
  const status=(ok:string[])=>toCurrentRecords([attempt('LittleSplash3:9a',ok)])[0].payload.results!.find(r=>r.subskillId===sub)!.status;
  expect(status(from)).toBe('successful');expect(status([from[0]])).toBe('not_yet');expect(status([])).toBe('not_yet');
  const partial=attempt('LittleSplash3:9a',from);partial.payload.results=partial.payload.results!.filter(r=>r.subskillId===from[0]);
  expect(toCurrentRecords([partial])[0].payload.results!.find(r=>r.subskillId===sub)!.status).toBe('successful');
 });
 it('marks a box with no old criterion from the old attempt success',()=>{
  const sub='LittleSplash3:8-front-to-back:4',rule=migration.subskills[sub as keyof typeof migration.subskills];
  expect(rule).toEqual({from:[],fromSkillSuccess:true});
  const status=(r:ResultRecord)=>toCurrentRecords([r]).find(x=>x.payload.skillId==='LittleSplash3:8-front-to-back')!.payload.results!.find(x=>x.subskillId===sub)!.status;
  expect(status(attempt('LittleSplash3:8','all'))).toBe('successful');
  expect(status(attempt('LittleSplash3:8',[]))).toBe('not_yet');
  expect(status(attempt('LittleSplash3:8',[oldSub('LittleSplash3:8')[0]]))).toBe('not_yet');
 });
 it('needs the old attempt itself to have succeeded for timed skills',()=>{
  for(const skill of ['Splash7:10','Splash8:9','Splash9:11']){
   const missed=toCurrentRecords([attempt(skill,'all',{success:false})])[0],made=toCurrentRecords([attempt(skill,'all',{success:true})])[0];
   expect(missed.payload.results!.every(r=>r.status==='successful')).toBe(true);expect(missed.success).toBe(false);
   expect(made.success).toBe(true);
  }
 });
 it('drops old subskills that have no box on the new card',()=>{
  const dropped=Object.keys(previous.criteria).filter(id=>!Object.values(migration.subskills).some(s=>(s.from as string[]).includes(id)));
  expect(dropped.length).toBeGreaterThan(0);
  const skill=oldSub(dropped[0]).length?dropped[0].slice(0,dropped[0].lastIndexOf(':')):'';
  const out=toCurrentRecords([attempt(skill,'all')]);
  for(const r of out)for(const x of r.payload.results!)expect(Object.keys(current.criteria)).toContain(x.subskillId);
  expect(out.flatMap(r=>r.payload.results!.map(x=>x.subskillId))).not.toContain(dropped[0]);
 });
 it('keeps the deleted flag and attempts without a known skill do not translate',()=>{
  expect(toCurrentRecords([attempt('Splash1:1','all',{deleted:true})])[0].deleted).toBe(true);
  expect(toCurrentRecords([attempt('Splash1:99','all')])).toEqual([]);
 });
 it('is idempotent',()=>{
  const once=toCurrentRecords([attempt('Splash1:7','all'),attempt('Splash1:1','all',{curriculumVersion:NEW})]);
  expect(toCurrentRecords(once)).toEqual(once);
 });
});

describe('skill counts',()=>{
 it('counts successful attempts per current skill from both versions, ignoring deleted ones',()=>{
  const records=[attempt('Splash1:7','all'),attempt('Splash1:7-front-to-back','all',{curriculumVersion:NEW}),attempt('Splash1:7','all',{deleted:true}),attempt('Splash1:1',[])];
  expect(successfulByCurrentSkill(records)).toEqual({'Splash1:7-front-to-back':2,'Splash1:7-back-to-front':1});
 });
 it('maps back to the sheet columns by the least successful new skill; unsplit skills are the identity',()=>{
  expect(columnSuccesses({'Splash1:7-front-to-back':3,'Splash1:7-back-to-front':2,'Splash1:2':1})).toEqual({'Splash1:7':2,'Splash1:2':1});
  expect(columnSuccesses({'Splash1:7-front-to-back':3})).toEqual({});
  expect(currentFromColumns({'Splash1:7':2,'Splash1:2':1})).toEqual({'Splash1:7-front-to-back':2,'Splash1:7-back-to-front':2,'Splash1:2':1});
 });
});

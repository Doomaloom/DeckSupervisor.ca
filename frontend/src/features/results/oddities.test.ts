import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {installLocalStorage} from '../../test/storage';
import curriculum from './curriculum.json';
import {reportCardMarks} from '../../shared/report-cards/reportCards';
import type {ResultRecord} from '../../lib/resultsApi';
import {attemptSucceeds,equivalentCriteriaGroups,findOddities,normalizeCriterion,loadIgnoredOddities,planOddityFix,saveIgnoredOddities,TIMED_SKILLS,type FixContext} from './oddities';

const V=curriculum.version,CLASS='c1',ENR='e1',LEVEL='LittleSplash3',S10='LittleSplash3:10',S11='LittleSplash3:11',RK10=`${S10}:3`,RK11=`${S11}:3`;
const criteriaOf=(skill:string)=>Object.keys(curriculum.criteria).filter(id=>id.startsWith(`${skill}:`));
let seq=0;
const uuid=()=>`00000000-0000-4000-8000-${String(++seq).padStart(12,'0')}`;
/** An attempt on `skill` with the listed criteria successful (default none). */
function attempt(skill:string,ok:string[]|'all',date='2025-05-01',over:Partial<ResultRecord>={}):ResultRecord{
 const results=criteriaOf(skill).map(subskillId=>({subskillId,status:ok==='all'||ok.includes(subskillId)?'successful' as const:'not_yet' as const}));
 return {operationId:uuid(),sessionId:'s1',datasetId:'d1',classId:CLASS,enrollmentId:ENR,recordId:uuid(),kind:'attempt',action:'upsert',baseRevision:0,lessonDate:date,curriculumVersion:V,
  payload:{skillId:skill,createdAt:`${date}T10:00:00Z`,submittedAt:`${date}T10:05:00Z`,results},revision:2,deleted:false,success:results.every(r=>r.status==='successful'),updatedAt:`${date}T10:05:00Z`,...over};
}
const scope={classId:CLASS,enrollmentId:ENR,curriculumVersion:V};
const dates=['2025-04-24','2025-05-01','2025-05-08'];
let n=0;
const ctx=():FixContext=>({sessionId:'s1',datasetId:'d1',lessonDates:dates,curriculumVersion:V,now:()=>'2025-06-01T12:00:00.000Z',newId:()=>`new-${++n}`});
/** Applies planned operations to a record list the way the server would (upsert by recordId, success derived). */
function apply(records:ResultRecord[],ops:ReturnType<typeof planOddityFix>['operations']):ResultRecord[]{
 const out=new Map(records.map(r=>[r.recordId,r]));
 for(const op of ops){const prev=out.get(op.recordId);out.set(op.recordId,{...op,revision:(prev?.revision??0)+1,deleted:false,success:attemptSucceeds(op.payload),updatedAt:'x'});}
 return [...out.values()];
}
const threeIn10=['2025-04-24','2025-05-01','2025-05-08'].map(d=>attempt(S10,[RK10],d));

describe('equivalentCriteriaGroups',()=>{
 it('groups Rhythmic kick across the two LittleSplash3 skills',()=>{
  const g=equivalentCriteriaGroups(LEVEL).find(x=>x.label==='Rhythmic kick');
  expect(g?.criterionIds).toEqual([RK10,RK11]);
 });
 it('never groups generic outcome criteria',()=>{
  for(const level of new Set(Object.keys(curriculum.criteria).map(id=>id.split(':')[0])))for(const g of equivalentCriteriaGroups(level)){
   expect(g.key).not.toMatch(/minimum distance|participation in a water activity|time requirement met|repetitions completed|continuous sequence|as fast as possible/);
   expect(new Set(g.criterionIds.map(id=>id.split(':').slice(0,2).join(':'))).size).toBeGreaterThanOrEqual(2);
   for(const id of g.criterionIds)expect(Object.keys(curriculum.criteria)).toContain(id);
  }
  expect(equivalentCriteriaGroups(LEVEL).map(g=>g.key)).not.toContain('minimum distance completed');
 });
 it('groups punctuation variants together',()=>{
  const comma='Continuous, rhythmic flutter kick initiated from hips; slight knee bend, feet relaxed',semi='Continuous, rhythmic flutter kick initiated from hips; slight knee bend; feet relaxed';
  expect(normalizeCriterion(comma)).toBe(normalizeCriterion(semi));
  const g=equivalentCriteriaGroups('Splash3').find(x=>x.key===normalizeCriterion(semi));
  expect(g?.label).toBe(semi);
  expect(g?.criterionIds).toEqual(expect.arrayContaining(['Splash3:7:2','Splash3:8:2','Splash3:10-front-crawl:4','Splash3:11:2']));
 });
 it('counts the groups of every level',()=>{
  const levels=[...new Set(Object.keys(curriculum.criteria).map(id=>id.split(':')[0]))];
  expect(levels.reduce((n,l)=>n+equivalentCriteriaGroups(l).length,0)).toBeGreaterThan(20);
 });
 it('never groups timed benchmark criteria',()=>{
  for(const level of ['Splash7','Splash8','Splash9'])for(const g of equivalentCriteriaGroups(level))for(const id of g.criterionIds)expect(TIMED_SKILLS.has(id.split(':').slice(0,2).join(':'))).toBe(false);
 });
});

describe('findOddities',()=>{
 it('flags rhythmic kick ticked by marks in one skill but not the other',()=>{
  const records=[...threeIn10,attempt(S11,[RK11],'2025-05-01')],found=findOddities(records,scope);
  expect(found).toHaveLength(1);
  const o=found[0];
  expect(o.id).toBe(`${CLASS}:${ENR}:${LEVEL}:rhythmic kick`);
  expect(o.label).toBe('Rhythmic kick');
  const [a,b]=o.criteria;
  expect(a).toMatchObject({criterionId:RK10,skillId:S10,ticked:true,successfulMarks:3,skillSuccesses:0,skillComplete:false,attempts:3});
  expect(b).toMatchObject({criterionId:RK11,skillId:S11,ticked:false,successfulMarks:1,skillSuccesses:0,skillComplete:false,attempts:1});
 });
 it('flags a criterion ticked through a completed skill',()=>{
  const records=[...['2025-04-24','2025-05-01','2025-05-08'].map(d=>attempt(S10,'all',d)),attempt(S11,[],'2025-05-01')];
  const o=findOddities(records,scope).find(x=>x.label==='Rhythmic kick')!;
  expect(o.criteria[0]).toMatchObject({ticked:true,skillComplete:true,skillSuccesses:3,successfulMarks:3});
  expect(o.criteria[1].ticked).toBe(false);
 });
 it('reports nothing when both or neither are ticked',()=>{
  expect(findOddities([...threeIn10,...threeIn10.map(r=>attempt(S11,[RK11],r.lessonDate))],scope)).toEqual([]);
  expect(findOddities([attempt(S10,[RK10]),attempt(S11,[RK11])],scope)).toEqual([]);
 });
 it('ignores other class, enrollment, deleted, other version and non-attempt records',()=>{
  const noise=[
   ...threeIn10.map(r=>({...r,classId:'other'})),...threeIn10.map(r=>({...r,enrollmentId:'other'})),
   ...threeIn10.map(r=>({...r,deleted:true})),...threeIn10.map(r=>({...r,curriculumVersion:'old'})),
  ];
  expect(findOddities([...noise,attempt(S11,[RK11])],scope)).toEqual([]);
  // Same noise must not tip a real comparison either.
  expect(findOddities([...noise,...threeIn10,attempt(S11,[RK11])],scope)).toHaveLength(1);
 });
});

describe('planOddityFix tick',()=>{
 const base=()=>[...threeIn10,attempt(S11,[],'2025-04-24'),attempt(S11,[RK11],'2025-05-01'),attempt(S11,[],'2025-05-08')];
 it('flips not_yet attempts latest first, one op per record, keeping fields and baseRevision',()=>{
  const records=base(),o=findOddities(records,scope)[0],plan=planOddityFix(o,records,'tick',ctx());
  expect(plan.possible).toBe(true);
  expect(plan.operations).toHaveLength(2);
  const dated=plan.operations.map(op=>op.lessonDate).sort();
  expect(dated).toEqual(['2025-04-24','2025-05-08']);
  for(const op of plan.operations){
   const src=records.find(r=>r.recordId===op.recordId)!;
   expect(op).toMatchObject({baseRevision:src.revision,action:'upsert',kind:'attempt',classId:CLASS,enrollmentId:ENR,sessionId:'s1',datasetId:'d1',curriculumVersion:V,lessonDate:src.lessonDate});
   expect(op.operationId).not.toBe(src.operationId);
   expect(op.payload.skillId).toBe(S11);expect(op.payload.createdAt).toBe(src.payload.createdAt);
   expect(op).not.toHaveProperty('revision');expect(op).not.toHaveProperty('success');expect(op).not.toHaveProperty('deleted');expect(op).not.toHaveProperty('updatedAt');
  }
  const after=reportCardMarks(apply(records,plan.operations),LEVEL,V);
  expect(after.ticked.has(RK10)&&after.ticked.has(RK11)).toBe(true);
 });
 it('creates supervisor attempts with all criteria of the skill when attempts are missing',()=>{
  const records=[...threeIn10,attempt(S11,[RK11],'2025-05-01'),attempt(S11,[],'2025-05-08')],o=findOddities(records,scope)[0],plan=planOddityFix(o,records,'tick',ctx());
  const flipped=plan.operations.filter(op=>op.baseRevision>0),added=plan.operations.filter(op=>op.baseRevision===0);
  expect(flipped).toHaveLength(1);expect(added).toHaveLength(1);
  expect(added[0]).toMatchObject({lessonDate:'2025-05-08',recordId:expect.stringMatching(/^new-/),kind:'attempt',action:'upsert',baseRevision:0,curriculumVersion:V});
  expect(added[0].payload).toMatchObject({skillId:S11,createdAt:'2025-06-01T12:00:00.000Z',submittedAt:'2025-06-01T12:00:00.000Z'});
  expect(added[0].payload.results).toEqual(criteriaOf(S11).map(subskillId=>({subskillId,status:subskillId===RK11?'successful':'not_yet'})));
  expect(plan.changes.join('\n')).toMatch(/adds 1 supervisor attempt dated 2025-05-08/);
  const after=reportCardMarks(apply(records,plan.operations),LEVEL,V);
  expect(after.ticked.has(RK11)&&after.ticked.has(RK10)).toBe(true);
 });
 it('creates all three attempts for a skill with none and ticks everything',()=>{
  const records=[...threeIn10],o=findOddities(records,scope)[0],plan=planOddityFix(o,records,'tick',ctx());
  expect(plan.operations).toHaveLength(3);
  expect(plan.operations.every(op=>op.baseRevision===0&&op.payload.skillId===S11)).toBe(true);
  expect(reportCardMarks(apply(records,plan.operations),LEVEL,V).ticked.has(RK11)).toBe(true);
 });
 it('notes when a skill reaches 3 of 3 successful attempts',()=>{
  const nearly=['2025-04-24','2025-05-01','2025-05-08'].map(d=>attempt(S11,criteriaOf(S11).filter(id=>id!==RK11),d));
  const records=[...threeIn10,...nearly],o=findOddities(records,scope).find(x=>x.label==='Rhythmic kick')!,plan=planOddityFix(o,records,'tick',ctx());
  expect(plan.changes.join('\n')).toMatch(/reaches 3 of 3 successful attempts/);
  expect(apply(records,plan.operations).filter(r=>r.payload.skillId===S11&&r.success)).toHaveLength(3);
 });
 it('is not possible for timed skills and when nothing needs to change',()=>{
  const timed='Splash7:10',oddity={id:'x',classId:CLASS,enrollmentId:ENR,level:'Splash7',key:'k',label:'Kick',criteria:[
   {criterionId:'Splash7:9:1',skillId:'Splash7:9',skillName:'A',ticked:true,successfulMarks:3,skillSuccesses:0,skillComplete:false,attempts:3},
   {criterionId:`${timed}:1`,skillId:timed,skillName:'Timed',ticked:false,successfulMarks:0,skillSuccesses:0,skillComplete:false,attempts:0}]};
  const plan=planOddityFix(oddity,[],'tick',ctx());
  expect(plan.possible).toBe(false);expect(plan.operations).toEqual([]);expect(plan.warnings.join(' ')).toMatch(/timed/);
  const noop=planOddityFix({...oddity,criteria:oddity.criteria.map(c=>({...c,ticked:true}))},[],'tick',ctx());
  expect(noop.possible).toBe(false);expect(noop.warnings.length).toBeGreaterThan(0);
 });
 it('attemptSucceeds requires the benchmark for timed skills',()=>{
  const results=[{subskillId:'a',status:'successful' as const}];
  expect(attemptSucceeds({skillId:'Splash7:10',results})).toBe(false);
  expect(attemptSucceeds({skillId:'Splash7:10',results,timed:{lapsRequired:4,lapsCompleted:4,elapsedMs:179000}})).toBe(true);
  expect(attemptSucceeds({skillId:'Splash7:10',results,timed:{lapsRequired:4,lapsCompleted:4,elapsedMs:181000}})).toBe(false);
  expect(attemptSucceeds({skillId:S10,results})).toBe(true);
 });
});

describe('planOddityFix untick',()=>{
 it('flips k-2 marks and clears every tick in the group',()=>{
  const records=[...threeIn10,...threeIn10.map(r=>attempt(S11,[RK11],r.lessonDate)),attempt(S11,[RK11],'2025-05-15')];
  // RK10 has 3 marks (ticked), RK11 has 4 marks (ticked): not an oddity, but the plan still works from a hand-made oddity.
  const o={...findOddities([...threeIn10,attempt(S11,[RK11])],scope)[0]};
  o.criteria=o.criteria.map(c=>c.criterionId===RK11?{...c,ticked:true,successfulMarks:4}:c);
  const plan=planOddityFix(o,records,'untick',ctx());
  expect(plan.possible).toBe(true);
  expect(plan.operations).toHaveLength(3);
  const after=reportCardMarks(apply(records,plan.operations),LEVEL,V);
  expect(after.ticked.has(RK10)||after.ticked.has(RK11)).toBe(false);
  expect(plan.warnings).toEqual([]);
 });
 it('prefers fully successful attempts and warns when a skill drops from complete',()=>{
  const full=['2025-04-24','2025-05-01','2025-05-08'].map(d=>attempt(S10,'all',d)),partial=attempt(S10,[RK10],'2025-05-15');
  const records=[...full,partial,attempt(S11,[],'2025-05-01')],o=findOddities(records,scope).find(x=>x.label==='Rhythmic kick')!;
  const plan=planOddityFix(o,records,'untick',ctx());
  expect(plan.possible).toBe(true);
  expect(plan.operations).toHaveLength(2);
  expect(plan.operations.map(op=>op.recordId)).not.toContain(partial.recordId);
  expect(plan.warnings.join(' ')).toMatch(/will drop to 1 of 3 successful attempts/);
  const after=reportCardMarks(apply(records,plan.operations),LEVEL,V);
  expect(after.ticked.has(RK10)).toBe(false);expect(after.ticked.has(RK11)).toBe(false);
 });
 it('is not possible when nothing is ticked',()=>{
  const records=[attempt(S10,[RK10]),attempt(S11,[RK11])],o={id:'x',classId:CLASS,enrollmentId:ENR,level:LEVEL,key:'rhythmic kick',label:'Rhythmic kick',criteria:[]};
  const plan=planOddityFix(o,records,'untick',ctx());
  expect(plan.possible).toBe(false);expect(plan.warnings.length).toBeGreaterThan(0);
 });
});

describe('ignored oddities storage',()=>{
 beforeEach(()=>installLocalStorage());
 afterEach(()=>vi.unstubAllGlobals());
 it('round trips ids',()=>{
  saveIgnoredOddities('k',new Set(['a','b']));
  expect(loadIgnoredOddities('k')).toEqual(new Set(['a','b']));
  expect(loadIgnoredOddities('missing')).toEqual(new Set());
 });
 it('tolerates bad JSON and non-array values',()=>{
  localStorage.setItem('k','{nope');expect(loadIgnoredOddities('k')).toEqual(new Set());
  localStorage.setItem('k','{"a":1}');expect(loadIgnoredOddities('k')).toEqual(new Set());
  localStorage.setItem('k','["a",3,null]');expect(loadIgnoredOddities('k')).toEqual(new Set(['a']));
 });
 it('tolerates a throwing localStorage',()=>{
  vi.stubGlobal('localStorage',{getItem:()=>{throw new Error('blocked');},setItem:()=>{throw new Error('full');}});
  expect(loadIgnoredOddities('k')).toEqual(new Set());
  expect(()=>saveIgnoredOddities('k',new Set(['a']))).not.toThrow();
 });
});

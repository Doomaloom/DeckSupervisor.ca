import curriculum from './curriculum.json';
import {CRITERION_TICK_THRESHOLD,reportCardMarks} from '../../shared/report-cards/reportCards';
import type {ResultOperation,ResultPayload,ResultRecord} from '../../lib/resultsApi';
import previous from './curriculum-previous.json';
import {PREVIOUS_CURRICULUM_VERSION,TIMED_SKILLS,curriculumMigration,isTranslated,skillNameFor,toCurrentRecords,type CurrentRecord} from './translate';
export {TIMED_SKILLS};

/**
 * Report card oddities (computed on current-version records plus translated old-version ones, so the groups follow the
 * report card wording of the current catalog): within one level, criteria with the same wording are the same must-see (for example
 * "Rhythmic kick" under both "Flutter kick on front" and "Front crawl"). A swimmer whose report card ticks one of
 * them but not another is flagged for the supervisor to fix or ignore. Generic outcome criteria (distances, times,
 * repetitions, continuous sequences, Water Smart participation) differ per skill and are never compared.
 */
export type EquivalentGroup={key:string;label:string;criterionIds:string[]};
export type OddityCriterion={criterionId:string;skillId:string;skillName:string;ticked:boolean;successfulMarks:number;skillSuccesses:number;skillComplete:boolean;attempts:number};
/** One skill involved in an oddity, with every subskill on its report card; `matched` marks the subskills of the oddity's group. */
export type OdditySkill={skillId:string;skillName:string;successes:number;complete:boolean;attempts:number;criteria:{criterionId:string;label:string;ticked:boolean;successfulMarks:number;matched:boolean}[]};
export type Oddity={id:string;classId:string;enrollmentId:string;level:string;key:string;label:string;criteria:OddityCriterion[];skills:OdditySkill[]};
export type FixDirection='tick'|'untick';
export type FixContext={sessionId:string;datasetId:string;lessonDates:string[];curriculumVersion:string;now:()=>string;newId:()=>string};
export type FixPlan={direction:FixDirection;possible:boolean;operations:ResultOperation[];changes:string[];warnings:string[]};

const criteriaText=curriculum.criteria as Record<string,string>,skillNames=curriculum.skills as Record<string,string>;
const criterionList=Object.entries(criteriaText);
/** Generic outcome criteria (normalized text) that differ per skill and must never be compared. */
export const EXCLUDED_CRITERIA=[/^participation in a water activity/,/minimum distance/,/^distance (completed|requirement)/,/minimum time met/,/^time (requirement met|met or bettered)/,/^repetitions completed/,/^completion of skills in a continuous sequence/,/^continuous propulsion$/,/^\d+ m\b/,/^\d+ metres? distance/,/^\d+ seconds? time/,/must sees/,/as fast as possible/];
export const normalizeCriterion=(text:string)=>text.toLowerCase().trim().replace(/[;,:.]/g,' ').replace(/\s+/g,' ').trim();
const skillOf=(criterionId:string)=>criterionId.split(':').slice(0,2).join(':'),levelOf=(id:string)=>id.split(':')[0];
const skillCriteria=(skillId:string)=>criterionList.map(([id])=>id).filter(id=>skillOf(id)===skillId);

const groupCache=new Map<string,EquivalentGroup[]>();
/** Groups of same-worded criteria spread over at least two skills of the level, in curriculum order. */
export function equivalentCriteriaGroups(level:string):EquivalentGroup[]{
 const cached=groupCache.get(level);if(cached)return cached;
 const byKey=new Map<string,EquivalentGroup>();
 for(const [id,text] of criterionList){
  if(levelOf(id)!==level)continue;
  const key=normalizeCriterion(text);
  if(!key||EXCLUDED_CRITERIA.some(re=>re.test(key)))continue;
  const group=byKey.get(key);
  if(group)group.criterionIds.push(id);else byKey.set(key,{key,label:text.trim().replace(/:$/,'').trim(),criterionIds:[id]});
 }
 const groups=[...byKey.values()].filter(g=>new Set(g.criterionIds.map(skillOf)).size>=2);
 groupCache.set(level,groups);return groups;
}

type Scope={classId:string;enrollmentId:string;curriculumVersion:string};
const isAttempt=(r:ResultRecord,s:Scope)=>!r.deleted&&r.kind==='attempt'&&r.curriculumVersion===s.curriculumVersion&&r.classId===s.classId&&r.enrollmentId===s.enrollmentId&&!!r.payload.skillId;
const marksOn=(r:{payload:ResultPayload},criterionId:string)=>r.payload.results?.some(x=>x.subskillId===criterionId&&x.status==='successful')?1:0;

/** Oddities of one swimmer (one enrollment in one class): a group with some criteria ticked on the report card and others not. Takes the stored records; old-version attempts are translated here. */
export function findOddities(records:ResultRecord[],scope:Scope):Oddity[]{
 const mine=toCurrentRecords(records).filter(r=>isAttempt(r,scope)),out:Oddity[]=[];
 for(const level of [...new Set(mine.map(r=>levelOf(r.payload.skillId!)))].sort()){
  const marks=reportCardMarks(mine,level,scope.curriculumVersion);
  for(const g of equivalentCriteriaGroups(level)){
   const criteria=g.criterionIds.map(criterionId=>{
    const skillId=skillOf(criterionId),inSkill=mine.filter(r=>r.payload.skillId===skillId);
    return {criterionId,skillId,skillName:skillNames[skillId]??skillId,ticked:marks.ticked.has(criterionId),
     successfulMarks:inSkill.reduce((n,r)=>n+marksOn(r,criterionId),0),skillSuccesses:inSkill.filter(r=>r.success).length,skillComplete:marks.completeSkills.has(skillId),attempts:inSkill.length};
   });
   if(!(criteria.some(c=>c.ticked)&&criteria.some(c=>!c.ticked)))continue;
   const skills=[...new Set(criteria.map(c=>c.skillId))].map(skillId=>{
    const inSkill=mine.filter(r=>r.payload.skillId===skillId),first=criteria.find(c=>c.skillId===skillId)!;
    return {skillId,skillName:first.skillName,successes:first.skillSuccesses,complete:first.skillComplete,attempts:first.attempts,
     criteria:skillCriteria(skillId).map(criterionId=>({criterionId,label:criteriaText[criterionId].trim().replace(/:$/,'').trim(),ticked:marks.ticked.has(criterionId),successfulMarks:inSkill.reduce((n,r)=>n+marksOn(r,criterionId),0),matched:g.criterionIds.includes(criterionId)}))};
   });
   out.push({id:`${scope.classId}:${scope.enrollmentId}:${level}:${g.key}`,classId:scope.classId,enrollmentId:scope.enrollmentId,level,key:g.key,label:g.label,criteria,skills});
  }
 }
 return out;
}

/** Same rule as the server (result_validate): all criteria successful, plus the benchmark when the skill is timed. */
export function attemptSucceeds(payload:ResultPayload):boolean{
 const limit=payload.skillId?TIMED_SKILLS.get(payload.skillId):undefined,t=payload.timed;
 if(!(payload.results??[]).every(x=>x.status==='successful'))return false;
 return limit===undefined||(!!t&&t.lapsCompleted===t.lapsRequired&&t.elapsedMs<=limit);
}
const newer=(a:ResultRecord,b:ResultRecord)=>b.lessonDate.localeCompare(a.lessonDate)||(b.payload.submittedAt??'').localeCompare(a.payload.submittedAt??'')||b.recordId.localeCompare(a.recordId);
const dateList=(ds:string[])=>[...new Set(ds)].sort().join(', ');
const setStatus=(results:NonNullable<ResultPayload['results']>,ids:string[],status:'successful'|'not_yet')=>results.map(x=>ids.includes(x.subskillId)?{...x,status}:x);
const previousText=previous.criteria as Record<string,string>;
const quoted=(text:string)=>`"${text.trim().replace(/:$/,'').trim()}"`;

/**
 * Plans the corrections that make every criterion of the oddity's group agree: ticked (3 successful marks) or not ticked (at most 2).
 * Takes the stored records. Marks are counted on current-version plus translated old-version attempts, but only real records
 * are edited, each as an ordinary upsert (one per record) that keeps its audit history. Nothing is sent here.
 *  - tick: flips not-yet marks on current-version attempts, then adds current-version supervisor attempts (every subskill of the skill).
 *  - untick: a mark that comes from a translated old attempt is removed by setting the old subskills it comes from to not yet on that
 *    old record (in its own version, keeping its other criteria); a warning names the other current subskills those old subskills feed.
 */
export function planOddityFix(oddity:Oddity,records:ResultRecord[],direction:FixDirection,context:FixContext):FixPlan{
 const originals=records.filter(r=>!r.deleted&&r.kind==='attempt'&&r.classId===oddity.classId&&r.enrollmentId===oddity.enrollmentId&&!!r.payload.skillId&&(r.curriculumVersion===context.curriculumVersion||r.curriculumVersion===PREVIOUS_CURRICULUM_VERSION)).sort(newer);
 const work=new Map(originals.map(r=>[r.recordId,r.payload.results??[]])),touched=new Set<string>();
 /** Current view of the swimmer's attempts: edited records recomputed, old ones translated again from their edited form. */
 const view=():CurrentRecord[]=>toCurrentRecords(originals.map(r=>touched.has(r.recordId)?{...r,payload:{...r.payload,results:work.get(r.recordId)},success:attemptSucceeds({...r.payload,results:work.get(r.recordId)})}:r)).filter(r=>r.curriculumVersion===context.curriculumVersion);
 const changes:string[]=[],warnings:string[]=[];
 const marks=(skillId:string,id:string)=>view().filter(r=>r.payload.skillId===skillId&&r.payload.results?.some(x=>x.subskillId===id&&x.status==='successful'));
 const successes=(skillId:string)=>view().filter(r=>r.payload.skillId===skillId&&r.success).length;
 const skillsOf=[...new Set(oddity.criteria.map(c=>c.skillId))];
 const before=new Map(skillsOf.map(s=>[s,successes(s)]));
 const addedBySkill=new Map<string,string[][]>();
 const editedOld=new Map<string,Set<string>>();
 let impossible=false;
 for(const c of oddity.criteria){
  const have=marks(c.skillId,c.criterionId).length,name=`${c.skillName}: "${oddity.label}"`;
  if(direction==='tick'&&c.ticked||direction==='untick'&&!c.ticked)continue;
  if(direction==='tick'){
   const need=CRITERION_TICK_THRESHOLD-have;if(need<=0)continue;
   const flips=view().filter(r=>!isTranslated(r)&&r.payload.skillId===c.skillId&&!r.payload.results?.some(x=>x.subskillId===c.criterionId&&x.status==='successful')).slice(0,need);
   for(const r of flips){work.set(r.recordId,setStatus(work.get(r.recordId)!,[c.criterionId],'successful'));touched.add(r.recordId);}
   if(flips.length)changes.push(`${name}: mark achieved on ${flips.length} existing attempt${flips.length===1?'':'s'} dated ${dateList(flips.map(r=>r.lessonDate))}`);
   const missing=need-flips.length;
   if(missing>0){
    if(TIMED_SKILLS.has(c.skillId)){impossible=true;warnings.push(`${c.skillName} is a timed benchmark. New attempts cannot be added for it, and its existing attempts cannot reach ${CRITERION_TICK_THRESHOLD} achieved marks for "${oddity.label}".`);continue;}
    const list=addedBySkill.get(c.skillId)??[];addedBySkill.set(c.skillId,list);
    for(let i=0;i<missing;i++)(list[i]??=[]).push(c.criterionId);
   }
  }else{
   const flipCount=have-(CRITERION_TICK_THRESHOLD-1);if(flipCount<=0)continue;
   const candidates=marks(c.skillId,c.criterionId).sort((a,b)=>Number(b.success)-Number(a.success)||newer(a,b)),flips=candidates.slice(0,flipCount);
   const real=flips.filter(r=>!isTranslated(r)),old=flips.filter(isTranslated);
   for(const r of real){work.set(r.recordId,setStatus(work.get(r.recordId)!,[c.criterionId],'not_yet'));touched.add(r.recordId);}
   if(real.length)changes.push(`${name}: mark not yet on ${real.length} attempt${real.length===1?'':'s'} dated ${dateList(real.map(r=>r.lessonDate))}`);
   for(const r of old){
    const source=originals.find(o=>o.recordId===r.translatedFrom)!,rule=curriculumMigration.subskills[c.criterionId],oldSkill=source.payload.skillId!;
    const marked=(work.get(source.recordId)??[]).filter(x=>x.status==='successful').map(x=>x.subskillId);
    // A box with no old criterion ticks with the old skill's success; one successful old subskill less makes that attempt not successful.
    const ids=rule?.from.length?rule.from.filter(id=>marked.includes(id)):marked.slice(0,1);
    if(!ids.length)continue;
    work.set(source.recordId,setStatus(work.get(source.recordId)!,ids,'not_yet'));touched.add(source.recordId);
    const set=editedOld.get(source.recordId)??new Set<string>();ids.forEach(id=>set.add(id));editedOld.set(source.recordId,set);
    changes.push(`${name}: edits the earlier-curriculum record of ${skillNameFor(PREVIOUS_CURRICULUM_VERSION,oldSkill)} dated ${source.lessonDate}, setting ${ids.map(id=>quoted(previousText[id]??id)).join(', ')} to not yet`);
   }
  }
 }
 for(const [recordId,ids] of editedOld){
  const source=originals.find(o=>o.recordId===recordId)!,oldSkill=source.payload.skillId!,list=[...ids];
  // Every current subskill fed by the edited old subskills loses that mark too, not only the one being fixed.
  const others=Object.entries(curriculumMigration.skills).filter(([,olds])=>olds.includes(oldSkill)).map(([s])=>s).flatMap(s=>Object.keys(criteriaText).filter(id=>skillOf(id)===s&&!oddity.criteria.some(c=>c.criterionId===id)&&curriculumMigration.subskills[id]?.from.some(f=>list.includes(f))));
  warnings.push(`This also changes the original ${skillNameFor(PREVIOUS_CURRICULUM_VERSION,oldSkill)} record dated ${source.lessonDate}, which was saved in the previous curriculum: ${list.map(id=>quoted(previousText[id]??id)).join(', ')} ${list.length===1?'is':'are'} set to not yet there.${others.length?` Other subskills fed by ${list.length===1?'it':'them'} lose their mark from that attempt too: ${others.map(id=>`${skillNames[skillOf(id)]??skillOf(id)}: ${quoted(criteriaText[id])}`).join('; ')}.`:''}`);
 }
 const latest=[...context.lessonDates].sort().pop(),additions:ResultOperation[]=[];
 if(addedBySkill.size&&!latest){impossible=true;warnings.push('The class has no lesson dates, so supervisor attempts cannot be added.');}
 else if(!impossible)for(const [skillId,attempts] of addedBySkill){
  const ids:string[]=[];
  for(const marked of attempts){
   const stamp=context.now(),recordId=context.newId();ids.push(recordId);
   additions.push({operationId:context.newId(),sessionId:context.sessionId,datasetId:context.datasetId,classId:oddity.classId,enrollmentId:oddity.enrollmentId,recordId,kind:'attempt',action:'upsert',baseRevision:0,lessonDate:latest!,curriculumVersion:context.curriculumVersion,
    payload:{skillId,createdAt:stamp,submittedAt:stamp,results:skillCriteria(skillId).map(subskillId=>({subskillId,status:marked.includes(subskillId)?'successful' as const:'not_yet' as const}))}});
  }
  changes.push(`${skillNameOf(oddity,skillId)}: adds ${attempts.length} supervisor attempt${attempts.length===1?'':'s'} dated ${latest}`);
 }
 if(impossible)return {direction,possible:false,operations:[],changes:[],warnings};
 for(const s of skillsOf){
  const now=successes(s)+(addedBySkill.get(s)?.filter(m=>m.length===skillCriteria(s).length).length??0),was=before.get(s)!;
  if(direction==='tick'&&was<CRITERION_TICK_THRESHOLD&&now>=CRITERION_TICK_THRESHOLD)changes.push(`${skillNameOf(oddity,s)}: reaches ${CRITERION_TICK_THRESHOLD} of ${CRITERION_TICK_THRESHOLD} successful attempts, so the whole skill counts as complete.`);
  if(direction==='untick'&&was>=CRITERION_TICK_THRESHOLD&&now<CRITERION_TICK_THRESHOLD)warnings.push(`${skillNameOf(oddity,s)} will drop to ${now} of ${CRITERION_TICK_THRESHOLD} successful attempts, so the other criteria of that skill lose their tick too and the level result may become I.`);
 }
 const edits=originals.filter(r=>touched.has(r.recordId)).map(r=>{
  const {revision,deleted:_d,success:_s,updatedAt:_u,...old}=r;
  return {...old,operationId:context.newId(),baseRevision:revision,action:'upsert' as const,payload:{...r.payload,results:work.get(r.recordId)}};
 });
 const operations=[...edits,...additions];
 if(!operations.length)return {direction,possible:false,operations:[],changes:[],warnings:[...warnings,'Nothing needs to change.']};
 return {direction,possible:true,operations,changes,warnings};
}
const skillNameOf=(o:Oddity,skillId:string)=>o.criteria.find(c=>c.skillId===skillId)?.skillName??skillNames[skillId]??skillId;

/** Ignored oddity ids live in this browser only; any storage or JSON problem reads as "nothing ignored". */
export function loadIgnoredOddities(storageKey:string):Set<string>{
 try{const v=JSON.parse(localStorage.getItem(storageKey)??'[]');return new Set(Array.isArray(v)?v.filter((x):x is string=>typeof x==='string'):[]);}catch{return new Set();}
}
export function saveIgnoredOddities(storageKey:string,ids:Set<string>):void{
 try{localStorage.setItem(storageKey,JSON.stringify([...ids]));}catch{/* storage unavailable: the choice just is not remembered */}
}

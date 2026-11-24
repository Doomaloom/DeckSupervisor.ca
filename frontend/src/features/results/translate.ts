import current from './curriculum.json';
import previous from './curriculum-previous.json';
import rawMigration from './curriculum-migration.json';
import type {ResultRecord} from '../../lib/resultsApi';

/**
 * Results saved before the report-card curriculum are translated when read, never rewritten: each old attempt becomes
 * one virtual attempt of every current skill fed by its skill. The rule is the one the tablet uses
 * (rec-tablet catalog-migration.json): see "Translation rule" in the report card catalog spec.
 */
type Migration={from:string;to:string;skills:Record<string,string[]>;subskills:Record<string,{from:string[];fromSkillSuccess:boolean}>};
const migration=rawMigration as Migration;
export const CURRENT_CURRICULUM_VERSION=current.version;
export const PREVIOUS_CURRICULUM_VERSION=previous.version;
export const curriculumMigration=migration;
/** Skills whose attempts carry a benchmark timing (ms allowed). A translated attempt there also needs the old attempt to have succeeded. */
export const TIMED_SKILLS:ReadonlyMap<string,number>=new Map([['Splash7:10',180000],['Splash8:9',360000],['Splash9:11',540000]]);

const labels:Record<string,{skills:Record<string,string>;criteria:Record<string,string>}>={
 [current.version]:{skills:current.skills as Record<string,string>,criteria:current.criteria as Record<string,string>},
 [previous.version]:{skills:previous.skills as Record<string,string>,criteria:previous.criteria as Record<string,string>},
};
/** A skill's name in the curriculum version a record was saved in (the id itself when that version does not know it). */
export const skillNameFor=(version:string|undefined,id:string)=>labels[version??current.version]?.skills[id]??id;
export const criterionNameFor=(version:string|undefined,id:string)=>labels[version??current.version]?.criteria[id]??id;

const skillOfSubskill=(id:string)=>id.slice(0,id.lastIndexOf(':'));
const subskillsOfSkill=new Map<string,string[]>();
for(const id of Object.keys(current.criteria)){const skill=skillOfSubskill(id);(subskillsOfSkill.get(skill)??subskillsOfSkill.set(skill,[]).get(skill)!).push(id);}
/** New skills fed by each old skill, in catalog order. */
const newSkillsOf=new Map<string,string[]>();
for(const [skill,olds] of Object.entries(migration.skills))for(const old of olds)(newSkillsOf.get(old)??newSkillsOf.set(old,[]).get(old)!).push(skill);
export const currentSkillsFedBy=(oldSkillId:string)=>newSkillsOf.get(oldSkillId)??[];
export const oldSkillsOf=(skillId:string)=>migration.skills[skillId]??[];

export type CurrentRecord=ResultRecord&{translatedFrom?:string};
/** True for a virtual record translated from an old-version record; it is read-only and never submitted. */
export const isTranslated=(r:CurrentRecord)=>r.translatedFrom!==undefined;

function translateAttempt(old:ResultRecord,skillId:string):CurrentRecord{
 const marks=new Map((old.payload.results??[]).map(r=>[r.subskillId,r.status]));
 const results=(subskillsOfSkill.get(skillId)??[]).map(subskillId=>{
  const rule=migration.subskills[subskillId],seen=(rule?.from??[]).filter(id=>marks.has(id));
  const ok=rule?.from.length?seen.length>0&&seen.every(id=>marks.get(id)==='successful'):!!rule?.fromSkillSuccess&&old.success;
  return {subskillId,status:ok?'successful' as const:'not_yet' as const};
 });
 const success=results.every(r=>r.status==='successful')&&(!TIMED_SKILLS.has(skillId)||old.success);
 return {...old,recordId:`${old.recordId}#${skillId}`,curriculumVersion:current.version,success,translatedFrom:old.recordId,payload:{...old.payload,skillId,results}};
}

/**
 * The records every result computation reads: current-version records pass through, previous-version attempts become
 * virtual current attempts (`translatedFrom` = the original recordId), attendance is unchanged and records of any other
 * version are ignored. Deleted records stay in the list, flagged, so consumers apply their own deleted rule.
 */
export function toCurrentRecords(records:ResultRecord[]):CurrentRecord[]{
 const out:CurrentRecord[]=[];
 for(const r of records){
  if(r.kind==='attendance'){out.push(r);continue;}
  if(r.curriculumVersion===current.version){out.push(r);continue;}
  if(r.curriculumVersion!==migration.from||!r.payload.skillId)continue;
  for(const skillId of newSkillsOf.get(r.payload.skillId)??[])out.push(translateAttempt(r,skillId));
 }
 return out;
}

/** Successful attempt counts per current skill (uncapped) from current and translated records. */
export function successfulByCurrentSkill(records:ResultRecord[]):Record<string,number>{
 const counts:Record<string,number>={};
 for(const r of toCurrentRecords(records))if(!r.deleted&&r.kind==='attempt'&&r.success&&r.payload.skillId)counts[r.payload.skillId]=(counts[r.payload.skillId]??0)+1;
 return counts;
}
/**
 * Completed attendance sheets keep their blank-sheet columns, which are the previous version's skills. The column of old
 * skill X counts the successful attempts of the least successful current skill fed by X (X itself when it was not split).
 */
export function columnSuccesses(byCurrentSkill:Record<string,number>):Record<string,number>{
 const out:Record<string,number>={};
 for(const [old,skills] of newSkillsOf){const n=Math.min(...skills.map(s=>byCurrentSkill[s]??0));if(n>0)out[old]=n;}
 return out;
}
/** Inverse of columnSuccesses for callers that only have column counts: a current skill is as successful as its least successful old skill. */
export function currentFromColumns(columns:Record<string,number>):Record<string,number>{
 const out:Record<string,number>={};
 for(const [skill,olds] of Object.entries(migration.skills)){const n=olds.length?Math.min(...olds.map(o=>columns[o]??0)):0;if(n>0)out[skill]=n;}
 return out;
}

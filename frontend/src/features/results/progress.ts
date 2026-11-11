import type {ResultRecord} from '../../lib/resultsApi';
/** Current records are authoritative: corrections replace, and tombstones remove, an attempt. */
export function acceptedProgress(records:ResultRecord[],curriculumVersion:string){
 const result=new Map<string,Map<string,number>>();
 for(const record of records){if(record.deleted||record.kind!=='attempt'||record.curriculumVersion!==curriculumVersion||!record.payload.skillId)continue;const skills=result.get(record.enrollmentId)??new Map<string,number>();skills.set(record.payload.skillId,Math.min(3,(skills.get(record.payload.skillId)??0)+(record.success?1:0)));result.set(record.enrollmentId,skills);}
 return result;
}

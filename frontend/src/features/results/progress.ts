import type {ResultRecord} from '../../lib/resultsApi';
import {toCurrentRecords} from './translate';
/**
 * Successful attempts per enrollment and current skill, capped at three. Current records are authoritative: corrections
 * replace, and tombstones remove, an attempt. Old-version attempts count through translation.
 */
export function acceptedProgress(records:ResultRecord[]){
 const result=new Map<string,Map<string,number>>();
 for(const record of toCurrentRecords(records)){if(record.deleted||record.kind!=='attempt'||!record.payload.skillId)continue;const skills=result.get(record.enrollmentId)??new Map<string,number>();skills.set(record.payload.skillId,Math.min(3,(skills.get(record.payload.skillId)??0)+(record.success?1:0)));result.set(record.enrollmentId,skills);}
 return result;
}

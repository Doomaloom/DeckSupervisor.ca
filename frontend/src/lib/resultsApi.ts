export type ResultIdentity = {sourceId:string;enrollmentId:string;matchKey:string;matchKeys?:string[];active?:boolean};
export type ResultCourse = {sourceId:string;classId:string;instructorId:string;lessonDates:string[];swimmers:ResultIdentity[]};
export type ResultRegistry = {schemaVersion:1;sessionId:string;datasetId:string;courses:ResultCourse[]};
export type ResultPayload = {status?:'present'|'absent'|'unmarked';skillId?:string;createdAt?:string;submittedAt?:string;results?:{subskillId:string;status:'successful'|'not_yet'}[];timed?:{lapsRequired:number;lapsCompleted:number;elapsedMs:number}};
export type ResultOperation = {operationId:string;sessionId:string;datasetId:string;classId:string;enrollmentId:string;recordId:string;kind:'attendance'|'attempt';action:'upsert'|'delete';baseRevision:number;lessonDate:string;curriculumVersion:string;payload:ResultPayload};
export type ResultRecord = ResultOperation & {revision:number;deleted:boolean;success:boolean;updatedAt:string};
export type ResultConflict = {id:string;operation:ResultOperation;current:ResultRecord|null;resolved:boolean};
export type Results = {schemaVersion:1;records:ResultRecord[];conflicts:ResultConflict[];history:{recordId:string;revision:number;record:ResultRecord}[]};
export type ResultGrant={id:string;instructorId:string;expiresAt:string;revoked:boolean};
export async function resultRequest<T>(path:string,method='GET',body?:unknown):Promise<T>{
 const response=await fetch(path,{method,credentials:'include',headers:{'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
 if(!response.ok)throw new Error(await response.text()||`Request failed (${response.status})`);
 return response.status===204?undefined as T:response.json();
}
const base=(id:string)=>`/api/sessions/${encodeURIComponent(id)}`;
export async function fetchResultRegistry(id:string):Promise<ResultRegistry|null>{const response=await fetch(`${base(id)}/result-identities`,{credentials:'include'});if(response.status===404)return null;if(!response.ok)throw new Error(await response.text());return response.json();}
export const putResultRegistry=(r:ResultRegistry)=>resultRequest<ResultRegistry>(`${base(r.sessionId)}/result-identities`,'PUT',r);
export const fetchResultClasses=(id:string)=>resultRequest<{classes:{id:string;code:string;instructorId:string}[]}>(`${base(id)}/result-classes`);
export const reconcileResultIdentity=(id:string,body:{courseId:string;swimmerId:string;enrollmentId:string;matchKey:string})=>resultRequest(`${base(id)}/result-identities/reconcile`,'POST',body);
export const fetchResults=(id:string)=>resultRequest<Results>(`${base(id)}/results`);
export const submitResult=(id:string,operation:ResultOperation)=>resultRequest<{receipts:{operationId:string;status:string;revision:number;reason?:string}[]}>(`${base(id)}/results`,'POST',{schemaVersion:1,operations:[operation]});
export const resolveResultConflict=(id:string,conflict:string,choice:'current'|'incoming')=>resultRequest(`${base(id)}/results/conflicts/${encodeURIComponent(conflict)}/resolve`,'POST',{choice});
export const fetchResultGrants=(id:string)=>resultRequest<{grants:ResultGrant[]}>(`${base(id)}/result-grants`);
export const revokeResultGrant=(id:string,grant:string)=>resultRequest(`${base(id)}/result-grants/${encodeURIComponent(grant)}`,'DELETE');

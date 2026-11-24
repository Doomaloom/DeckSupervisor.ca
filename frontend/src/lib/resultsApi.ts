export type ResultIdentity = {sourceId:string;enrollmentId:string;matchKey:string;matchKeys?:string[];active?:boolean};
export type ResultCourse = {sourceId:string;classId:string;instructorId:string;lessonDates:string[];swimmers:ResultIdentity[]};
export type ResultRegistry = {schemaVersion:1;sessionId:string;datasetId:string;courses:ResultCourse[]};
export type ResultPayload = {status?:'present'|'absent'|'unmarked';skillId?:string;createdAt?:string;submittedAt?:string;results?:{subskillId:string;status:'successful'|'not_yet'}[];timed?:{lapsRequired:number;lapsCompleted:number;elapsedMs:number}};
export type ResultOperation = {operationId:string;sessionId:string;datasetId:string;classId:string;enrollmentId:string;recordId:string;kind:'attendance'|'attempt';action:'upsert'|'delete';baseRevision:number;lessonDate:string;curriculumVersion:string;payload:ResultPayload};
export type ResultRecord = ResultOperation & {revision:number;deleted:boolean;success:boolean;updatedAt:string};
export type ResultConflict = {id:string;operation:ResultOperation;current:ResultRecord|null;resolved:boolean};
export type Results = {schemaVersion:1;records:ResultRecord[];conflicts:ResultConflict[];history:{recordId:string;revision:number;record:ResultRecord}[]};
export type ResultGrant={id:string;instructorId:string;expiresAt:string;revoked:boolean};
export class ResultRequestError extends Error{constructor(message:string,readonly status:number){super(message);this.name='ResultRequestError';}}
export const RESULTS_UNAVAILABLE='Results could not be reached right now. Try again in a moment.';
export const RESULTS_FORBIDDEN='You do not have access to results for this session. If you teach in it, results appear after your supervisor exports its classes to a tablet.';
// A 403 is a real refusal; outages (5xx, network) must never read as a permission problem.
async function resultFailure(response:Response):Promise<ResultRequestError>{
 if(response.status===403)return new ResultRequestError(RESULTS_FORBIDDEN,403);
 if(response.status===401)return new ResultRequestError('Your sign-in has expired. Sign in again.',401);
 const text=(await response.text().catch(()=>'')).trim();
 if(response.status>=500)return new ResultRequestError(text&&text.length<=200&&!text.startsWith('<')?text:RESULTS_UNAVAILABLE,response.status);
 return new ResultRequestError(text||`Request failed (${response.status})`,response.status);
}
async function resultFetch(path:string,init:RequestInit):Promise<Response>{
 try{return await fetch(path,init);}catch{throw new ResultRequestError(RESULTS_UNAVAILABLE,0);}
}
export async function resultRequest<T>(path:string,method='GET',body?:unknown):Promise<T>{
 const response=await resultFetch(path,{method,credentials:'include',headers:{'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
 if(!response.ok)throw await resultFailure(response);
 return response.status===204?undefined as T:response.json();
}
const base=(id:string)=>`/api/sessions/${encodeURIComponent(id)}`;
export async function fetchResultRegistry(id:string):Promise<ResultRegistry|null>{const response=await resultFetch(`${base(id)}/result-identities`,{credentials:'include'});if(response.status===404)return null;if(!response.ok)throw await resultFailure(response);return response.json();}
export const putResultRegistry=(r:ResultRegistry)=>resultRequest<ResultRegistry>(`${base(r.sessionId)}/result-identities`,'PUT',r);
export const fetchResultClasses=(id:string)=>resultRequest<{classes:{id:string;code:string;instructorId:string}[]}>(`${base(id)}/result-classes`);
export const reconcileResultIdentity=(id:string,body:{courseId:string;swimmerId:string;enrollmentId:string;matchKey:string})=>resultRequest(`${base(id)}/result-identities/reconcile`,'POST',body);
export const fetchResults=(id:string,classId?:string)=>resultRequest<Results>(`${base(id)}/results${classId?`?classId=${encodeURIComponent(classId)}`:''}`);
export const submitResult=(id:string,operation:ResultOperation)=>resultRequest<{receipts:{operationId:string;status:string;revision:number;reason?:string}[]}>(`${base(id)}/results`,'POST',{schemaVersion:1,operations:[operation]});
export const resolveResultConflict=(id:string,conflict:string,choice:'current'|'incoming',expectedRevision:number)=>resultRequest(`${base(id)}/results/conflicts/${encodeURIComponent(conflict)}/resolve`,'POST',{choice,expectedRevision});
export const fetchResultGrants=(id:string)=>resultRequest<{grants:ResultGrant[]}>(`${base(id)}/result-grants`);
export const revokeResultGrant=(id:string,grant:string)=>resultRequest(`${base(id)}/result-grants/${encodeURIComponent(grant)}`,'DELETE');

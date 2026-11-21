import {acceptedProgress} from './progress';
import curriculum from './curriculum.json';
import {useEffect,useRef,useState} from 'react';
import {Card,PageShell,ActionButton,Notice,Select,TextInput} from '../../general-components';
import {useCurrentSession,type SessionRecord} from '../../app/useCurrentSession';
import {useAuth} from '../../app/AuthContext';
import {useInstructorSession} from '../instructor/session/InstructorSessionContext';
import * as api from '../../lib/resultsApi';
import {getScopedKey} from '../../lib/storageScope';
import {loadExportCourses} from '../decksupervisor/DeviceExport/services/loadExportCourses';
import {loadRegistry,saveRegistry} from '../decksupervisor/DeviceExport/services/exportStorage';
import {newRegistry} from '../decksupervisor/DeviceExport/services/exportPackage';
import {recoverRegistry,courseSourceId} from '../decksupervisor/DeviceExport/services/resultRegistry';
import {resolveLocalIdentities,bindLocalAlias,localNamesFromPackage,type LocalIdentity} from './identity';
import {findCurriculumLevel} from '../instructor/LessonPlans/lessonSkills';
import {openAttendancePrintWindow} from '../../shared/attendance-print/openAttendancePrintWindow';
import {COMPLETED_PRINT_CURRICULUM_VERSION} from '../../shared/attendance-print/completedAttendance';
import type {AttendancePrintItem} from '../../shared/attendance-print/types';
import {compareStudentNames} from '../decksupervisor/Rosters/utils';
const errorMessage=(e:unknown)=>e instanceof Error?e.message:String(e);
const skillNames=curriculum.skills as Record<string,string>,criterionNames=curriculum.criteria as Record<string,string>;
const skillName=(id?:string)=>id?(skillNames[id]??id):'Unknown skill';
const criterionName=(id:string)=>criterionNames[id]??id;
export function SupervisorResults(){
 const {session,loading}=useCurrentSession();const {isGuest,user}=useAuth();
 return <PageShell>{isGuest?<Notice>Guest packages are import-only. Sign in to review submitted results.</Notice>:loading?<p>Loading session…</p>:session?<ResultsView key={`${user?.id}:${session.id}`} session={session} supervisor/>:<p>Select a session to view results.</p>}</PageShell>;
}
export function InstructorResults(){
 const {session,sessionId,loading}=useInstructorSession();const {user}=useAuth();
 return <PageShell>{loading?<p>Loading session…</p>:session?<ResultsView key={`${user?.id}:${sessionId}`} session={{...session,team_id:null,created_by:'',source_locations:[],instructors:[],session_start_time24:session.session_start_time24??null,session_end_time24:session.session_end_time24??null}}/>:<p>Select an instructor session to view attendance and results.</p>}</PageShell>;
}
function RecordValue({value}:{value:api.ResultOperation|null}){
 if(!value)return <p>No accepted record</p>;
 if(value.action==='delete')return <p>Deleted</p>;
 return value.kind==='attendance'?<p>Attendance: {value.payload.status}</p>:<div><p>{skillName(value.payload.skillId)}</p><ul>{value.payload.results?.map(c=><li key={c.subskillId}>{criterionName(c.subskillId)}: {c.status==='successful'?'Successful':'Not yet'}</li>)}</ul>{value.payload.timed&&<p>{value.payload.timed.lapsCompleted} of {value.payload.timed.lapsRequired} laps in {(Math.floor(value.payload.timed.elapsedMs/100)/10).toFixed(1)} seconds</p>}</div>;
}
function AttemptEditor({record,busy,onSave}:{record:api.ResultRecord;busy:boolean;onSave:(payload:api.ResultPayload)=>void}){
 const [payload,setPayload]=useState(record.payload);
 useEffect(()=>setPayload(record.payload),[record.revision]);
 return <details><summary>Correct submitted assessment</summary><div className="flex flex-col gap-3 p-3">{payload.results?.map(c=><label key={c.subskillId}>{criterionName(c.subskillId)}<Select disabled={busy} value={c.status} onChange={e=>setPayload({...payload,results:payload.results!.map(item=>item===c?{...item,status:e.target.value as 'successful'|'not_yet'}:item)})}><option value="successful">Successful</option><option value="not_yet">Not yet</option></Select></label>)}{payload.timed&&(['lapsRequired','lapsCompleted','elapsedMs'] as const).map(field=><label key={field}>{field==='elapsedMs'?'Elapsed milliseconds':field==='lapsRequired'?'Laps required':'Laps completed'}<TextInput type="number" min="0" step="1" value={payload.timed![field]} onChange={e=>setPayload({...payload,timed:{...payload.timed!,[field]:Number(e.target.value)}})}/></label>)}<ActionButton disabled={busy} onClick={()=>onSave(payload)}>Save correction as a new revision</ActionButton></div></details>;
}
export function ResultsView({session,supervisor=false}:{session:SessionRecord;supervisor?:boolean}){
 const [registry,setRegistry]=useState<api.ResultRegistry|null>(null),[data,setData]=useState<api.Results|null>(null);
 const [identities,setIdentities]=useState<LocalIdentity[]>([]),[grants,setGrants]=useState<api.ResultGrant[]>([]);
 const [classId,setClassId]=useState(''),[date,setDate]=useState(''),[student,setStudent]=useState('');
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(true),[rosterWarning,setRosterWarning]=useState('');
 const [choices,setChoices]=useState<Record<string,string>>({});const mounted=useRef(true),working=useRef(false);
 const displayKey=()=>getScopedKey(`result-display-package:${session.id}`);
 function savedPackages():unknown[]{const text=localStorage.getItem(displayKey());if(!text)return [];const parsed:unknown=JSON.parse(text);return Array.isArray(parsed)?parsed:[parsed];}
 async function refresh(){
  const [r,d,g]=await Promise.all([api.fetchResultRegistry(session.id),api.fetchResults(session.id),supervisor?api.fetchResultGrants(session.id):Promise.resolve({grants:[]})]);
  let resolved:LocalIdentity[]=[],warning='';
  if(r){try{const courses=await loadExportCourses(session,!supervisor);if(supervisor)await recoverRegistry(session.id,courses);resolved=await resolveLocalIdentities(session.id,courses,r)}catch(e){warning=`Load this session’s class package below to resolve names. ${errorMessage(e)}`;}
   try{const saved=savedPackages();for(const pkg of saved.reverse()){const imported=localNamesFromPackage(pkg,r);resolved=[...resolved,...imported.filter(i=>!resolved.some(j=>j.enrollmentId===i.enrollmentId))];}}catch{warning='Saved local names could not be matched. Load a current class package.';}}
  if(!mounted.current)return;setRegistry(r);setData(d);setGrants(g.grants);setIdentities(resolved);setRosterWarning(warning);
 }
 useEffect(()=>{mounted.current=true;void refresh().catch(e=>{if(mounted.current)setError(errorMessage(e))}).finally(()=>{if(mounted.current)setBusy(false)});return()=>{mounted.current=false}},[session.id]);
 async function run(action:()=>Promise<void>){if(working.current)return;working.current=true;setBusy(true);setError('');setNotice('');try{await action();await refresh()}catch(e){if(mounted.current)setError(errorMessage(e));if(e instanceof api.ResultRequestError&&e.status===409)await refresh().catch(()=>{})}finally{working.current=false;if(mounted.current)setBusy(false)}}
 const localFor=(id:string)=>{const matches=identities.filter(i=>i.enrollmentId===id);return matches.length===1?matches[0]:undefined};
 const nameFor=(id:string)=>localFor(id)?.name??`Unresolved student (${id.slice(0,8)})`;
 // List swimmers in the blank-sheet order so row N is the same swimmer on blank and completed sheets.
 const byName=<T,>(items:T[],enrollmentId:(item:T)=>string)=>items.map(item=>({item,name:nameFor(enrollmentId(item))})).sort(compareStudentNames).map(({item})=>item);
 const course=registry?.courses.find(c=>c.classId===classId),students=byName(course?.swimmers??[],s=>s.enrollmentId),activeStudents=students.filter(s=>s.active!==false);
 const className=(c:api.ResultCourse)=>identities.find(i=>courseSourceId(session.id,i.course.code)===c.sourceId)?.course.code??c.sourceId;
 const progress=acceptedProgress((data?.records??[]).filter(r=>(!classId||r.classId===classId)&&(!student||r.enrollmentId===student)),COMPLETED_PRINT_CURRICULUM_VERSION);
 const records=(data?.records??[]).filter(r=>(!classId||r.classId===classId)&&(!date||r.lessonDate===date)&&(!student||r.enrollmentId===student));
 async function submit(operation:api.ResultOperation){const receipt=(await api.submitResult(session.id,operation)).receipts[0];if(!receipt||!['accepted','already_accepted','pending_review'].includes(receipt.status))throw new Error(receipt?.reason||'Correction rejected');setNotice(receipt.status==='pending_review'?'Correction requires supervisor review.':'Saved as a new revision.');}
 async function correction(record:api.ResultRecord,payload:api.ResultPayload,action:'upsert'|'delete'='upsert'){
  const {revision,deleted:_deleted,success:_success,updatedAt:_updatedAt,...old}=record;
  await submit({...old,operationId:crypto.randomUUID(),baseRevision:revision,action,payload});
 }
 async function attendance(enrollmentId:string,status:'present'|'absent'|'unmarked'){
  if(!registry||!course||!date)throw new Error('Choose a class and lesson date.');
  const recordId=`attendance:${enrollmentId}:${date}`,existing=data?.records.find(r=>r.recordId===recordId);
  if(existing)return correction(existing,{status});
  await submit({operationId:crypto.randomUUID(),sessionId:session.id,datasetId:registry.datasetId,classId:course.classId,enrollmentId,recordId,kind:'attendance',action:'upsert',baseRevision:0,lessonDate:date,curriculumVersion:COMPLETED_PRINT_CURRICULUM_VERSION,payload:{status}});
 }
 async function reconcile(identity:LocalIdentity){
  if(!registry||identity.ambiguous)throw new Error('Indistinguishable duplicate entries must be corrected in the source roster first.');
  const saved=registry.courses.find(c=>c.sourceId===courseSourceId(session.id,identity.course.code));
  if(!saved)throw new Error('Share this new class first to register its identity.');
  const choice=choices[identity.matchKey];if(!choice)throw new Error('Choose an existing enrollment or explicitly create a new enrollment.');
  let sourceId:string;
  if(choice==='new'){sourceId=crypto.randomUUID();await api.putResultRegistry({...registry,courses:registry.courses.map(c=>c===saved?{...c,swimmers:[...c.swimmers,{sourceId,enrollmentId:crypto.randomUUID(),matchKey:identity.matchKey}]}:c)});}
  else{const prior=saved.swimmers.find(s=>s.enrollmentId===choice);if(!prior)throw new Error('The selected enrollment changed. Refresh and review again.');sourceId=prior.sourceId;await api.reconcileResultIdentity(session.id,{courseId:saved.sourceId,swimmerId:sourceId,enrollmentId:prior.enrollmentId,matchKey:identity.matchKey});}
  const local=loadRegistry(session.id)??{...newRegistry(session.id),datasetId:registry.datasetId};saveRegistry(bindLocalAlias(local,identity,sourceId));
 }
 async function importNames(file:File){if(!registry)return;if(file.size>10*1024*1024)throw new Error('Package exceeds 10 MB.');const text=await file.text(),pkg:unknown=JSON.parse(text),names=localNamesFromPackage(pkg,registry);const previous=savedPackages();localStorage.setItem(displayKey(),JSON.stringify([...previous,pkg]));setIdentities(names);setRosterWarning('');}
 async function printCompleted(){
  if(!course||!registry||!data)throw new Error('Choose a registered class.');
  if(data.conflicts.some(c=>!c.resolved&&c.operation.classId===classId))throw new Error('Resolve this class’s conflicts before printing.');
  const resolved=activeStudents.map(s=>({...s,local:localFor(s.enrollmentId)}));if(!resolved.length||resolved.some(s=>!s.local))throw new Error('Load and reconcile every student name before printing.');
  const accepted=data.records.filter(r=>r.classId===classId&&!r.deleted),versions=[...new Set(accepted.map(r=>r.curriculumVersion))];
  if(versions.length!==1)throw new Error('Completed printing needs submitted results from one curriculum version.');
  const groups=new Map<string,typeof resolved>();for(const s of resolved){const level=findCurriculumLevel(s.local!.level);if(!level)throw new Error(`Choose a supported curriculum level for ${s.local!.name}.`);groups.set(level.id,[...(groups.get(level.id)??[]),s]);}
  const rosters:AttendancePrintItem[]=[...groups].map(([template,group])=>({template,roster:{code:group[0].local!.course.code,level:template,serviceName:group[0].local!.course.name,time:group[0].local!.course.startTime,instructor:group[0].local!.course.instructor,location:group[0].local!.course.location,schedule:course.lessonDates.join(', '),completed:{curriculumVersion:versions[0],lessonDates:course.lessonDates},students:group.map(s=>{const attendance:Record<string,'present'|'absent'|'unmarked'>={},successfulAttempts:Record<string,number>={};accepted.filter(r=>r.enrollmentId===s.enrollmentId).forEach(r=>{if(r.kind==='attendance'&&r.payload.status)attendance[r.lessonDate]=r.payload.status;if(r.kind==='attempt'&&r.success&&r.payload.skillId)successfulAttempts[r.payload.skillId]=(successfulAttempts[r.payload.skillId]??0)+1});return {name:s.local!.name,enrollmentId:s.enrollmentId,results:{attendance,successfulAttempts}}})}}));
  const popup=openAttendancePrintWindow('Completed attendance and results');if(!popup)throw new Error('Allow popups to print completed sheets.');const {printAttendanceHtml}=await import('../../shared/attendance-print/printAttendanceHtml');const result=await printAttendanceHtml({session:[session.session_season,session.session_year].filter(Boolean).join(' '),title:'Completed attendance and results',rosters},popup);if(result.status==='failed')throw result.error;if(result.status==='popup-blocked')throw new Error('Allow popups to print completed sheets.');
 }
 return <Card className="flex min-w-0 flex-col gap-4 max-sm:p-3 [overflow-wrap:anywhere]">
  <h2 className="text-2xl font-semibold">Attendance and results</h2>
  {error&&<Notice tone="danger" role="alert">{error}</Notice>}{notice&&<Notice role="status">{notice}</Notice>}{rosterWarning&&<Notice>{rosterWarning}</Notice>}
  <ActionButton disabled={busy} onClick={()=>void run(async()=>{})}>Refresh submissions</ActionButton>
  <label>Load local class package to resolve names (stays in this browser)<input type="file" accept=".json,application/json" disabled={busy||!registry} onChange={e=>{const file=e.target.files?.[0];if(file)void run(()=>importNames(file))}}/></label>
  {!registry?<p>No registered tablet identities yet. Start authenticated sharing in Device Exports.</p>:<>
   <div className="flex flex-wrap gap-3">
    <label>Class<Select value={classId} onChange={e=>{setClassId(e.target.value);setStudent('');setDate('')}}><option value="">All classes</option>{registry.courses.map(c=><option key={c.classId} value={c.classId}>{className(c)}</option>)}</Select></label>
    <label>Lesson date<Select value={date} onChange={e=>setDate(e.target.value)}><option value="">All dates</option>{course?.lessonDates.map(d=><option key={d}>{d}</option>)}</Select></label>
    <label>Student<Select value={student} onChange={e=>setStudent(e.target.value)}><option value="">All students</option>{students.map(s=><option key={s.enrollmentId} value={s.enrollmentId}>{nameFor(s.enrollmentId)}</option>)}</Select></label>
   </div>
   <ActionButton disabled={busy||!course} onClick={()=>void run(printCompleted)}>Print completed sheets</ActionButton>
   {course&&date&&activeStudents.filter(s=>!student||s.enrollmentId===student).map(s=><div key={s.enrollmentId} className="flex gap-3 items-center"><span>{nameFor(s.enrollmentId)}</span><Select aria-label={`Attendance for ${nameFor(s.enrollmentId)}`} disabled={busy} value={data?.records.find(r=>!r.deleted&&r.recordId===`attendance:${s.enrollmentId}:${date}`)?.payload.status??'unmarked'} onChange={e=>void run(()=>attendance(s.enrollmentId,e.target.value as 'present'|'absent'|'unmarked'))}><option value="unmarked">Unmarked</option><option value="present">Present</option><option value="absent">Absent</option></Select></div>)}
   {!supervisor&&!!data?.conflicts.filter(c=>!c.resolved).length&&<Notice>Some submissions need supervisor review. Accepted results remain displayed until those conflicts are resolved.</Notice>}
   <h3 className="text-xl font-semibold">Skill progress across all lesson dates</h3>
   {progress.size===0?<p>No current curriculum assessments submitted.</p>:byName([...progress],([enrollmentId])=>enrollmentId).map(([enrollmentId,skills])=><div key={enrollmentId}><h4 className="font-semibold">{nameFor(enrollmentId)}</h4><ul>{[...skills].map(([skillId,count])=><li key={skillId}>{skillName(skillId)}: {count} / 3 successful attempts</li>)}</ul></div>)}
   <h3 className="text-xl font-semibold">Submitted records and revision history</h3>
   {records.length===0&&<p>No submissions for these filters.</p>}
   {records.map(r=><article key={r.recordId} className="border border-secondary/20 rounded p-3"><p><strong>{nameFor(r.enrollmentId)}</strong> · {r.lessonDate} · revision {r.revision}{r.deleted?' · deleted':''}</p><RecordValue value={r}/>{r.kind==='attempt'&&!r.deleted&&<AttemptEditor record={r} busy={busy} onSave={payload=>void run(()=>correction(r,payload))}/>}<ActionButton disabled={busy||r.deleted} onClick={()=>void run(()=>correction(r,{},'delete'))}>Delete record with audit history</ActionButton><details><summary>Revision history</summary>{data?.history.filter(h=>h.recordId===r.recordId).map(h=><div key={h.revision}><p>Revision {h.revision} · {h.record.lessonDate}</p><RecordValue value={h.record}/></div>)}</details></article>)}
   {supervisor&&<>
    <h3 className="text-xl font-semibold">Identity reconciliation</h3><p>Unchanged entries recover automatically. Confirm spelling or contact changes. A transfer creates a new enrollment in its destination class; earlier results stay in the original class.</p>
    {identities.filter(i=>!i.enrollmentId).map((i,index)=><div key={`${i.matchKey}:${index}`} className="border p-3"><p>{i.course.code}: {i.name} — unresolved</p>{i.ambiguous?<p>Indistinguishable duplicate. Correct the source roster before reconciling.</p>:<><Select aria-label={`Identity for ${i.name}`} value={choices[i.matchKey]??''} onChange={e=>setChoices({...choices,[i.matchKey]:e.target.value})}><option value="">Choose identity</option><option value="new">New student or transfer: new enrollment</option>{registry.courses.find(c=>c.sourceId===courseSourceId(session.id,i.course.code))?.swimmers.map(s=><option key={s.enrollmentId} value={s.enrollmentId}>Same student: {nameFor(s.enrollmentId)} [{s.sourceId.slice(0,8)}]</option>)}</Select><ActionButton disabled={busy} onClick={()=>void run(()=>reconcile(i))}>Confirm reconciliation</ActionButton></>}</div>)}
    <h3 className="text-xl font-semibold">Conflicts requiring review</h3>
    {data?.conflicts.filter(c=>!c.resolved&&(!classId||c.operation.classId===classId)).map(c=><article key={c.id} className="border p-3"><p>{nameFor(c.operation.enrollmentId)} · {c.operation.lessonDate}</p><div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><div><h4>Current accepted</h4><RecordValue value={c.current}/><ActionButton disabled={busy} onClick={()=>void run(async()=>{await api.resolveResultConflict(session.id,c.id,'current',c.current?.revision??0)})}>Keep current</ActionButton></div><div><h4>Incoming submission</h4><RecordValue value={c.operation}/><ActionButton disabled={busy} onClick={()=>void run(async()=>{await api.resolveResultConflict(session.id,c.id,'incoming',c.current?.revision??0)})}>Accept incoming</ActionButton></div></div></article>)}
    <h3 className="text-xl font-semibold">Tablet access grants</h3>{grants.map(g=><div key={g.id}><span>{session.instructors.find(i=>i.id===g.instructorId)?.name??g.instructorId} · expires {g.expiresAt} · {g.revoked?'Revoked':'Active'}</span><ActionButton disabled={busy||g.revoked} onClick={()=>void run(async()=>{await api.revokeResultGrant(session.id,g.id)})}>Revoke access</ActionButton></div>)}
   </>}
  </>}
 </Card>;
}

import {acceptedProgress} from './progress';
import {useEffect,useMemo,useRef,useState} from 'react';
import {Card,PageShell,ActionButton,Notice,Select} from '../../general-components';
import {useCurrentSession,type SessionRecord} from '../../app/useCurrentSession';
import {useAuth} from '../../app/AuthContext';
import {useInstructorSession} from '../instructor/session/InstructorSessionContext';
import * as api from '../../lib/resultsApi';
import {getScopedKey} from '../../lib/storageScope';
import {loadExportCourses} from '../decksupervisor/DeviceExport/services/loadExportCourses';
import {loadRegistry,saveRegistry} from '../decksupervisor/DeviceExport/services/exportStorage';
import {newRegistry,type ExportCourse} from '../decksupervisor/DeviceExport/services/exportPackage';
import {recoverRegistry,courseSourceId} from '../decksupervisor/DeviceExport/services/resultRegistry';
import {resolveLocalIdentities,bindLocalAlias,localNamesFromPackage,type LocalIdentity} from './identity';
import {openAttendancePrintWindow} from '../../shared/attendance-print/openAttendancePrintWindow';
import {COMPLETED_PRINT_CURRICULUM_VERSION} from '../../shared/attendance-print/completedAttendance';
import type {AttendancePrintItem} from '../../shared/attendance-print/types';
import {compareStudentNames} from '../decksupervisor/Rosters/utils';
import {inputClass,selectClass} from '../decksupervisor/Rosters/constants';
import {buildBatch,buildCompletedBatch,buildCompletedClass,buildReportCardClass,type CompletedClassInput,type PrintBatch} from './completedPrint';
import {buildReportCardHtml,printReportCards,type ReportCardPaper} from '../../shared/report-cards/reportCards';
import {RecordValue,StudentProgressModal} from './StudentProgressModal';
import {ResultsClassCard,type ClassCardSwimmer} from './ResultsClassCard';
const errorMessage=(e:unknown)=>e instanceof Error?e.message:String(e);
const V=COMPLETED_PRINT_CURRICULUM_VERSION;
// A whole-session snapshot grows with every record and revision and outgrows the database's
// statement time limit within one term. Per-class snapshots stay small: fetch a few at a time and merge.
async function resultsByClass(sessionId:string,classIds:string[],concurrency=4):Promise<api.Results>{
 const parts:api.Results[]=new Array(classIds.length);let next=0;
 const worker=async()=>{while(next<classIds.length){const i=next++;parts[i]=await api.fetchResults(sessionId,classIds[i]);}};
 await Promise.all(Array.from({length:Math.min(concurrency,classIds.length)},worker));
 return {schemaVersion:1,records:parts.flatMap(p=>p.records),conflicts:parts.flatMap(p=>p.conflicts),history:parts.flatMap(p=>p.history)};
}
export function SupervisorResults(){
 const {session,loading}=useCurrentSession();const {isGuest,user}=useAuth();
 return <PageShell>{isGuest?<Notice>Guest packages are import-only. Sign in to review submitted results.</Notice>:loading?<p>Loading session…</p>:session?<ResultsView key={`${user?.id}:${session.id}`} session={session} supervisor/>:<p>Select a session to view results.</p>}</PageShell>;
}
export function InstructorResults(){
 const {session,sessionId,loading}=useInstructorSession();const {user}=useAuth();
 return <PageShell>{loading?<p>Loading session…</p>:session?<ResultsView key={`${user?.id}:${sessionId}`} session={{...session,team_id:null,created_by:'',source_locations:[],instructors:[],session_start_time24:session.session_start_time24??null,session_end_time24:session.session_end_time24??null}}/>:<p>Select an instructor session to view attendance and results.</p>}</PageShell>;
}
type ClassView={course:api.ResultCourse;info?:ExportCourse;code:string;title:string;serviceName:string;instructor:string};
export function ResultsView({session,supervisor=false}:{session:SessionRecord;supervisor?:boolean}){
 const [registry,setRegistry]=useState<api.ResultRegistry|null>(null),[data,setData]=useState<api.Results|null>(null);
 const [identities,setIdentities]=useState<LocalIdentity[]>([]),[grants,setGrants]=useState<api.ResultGrant[]>([]);
 const [instructorFilter,setInstructorFilter]=useState(''),[serviceFilter,setServiceFilter]=useState(''),[search,setSearch]=useState('');
 const [open,setOpen]=useState<{classId:string;enrollmentId:string}|null>(null),[printReport,setPrintReport]=useState<PrintBatch<unknown>|null>(null),[paper,setPaper]=useState<ReportCardPaper>('blank');
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(true),[rosterWarning,setRosterWarning]=useState('');
 const [choices,setChoices]=useState<Record<string,string>>({});const mounted=useRef(true),working=useRef(false);
 const displayKey=()=>getScopedKey(`result-display-package:${session.id}`);
 function savedPackages():unknown[]{const text=localStorage.getItem(displayKey());if(!text)return [];const parsed:unknown=JSON.parse(text);return Array.isArray(parsed)?parsed:[parsed];}
 async function refresh(){
  const [r,g]=await Promise.all([api.fetchResultRegistry(session.id),supervisor?api.fetchResultGrants(session.id):Promise.resolve({grants:[]})]);
  if(mounted.current){setRegistry(r);setGrants(g.grants);}
  // Results only exist for registered classes, so load them class by class (see resultsByClass).
  const d=r?await resultsByClass(session.id,[...new Set(r.courses.map(c=>c.classId))]):{schemaVersion:1 as const,records:[],conflicts:[],history:[]};
  let resolved:LocalIdentity[]=[],warning='';
  if(r){try{const courses=await loadExportCourses(session,!supervisor);if(supervisor)await recoverRegistry(session.id,courses);resolved=await resolveLocalIdentities(session.id,courses,r)}catch(e){warning=`Load this session’s class package below to resolve names. ${errorMessage(e)}`;}
   try{const saved=savedPackages();for(const pkg of saved.reverse()){const imported=localNamesFromPackage(pkg,r);resolved=[...resolved,...imported.filter(i=>!resolved.some(j=>j.enrollmentId===i.enrollmentId))];}}catch{warning='Saved local names could not be matched. Load a current class package.';}}
  if(!mounted.current)return;setRegistry(r);setData(d);setGrants(g.grants);setIdentities(resolved);setRosterWarning(warning);
 }
 useEffect(()=>{mounted.current=true;void refresh().catch(e=>{if(mounted.current)setError(errorMessage(e))}).finally(()=>{if(mounted.current)setBusy(false)});return()=>{mounted.current=false}},[session.id]);
 // Printing changes nothing on the server, so it skips the reload that follows every other action.
 async function run(action:()=>Promise<void>,reload=true){if(working.current)return;working.current=true;setBusy(true);setError('');setNotice('');try{await action();if(reload)await refresh()}catch(e){if(mounted.current)setError(errorMessage(e));if(e instanceof api.ResultRequestError&&e.status===409)await refresh().catch(()=>{})}finally{working.current=false;if(mounted.current)setBusy(false)}}
 const localFor=(id:string)=>{const matches=identities.filter(i=>i.enrollmentId===id);return matches.length===1?matches[0]:undefined};
 const nameFor=(id:string)=>localFor(id)?.name??`Unresolved student (${id.slice(0,8)})`;
 // List swimmers in the blank-sheet order so row N is the same swimmer on blank and completed sheets.
 const byName=<T,>(items:T[],enrollmentId:(item:T)=>string)=>items.map(item=>({item,name:nameFor(enrollmentId(item))})).sort(compareStudentNames).map(({item})=>item);
 const infoBySource=useMemo(()=>{const map=new Map<string,ExportCourse>();for(const i of identities){const key=courseSourceId(session.id,i.course.code);if(!map.has(key))map.set(key,i.course);}return map;},[identities,session.id]);
 const classes:ClassView[]=(registry?.courses??[]).map(course=>{const info=infoBySource.get(course.sourceId),code=info?.code??course.sourceId.split(':course:').pop()??course.sourceId;
  return {course,info,code,serviceName:info?.name??'',title:info?`${info.name} : ${info.startTime}`:`Class ${code}`,instructor:info?.instructor||session.instructors.find(i=>i.id===course.instructorId)?.name||'Unassigned'};})
  .sort((a,b)=>(a.info?.startTime??'').localeCompare(b.info?.startTime??'')||a.code.localeCompare(b.code));
 const instructorOptions=[...new Set(classes.map(c=>c.instructor))].sort((a,b)=>a.localeCompare(b));
 const serviceOptions=[...new Set(classes.map(c=>c.serviceName).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
 const query=search.trim().toLowerCase();
 const visible=classes.filter(c=>(!instructorFilter||c.instructor===instructorFilter)&&(!serviceFilter||c.serviceName===serviceFilter)&&(!query||c.code.toLowerCase().includes(query)||c.course.swimmers.some(s=>nameFor(s.enrollmentId).toLowerCase().includes(query))));
 const records=data?.records??[];
 const recordById=useMemo(()=>new Map(records.map(r=>[r.recordId,r])),[records]);
 const progress=useMemo(()=>acceptedProgress(records,V),[records]);
 const attendanceTotals=useMemo(()=>{const map=new Map<string,{present:number;absent:number}>();for(const r of records){if(r.kind!=='attendance'||r.deleted)continue;const t=map.get(r.enrollmentId)??{present:0,absent:0};if(r.payload.status==='present')t.present++;if(r.payload.status==='absent')t.absent++;map.set(r.enrollmentId,t);}return map;},[records]);
 const historyByRecord=useMemo(()=>{const map=new Map<string,api.Results['history']>();for(const h of data?.history??[]){const list=map.get(h.recordId);if(list)list.push(h);else map.set(h.recordId,[h]);}return map;},[data]);
 const attendanceFor=(enrollmentId:string,date:string)=>{const r=recordById.get(`attendance:${enrollmentId}:${date}`);return (!r||r.deleted?'unmarked':r.payload.status??'unmarked') as 'present'|'absent'|'unmarked';};
 const swimmersFor=(c:ClassView):ClassCardSwimmer[]=>byName(c.course.swimmers,s=>s.enrollmentId).map(s=>({enrollmentId:s.enrollmentId,name:nameFor(s.enrollmentId),active:s.active!==false,present:attendanceTotals.get(s.enrollmentId)?.present??0,absent:attendanceTotals.get(s.enrollmentId)?.absent??0,mastered:[...(progress.get(s.enrollmentId)?.values()??[])].filter(n=>n>=3).length,attendance:date=>attendanceFor(s.enrollmentId,date)}));
 async function submit(operation:api.ResultOperation){const receipt=(await api.submitResult(session.id,operation)).receipts[0];if(!receipt||!['accepted','already_accepted','pending_review'].includes(receipt.status))throw new Error(receipt?.reason||'Correction rejected');setNotice(receipt.status==='pending_review'?'Correction requires supervisor review.':'Saved as a new revision.');}
 async function correction(record:api.ResultRecord,payload:api.ResultPayload,action:'upsert'|'delete'='upsert'){
  const {revision,deleted:_deleted,success:_success,updatedAt:_updatedAt,...old}=record;
  await submit({...old,operationId:crypto.randomUUID(),baseRevision:revision,action,payload});
 }
 async function attendance(course:api.ResultCourse,enrollmentId:string,date:string,status:'present'|'absent'|'unmarked'){
  if(!registry)throw new Error('Choose a class and lesson date.');
  const recordId=`attendance:${enrollmentId}:${date}`,existing=recordById.get(recordId);
  if(existing)return correction(existing,{status});
  await submit({operationId:crypto.randomUUID(),sessionId:session.id,datasetId:registry.datasetId,classId:course.classId,enrollmentId,recordId,kind:'attendance',action:'upsert',baseRevision:0,lessonDate:date,curriculumVersion:V,payload:{status}});
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
 // Instructor by instructor, each instructor's classes in time order, like the deck schedule.
 const byInstructor=(targets:ClassView[])=>[...targets].sort((a,b)=>a.instructor.localeCompare(b.instructor)||(a.info?.startTime??'').localeCompare(b.info?.startTime??'')||a.code.localeCompare(b.code));
 const completedInput=(c:ClassView,d:api.Results):CompletedClassInput&{label:string}=>({course:c.course,data:d,label:`${c.code} ${c.title} (${c.instructor})`,swimmers:byName(c.course.swimmers.filter(s=>s.active!==false),s=>s.enrollmentId).map(s=>({enrollmentId:s.enrollmentId,local:localFor(s.enrollmentId)}))});
 /** One class prints or explains why not; several classes print every ready class and list the rest. */
 async function printCompleted(targets:ClassView[],title:string,batchJob=true){
  setPrintReport(null);
  if(!registry||!data)throw new Error('Choose a registered class.');
  let rosters:AttendancePrintItem[];
  if(!batchJob)rosters=buildCompletedClass(completedInput(targets[0],data));
  else{
   const batch=buildCompletedBatch(byInstructor(targets).map(c=>completedInput(c,data)));setPrintReport(batch);
   if(!batch.items.length)throw new Error('None of these classes can print yet. The reasons are listed below.');
   rosters=batch.items;
  }
  const popup=openAttendancePrintWindow(title);if(!popup)throw new Error('Allow popups to print completed sheets.');
  const {printAttendanceHtml}=await import('../../shared/attendance-print/printAttendanceHtml');
  const result=await printAttendanceHtml({session:[session.session_season,session.session_year].filter(Boolean).join(' '),title,rosters},popup);
  if(result.status==='failed')throw result.error;if(result.status==='popup-blocked')throw new Error('Allow popups to print completed sheets.');
 }
 const sessionLabel=[session.session_season,session.session_year].filter(Boolean).join(' ');
 /** Report cards follow the same rules as completed sheets; `only` prints one swimmer's card from the progress popup. */
 async function printCards(targets:ClassView[],title:string,batchJob:boolean,only?:string){
  setPrintReport(null);
  if(!registry||!data)throw new Error('Choose a registered class.');
  const input=(c:ClassView)=>{const base=completedInput(c,data);return {...base,session:sessionLabel,curriculumVersion:V,swimmers:only?base.swimmers.filter(s=>s.enrollmentId===only):base.swimmers};};
  let cards;
  if(!batchJob)cards=buildReportCardClass(input(targets[0]));
  else{const batch=buildBatch(byInstructor(targets).map(input),buildReportCardClass);setPrintReport(batch);if(!batch.items.length)throw new Error('None of these classes can print yet. The reasons are listed below.');cards=batch.items;}
  const popup=openAttendancePrintWindow(title);if(!popup)throw new Error('Allow popups to print report cards.');
  await printReportCards(buildReportCardHtml(cards,{paper,imageBase:`${window.location.origin}/report-cards/`,title}),popup);
 }
 const openClass=open?classes.find(c=>c.course.classId===open.classId):undefined;
 const openSwimmer=openClass?.course.swimmers.find(s=>s.enrollmentId===open?.enrollmentId);
 const unresolvedConflicts=(data?.conflicts??[]).filter(c=>!c.resolved);
 const codeFor=(classId:string)=>classes.find(c=>c.course.classId===classId)?.code??classId;
 return <Card className="flex min-w-0 flex-col gap-4 max-sm:p-3 [overflow-wrap:anywhere]">
  <h2 className="text-2xl font-semibold">Attendance and results</h2>
  {!open&&error&&<Notice tone="danger" role="alert">{error}</Notice>}{!open&&notice&&<Notice role="status">{notice}</Notice>}{rosterWarning&&<Notice>{rosterWarning}</Notice>}
  <div className="flex flex-wrap items-end gap-3">
   <ActionButton disabled={busy} onClick={()=>void run(async()=>{})}>Refresh submissions</ActionButton>
   <label className="flex min-w-0 flex-col gap-1 text-sm font-semibold">Load local class package to resolve names (stays in this browser)<input type="file" accept=".json,application/json" disabled={busy||!registry} onChange={e=>{const file=e.target.files?.[0];if(file)void run(()=>importNames(file))}}/></label>
  </div>
  {!registry?<p>{busy?'Loading classes…':'No registered tablet identities yet. Start authenticated sharing in Device Exports.'}</p>:<>
   <div data-component="results-filters-bar" className="grid min-w-0 gap-4 rounded-card border-2 border-secondary/20 bg-accent p-4 text-secondary shadow-md md:grid-cols-3 md:p-6">
    <label className="flex min-w-0 flex-col gap-2 text-sm font-semibold">Instructor<select className={selectClass} value={instructorFilter} onChange={e=>setInstructorFilter(e.target.value)}><option value="">All instructors</option>{instructorOptions.map(i=><option key={i} value={i}>{i}</option>)}</select></label>
    <label className="flex min-w-0 flex-col gap-2 text-sm font-semibold">Service name<select className={selectClass} value={serviceFilter} onChange={e=>setServiceFilter(e.target.value)}><option value="">All services</option>{serviceOptions.map(s=><option key={s} value={s}>{s}</option>)}</select></label>
    <label className="flex min-w-0 flex-col gap-2 text-sm font-semibold">Search<input className={inputClass} type="search" placeholder="Student or course code" value={search} onChange={e=>setSearch(e.target.value)}/></label>
   </div>
   <div data-component="results-print-bar" className="flex flex-wrap items-center gap-3">
    {instructorFilter&&<ActionButton variant="primary" disabled={busy||!data} onClick={()=>void run(()=>printCompleted(classes.filter(c=>c.instructor===instructorFilter),`Completed sheets – ${instructorFilter}`),false)}>Print completed sheets for {instructorFilter}</ActionButton>}
    <ActionButton variant={instructorFilter?'outline':'primary'} disabled={busy||!data||!classes.length} onClick={()=>void run(()=>printCompleted(classes,'Completed sheets – all instructors'),false)}>Print all instructors</ActionButton>
    <span className="text-sm text-secondary/80">Showing {visible.length} of {classes.length} classes</span>
   </div>
   <div data-component="results-report-card-bar" className="flex flex-wrap items-end gap-3">
    {instructorFilter&&<ActionButton variant="outline" disabled={busy||!data} onClick={()=>void run(()=>printCards(classes.filter(c=>c.instructor===instructorFilter),`Report cards – ${instructorFilter}`,true),false)}>Print report cards for {instructorFilter}</ActionButton>}
    <ActionButton variant="outline" disabled={busy||!data||!classes.length} onClick={()=>void run(()=>printCards(classes,'Report cards – all instructors',true),false)}>Print all report cards</ActionButton>
    <label className="flex flex-col gap-1 text-sm font-semibold">Report card paper<select className={selectClass} value={paper} onChange={e=>setPaper(e.target.value as ReportCardPaper)}><option value="blank">Blank paper (prints the whole card)</option><option value="preprinted">Pre-printed cards (ticks and names only)</option></select></label>
   </div>
   {printReport&&<Notice tone={printReport.skipped.length?'danger':undefined}><p className="font-semibold">Printed {printReport.printed.length} of {printReport.printed.length+printReport.skipped.length} classes.</p>{printReport.skipped.length>0&&<><p>Not printed:</p><ul className="list-disc pl-5">{printReport.skipped.map(s=><li key={s.label}>{s.label}: {s.reason}</li>)}</ul></>}</Notice>}
   {!supervisor&&unresolvedConflicts.length>0&&<Notice>Some submissions need supervisor review. Accepted results remain displayed until those conflicts are resolved.</Notice>}
   <div data-component="results-class-list" className="flex flex-col gap-6">
    {visible.length===0&&<p>No classes match these filters.</p>}
    {visible.map(c=><ResultsClassCard key={c.course.classId} classId={c.course.classId} code={c.code} title={c.title} instructor={c.instructor} lessonDates={c.course.lessonDates} swimmers={swimmersFor(c)} busy={busy||!data}
     onPrint={()=>void run(()=>printCompleted([c],`Completed sheet – ${c.code}`,false),false)} onPrintReportCards={()=>void run(()=>printCards([c],`Report cards – ${c.code}`,false),false)} onOpen={enrollmentId=>{setError('');setNotice('');setOpen({classId:c.course.classId,enrollmentId})}}
     onAttendance={(enrollmentId,date,status)=>void run(()=>attendance(c.course,enrollmentId,date,status))}/>)}
   </div>
   {openClass&&openSwimmer&&open&&<StudentProgressModal name={nameFor(open.enrollmentId)} details={`${openClass.title} · ${openClass.code} · Instructor: ${openClass.instructor}`} active={openSwimmer.active!==false} lessonDates={openClass.course.lessonDates}
    progress={progress.get(open.enrollmentId)} records={records.filter(r=>r.enrollmentId===open.enrollmentId)} history={historyByRecord} busy={busy} error={error} notice={notice}
    onClose={()=>setOpen(null)} onPrintReportCard={()=>void run(()=>printCards([openClass],`Report card – ${nameFor(open.enrollmentId)}`,false,open.enrollmentId),false)} onCorrect={(r,payload)=>void run(()=>correction(r,payload))} onDelete={r=>void run(()=>correction(r,{},'delete'))}/>}
   {supervisor&&<>
    <h3 className="text-xl font-semibold">Identity reconciliation</h3><p>Unchanged entries recover automatically. Confirm spelling or contact changes. A transfer creates a new enrollment in its destination class; earlier results stay in the original class.</p>
    {identities.filter(i=>!i.enrollmentId).map((i,index)=><div key={`${i.matchKey}:${index}`} className="border p-3"><p>{i.course.code}: {i.name} — unresolved</p>{i.ambiguous?<p>Indistinguishable duplicate. Correct the source roster before reconciling.</p>:<><Select aria-label={`Identity for ${i.name}`} value={choices[i.matchKey]??''} onChange={e=>setChoices({...choices,[i.matchKey]:e.target.value})}><option value="">Choose identity</option><option value="new">New student or transfer: new enrollment</option>{registry.courses.find(c=>c.sourceId===courseSourceId(session.id,i.course.code))?.swimmers.map(s=><option key={s.enrollmentId} value={s.enrollmentId}>Same student: {nameFor(s.enrollmentId)} [{s.sourceId.slice(0,8)}]</option>)}</Select><ActionButton disabled={busy} onClick={()=>void run(()=>reconcile(i))}>Confirm reconciliation</ActionButton></>}</div>)}
    <h3 className="text-xl font-semibold">Conflicts requiring review</h3>
    {unresolvedConflicts.length===0&&<p>No conflicts to review.</p>}
    {unresolvedConflicts.map(c=><article key={c.id} className="rounded-2xl border-2 border-secondary/20 p-3"><p>{codeFor(c.operation.classId)} · {nameFor(c.operation.enrollmentId)} · {c.operation.lessonDate}</p><div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><div><h4>Current accepted</h4><RecordValue value={c.current}/><ActionButton disabled={busy} onClick={()=>void run(async()=>{await api.resolveResultConflict(session.id,c.id,'current',c.current?.revision??0)})}>Keep current</ActionButton></div><div><h4>Incoming submission</h4><RecordValue value={c.operation}/><ActionButton disabled={busy} onClick={()=>void run(async()=>{await api.resolveResultConflict(session.id,c.id,'incoming',c.current?.revision??0)})}>Accept incoming</ActionButton></div></div></article>)}
    <h3 className="text-xl font-semibold">Tablet access grants</h3>{grants.map(g=><div key={g.id}><span>{session.instructors.find(i=>i.id===g.instructorId)?.name??g.instructorId} · expires {g.expiresAt} · {g.revoked?'Revoked':'Active'}</span><ActionButton disabled={busy||g.revoked} onClick={()=>void run(async()=>{await api.revokeResultGrant(session.id,g.id)})}>Revoke access</ActionButton></div>)}
   </>}
  </>}
 </Card>;
}

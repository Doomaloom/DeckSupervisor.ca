import {useEffect,useState} from 'react';
import {ActionButton,ModalShell,Select,TextInput} from '../../general-components';
import type * as api from '../../lib/resultsApi';
import {criterionNameFor,skillNameFor} from './translate';

/** Labels come from the curriculum version the record was saved in (the current one when no version is given). */
export const skillName=(id?:string,version?:string)=>id?skillNameFor(version,id):'Unknown skill';
const criterionName=(id:string,version?:string)=>criterionNameFor(version,id);
const attendanceLabel={present:'Present',absent:'Absent',unmarked:'Unmarked'} as const;

export function RecordValue({value}:{value:api.ResultOperation|null}){
 if(!value)return <p>No accepted record</p>;
 if(value.action==='delete')return <p>Deleted</p>;
 return value.kind==='attendance'?<p>Attendance: {value.payload.status}</p>:<div><p>{skillName(value.payload.skillId,value.curriculumVersion)}</p><ul>{value.payload.results?.map(c=><li key={c.subskillId}>{criterionName(c.subskillId,value.curriculumVersion)}: {c.status==='successful'?'Successful':'Not yet'}</li>)}</ul>{value.payload.timed&&<p>{value.payload.timed.lapsCompleted} of {value.payload.timed.lapsRequired} laps in {(Math.floor(value.payload.timed.elapsedMs/100)/10).toFixed(1)} seconds</p>}</div>;
}
function AttemptEditor({record,busy,onSave}:{record:api.ResultRecord;busy:boolean;onSave:(payload:api.ResultPayload)=>void}){
 const [payload,setPayload]=useState(record.payload);
 useEffect(()=>setPayload(record.payload),[record.revision]);
 return <details><summary className="cursor-pointer font-semibold">Correct submitted assessment</summary><div className="flex flex-col gap-3 p-3">{payload.results?.map(c=><label key={c.subskillId}>{criterionName(c.subskillId,record.curriculumVersion)}<Select disabled={busy} value={c.status} onChange={e=>setPayload({...payload,results:payload.results!.map(item=>item===c?{...item,status:e.target.value as 'successful'|'not_yet'}:item)})}><option value="successful">Successful</option><option value="not_yet">Not yet</option></Select></label>)}{payload.timed&&(['lapsRequired','lapsCompleted','elapsedMs'] as const).map(field=><label key={field}>{field==='elapsedMs'?'Elapsed milliseconds':field==='lapsRequired'?'Laps required':'Laps completed'}<TextInput type="number" min="0" step="1" value={payload.timed![field]} onChange={e=>setPayload({...payload,timed:{...payload.timed!,[field]:Number(e.target.value)}})}/></label>)}<ActionButton disabled={busy} onClick={()=>onSave(payload)}>Save correction as a new revision</ActionButton></div></details>;
}
function Meter({count}:{count:number}){
 return <span aria-hidden="true" className="inline-flex gap-1">{[0,1,2].map(i=><span key={i} className={`h-3 w-3 rounded-full border-2 border-secondary ${i<count?'bg-primary':'bg-bg'}`}/>)}</span>;
}

export type StudentProgressModalProps={
 name:string;details:string;active:boolean;lessonDates:string[];
 progress:Map<string,number>|undefined;records:api.ResultRecord[];history:Map<string,api.Results['history']>;
 busy:boolean;error?:string;notice?:string;
 onClose:()=>void;onPrintReportCard?:()=>void;onCorrect:(record:api.ResultRecord,payload:api.ResultPayload)=>void;onDelete:(record:api.ResultRecord)=>void;
};
/** One swimmer's skill progress, attendance and submitted records, opened from a class card. */
export function StudentProgressModal({name,details,active,lessonDates,progress,records,history,busy,error,notice,onClose,onPrintReportCard,onCorrect,onDelete}:StudentProgressModalProps){
 const [date,setDate]=useState('');
 useEffect(()=>{const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose()};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey)},[onClose]);
 const attendance=new Map(records.filter(r=>r.kind==='attendance'&&!r.deleted).map(r=>[r.lessonDate,r.payload.status??'unmarked']));
 const shown=records.filter(r=>!date||r.lessonDate===date).sort((a,b)=>b.lessonDate.localeCompare(a.lessonDate)||a.recordId.localeCompare(b.recordId));
 const skills=[...(progress??[])].sort(([a],[b])=>skillName(a).localeCompare(skillName(b)));
 const present=[...attendance.values()].filter(s=>s==='present').length;
 return <ModalShell title={name} description={details} onClose={onClose} closeLabel="Close skill progress" panelClassName="max-h-[90vh] overflow-y-auto max-sm:p-4 [overflow-wrap:anywhere]"
  notice={<>{error&&<p role="alert" className="rounded-card border-2 border-danger/30 bg-danger/10 p-3 text-sm font-semibold text-danger">{error}</p>}{notice&&<p role="status" className="rounded-card border-2 border-secondary/20 bg-bg p-3 text-sm font-semibold">{notice}</p>}{!active&&<p className="text-sm">This enrollment is no longer active in this class. Earlier results stay here.</p>}</>}>
  {onPrintReportCard&&<div className="mt-4"><ActionButton variant="primary" disabled={busy} onClick={onPrintReportCard}>Print report card</ActionButton></div>}
  <section aria-labelledby="student-progress-skills" className="mt-6">
   <h4 id="student-progress-skills" className="text-lg font-semibold">Skill progress</h4>
   {skills.length===0?<p>No current curriculum assessments submitted.</p>:<ul className="mt-2 divide-y divide-secondary/15 border-y border-secondary/15">{skills.map(([skillId,count])=><li key={skillId} className="flex items-center justify-between gap-3 py-2"><span>{skillName(skillId)}: {count} / 3 successful attempts</span><Meter count={count}/></li>)}</ul>}
  </section>
  <section aria-labelledby="student-progress-attendance" className="mt-6">
   <h4 id="student-progress-attendance" className="text-lg font-semibold">Attendance · present {present} of {lessonDates.length}</h4>
   <ul className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-2">{lessonDates.map(d=>{const s=attendance.get(d)??'unmarked';return <li key={d} className={`rounded-2xl border-2 px-3 py-1 text-sm ${s==='present'?'border-secondary bg-bg':s==='absent'?'border-danger/40 bg-danger/10':'border-secondary/20'}`}>{d}: {attendanceLabel[s]}</li>})}</ul>
  </section>
  <section aria-labelledby="student-progress-records" className="mt-6 flex flex-col gap-3">
   <h4 id="student-progress-records" className="text-lg font-semibold">Submitted records and revision history</h4>
   <label className="flex max-w-xs flex-col gap-1 text-sm font-semibold">Show lesson date<Select value={date} onChange={e=>setDate(e.target.value)}><option value="">All dates</option>{lessonDates.map(d=><option key={d}>{d}</option>)}</Select></label>
   {shown.length===0&&<p>No submissions for these filters.</p>}
   {shown.map(r=><article key={r.recordId} className="rounded-2xl border-2 border-secondary/20 p-3"><p><strong>{r.lessonDate}</strong> · revision {r.revision}{r.deleted?' · deleted':''}</p><RecordValue value={r}/>{r.kind==='attempt'&&!r.deleted&&<AttemptEditor record={r} busy={busy} onSave={payload=>onCorrect(r,payload)}/>}<ActionButton className="mt-2" variant="outline" size="sm" disabled={busy||r.deleted} onClick={()=>onDelete(r)}>Delete record with audit history</ActionButton><details><summary className="cursor-pointer">Revision history</summary>{history.get(r.recordId)?.map(h=><div key={h.revision}><p>Revision {h.revision} · {h.record.lessonDate}</p><RecordValue value={h.record}/></div>)}</details></article>)}
  </section>
 </ModalShell>;
}

import {useState} from 'react';
import {ChartBarIcon,PrinterIcon} from '@heroicons/react/24/outline';
import {selectClass} from '../decksupervisor/Rosters/constants';

export type ClassCardSwimmer={enrollmentId:string;name:string;active:boolean;present:number;absent:number;mastered:number;attendance:(date:string)=>'present'|'absent'|'unmarked'};
export type ResultsClassCardProps={
 classId:string;code:string;title:string;instructor:string;lessonDates:string[];swimmers:ClassCardSwimmer[];busy:boolean;
 onPrint:()=>void;onOpen:(enrollmentId:string)=>void;onAttendance:(enrollmentId:string,date:string,status:'present'|'absent'|'unmarked')=>void;
};
const printButtonClass='inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1 text-white transition hover:-translate-y-0.5 hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0';
const progressButtonClass='inline-flex min-h-9 items-center gap-1 rounded-lg border-2 border-secondary px-3 py-1 text-sm font-semibold text-secondary transition hover:-translate-y-0.5 hover:bg-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

/** A registered class laid out like a Rosters card: print, instructor, then each swimmer with a progress button. */
export function ResultsClassCard({classId,code,title,instructor,lessonDates,swimmers,busy,onPrint,onOpen,onAttendance}:ResultsClassCardProps){
 const [date,setDate]=useState('');
 const active=swimmers.filter(s=>s.active),inactive=swimmers.filter(s=>!s.active);
 const row=(s:ClassCardSwimmer)=><li key={s.enrollmentId} data-component="results-student-row" className="grid grid-cols-1 items-center gap-2 py-2 sm:grid-cols-[1fr_auto]">
  <div className="min-w-0"><strong className="text-base text-text">{s.name}</strong><p className="text-xs text-secondary/80">Present {s.present} · Absent {s.absent} · {s.mastered} {s.mastered===1?'skill':'skills'} at 3 / 3</p></div>
  <div className="flex flex-wrap items-center gap-2">
   {date&&s.active&&<select aria-label={`Attendance for ${s.name}`} className={`${selectClass} w-auto`} disabled={busy} value={s.attendance(date)} onChange={e=>onAttendance(s.enrollmentId,date,e.target.value as 'present'|'absent'|'unmarked')}><option value="unmarked">Unmarked</option><option value="present">Present</option><option value="absent">Absent</option></select>}
   <button type="button" className={progressButtonClass} aria-label={`Open skill progress for ${s.name}`} onClick={()=>onOpen(s.enrollmentId)}><ChartBarIcon aria-hidden="true" className="h-4 w-4"/>Progress</button>
  </div>
 </li>;
 return <section id={`results-class-${code}`} data-component="results-class-card" data-class-id={classId} aria-label={`${title} (${code})`} className="rounded-2xl border-2 border-secondary/20 bg-accent p-4 text-secondary shadow-md md:p-6">
  <div className="flex flex-wrap items-center justify-between gap-3">
   <h3 className="text-lg font-semibold text-secondary">{title} <span className="ml-1 inline-block rounded-full bg-bg px-2 py-0.5 align-middle text-xs font-medium">{code}</span></h3>
   <button type="button" className={printButtonClass} disabled={busy} aria-label={`Print completed sheet for ${code}`} onClick={onPrint}><PrinterIcon aria-hidden="true" className="h-4 w-4"/>Print</button>
  </div>
  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
   <p className="rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-sm">Instructor: {instructor}</p>
   <label className="flex flex-col gap-1 text-sm font-semibold">Mark attendance for<select aria-label={`Lesson date for ${code}`} className={selectClass} value={date} onChange={e=>setDate(e.target.value)}><option value="">Choose a lesson date</option>{lessonDates.map(d=><option key={d}>{d}</option>)}</select></label>
  </div>
  <h4 className="mt-4 text-sm font-semibold">Swimmers ({active.length})</h4>
  {active.length===0?<p className="text-sm">No active swimmers.</p>:<ul className="mt-1 divide-y divide-secondary/15 border-y border-secondary/15">{active.map(row)}</ul>}
  {inactive.length>0&&<><h4 className="mt-4 text-sm font-semibold">No longer in this class ({inactive.length})</h4><ul className="mt-1 divide-y divide-secondary/15 border-y border-secondary/15">{inactive.map(row)}</ul></>}
 </section>;
}

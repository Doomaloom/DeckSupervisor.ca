import {useEffect,useState} from 'react';
import {ActionButton,ModalShell} from '../../general-components';
import type {FixDirection,FixPlan,Oddity} from './oddities';

export type OdditySwimmerGroup={enrollmentId:string;name:string;oddities:Oddity[]};
export type OdditiesClassGroup={classId:string;code:string;title:string;swimmers:OdditySwimmerGroup[]};
export type OdditiesInstructorGroup={instructor:string;classes:OdditiesClassGroup[]};
export type ReportCardOdditiesModalProps={
 groups:OdditiesInstructorGroup[];ignored:Set<string>;busy:boolean;error?:string;notice?:string;
 planFix:(oddity:Oddity,direction:FixDirection)=>FixPlan;
 onApply:(plan:FixPlan)=>void;onIgnore:(id:string)=>void;onRestore:(id:string)=>void;
 onOpenProgress:(classId:string,enrollmentId:string)=>void;onClose:()=>void;
};
const markWord=(ticked:boolean)=>ticked?'Ticked':'Not ticked';
/** Supervisor review of report card oddities: same-wording must-sees that are ticked for one skill but not another. */
export function ReportCardOdditiesModal({groups,ignored,busy,error,notice,planFix,onApply,onIgnore,onRestore,onOpenProgress,onClose}:ReportCardOdditiesModalProps){
 const [showIgnored,setShowIgnored]=useState(false),[preview,setPreview]=useState<{id:string;plan:FixPlan}|null>(null);
 useEffect(()=>{const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose()};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey)},[onClose]);
 const ignoredCount=groups.flatMap(g=>g.classes.flatMap(c=>c.swimmers.flatMap(s=>s.oddities))).filter(o=>ignored.has(o.id)).length;
 const shown=(items:Oddity[])=>items.filter(o=>showIgnored||!ignored.has(o.id));
 const visibleGroups=groups.map(g=>({...g,classes:g.classes.map(c=>({...c,swimmers:c.swimmers.map(s=>({...s,oddities:shown(s.oddities)})).filter(s=>s.oddities.length)})).filter(c=>c.swimmers.length)})).filter(g=>g.classes.length);
 const btn='max-sm:w-full';
 return <ModalShell title="Report card oddities" description="Matching must-sees should agree on each report card. Tick or untick them everywhere, ignore the ones that are correct, or open the swimmer's progress." onClose={onClose} closeLabel="Close report card oddities" panelClassName="max-h-[90vh] overflow-y-auto max-sm:p-4 [overflow-wrap:anywhere]"
  notice={<>{error&&<p role="alert" className="rounded-card border-2 border-danger/30 bg-danger/10 p-3 text-sm font-semibold text-danger">{error}</p>}{notice&&<p role="status" className="rounded-card border-2 border-secondary/20 bg-bg p-3 text-sm font-semibold">{notice}</p>}</>}>
  <div className="mt-4 flex flex-wrap items-center gap-3">
   <ActionButton variant="outline" size="sm" aria-pressed={showIgnored} onClick={()=>setShowIgnored(v=>!v)}>{showIgnored?'Hide':'Show'} ignored ({ignoredCount})</ActionButton>
  </div>
  {visibleGroups.length===0&&<p className="mt-4">No oddities found. Every matching must-see agrees on each report card.</p>}
  {visibleGroups.map(g=><section key={g.instructor} className="mt-6" aria-label={`Instructor ${g.instructor}`}>
   <h4 className="text-xl font-semibold">{g.instructor}</h4>
   {g.classes.map(c=><div key={c.classId} className="mt-3">
    <h5 className="text-lg font-semibold">{c.code} {c.title}</h5>
    {c.swimmers.map(s=><div key={s.enrollmentId} className="mt-2">
     <h6 className="font-semibold">{s.name}</h6>
     <ul className="mt-1 flex flex-col gap-3">{s.oddities.map(o=>{const isIgnored=ignored.has(o.id),active=preview?.id===o.id?preview.plan:null;
      return <li key={o.id} className={`rounded-2xl border-2 p-3 ${isIgnored?'border-secondary/10 bg-bg/50 opacity-80':'border-secondary/20'}`}>
       <p className="font-semibold">{o.label}{isIgnored&&<span className="ml-2 text-sm font-normal">(ignored)</span>}</p>
       <ul className="mt-1 list-disc pl-5 text-sm">{o.criteria.map(k=><li key={k.criterionId}>{k.skillName}: {markWord(k.ticked)} · {k.successfulMarks<3?`${k.successfulMarks} of 3 marks`:`${k.successfulMarks} marks`}{k.skillComplete&&' · skill complete'}</li>)}</ul>
       <div className="mt-2 flex flex-wrap gap-2">
        {isIgnored?<ActionButton className={btn} variant="outline" size="sm" disabled={busy} aria-label={`Restore ${o.label} for ${s.name}`} onClick={()=>onRestore(o.id)}>Restore</ActionButton>:<>
         <ActionButton className={btn} variant="outline" size="sm" disabled={busy} aria-label={`Tick ${o.label} everywhere for ${s.name}`} onClick={()=>setPreview({id:o.id,plan:planFix(o,'tick')})}>Tick everywhere</ActionButton>
         <ActionButton className={btn} variant="outline" size="sm" disabled={busy} aria-label={`Untick ${o.label} everywhere for ${s.name}`} onClick={()=>setPreview({id:o.id,plan:planFix(o,'untick')})}>Untick everywhere</ActionButton>
         <ActionButton className={btn} variant="outline" size="sm" disabled={busy} aria-label={`Ignore ${o.label} for ${s.name}`} onClick={()=>onIgnore(o.id)}>Ignore</ActionButton></>}
        <ActionButton className={btn} variant="outline" size="sm" disabled={busy} aria-label={`Open skill progress for ${s.name}`} onClick={()=>onOpenProgress(c.classId,s.enrollmentId)}>Open progress</ActionButton>
       </div>
       {active&&!isIgnored&&<div role="group" aria-label={`${active.direction==='tick'?'Tick':'Untick'} preview for ${o.label}, ${s.name}`} className="mt-3 rounded-card border-2 border-secondary/20 bg-bg p-3 text-sm">
        <p className="font-semibold">{active.direction==='tick'?'Tick':'Untick'} {o.label} everywhere</p>
        {active.changes.length>0&&<ul className="mt-1 list-disc pl-5">{active.changes.map((x,i)=><li key={i}>{x}</li>)}</ul>}
        {active.warnings.length>0&&<ul className="mt-2 flex flex-col gap-1">{active.warnings.map((x,i)=><li key={i} role="note" className="rounded-card border-2 border-danger/30 bg-danger/10 p-2 font-semibold text-danger">{x}</li>)}</ul>}
        <div className="mt-3 flex flex-wrap gap-2">
         <ActionButton className={btn} variant="primary" size="sm" disabled={busy||!active.possible} onClick={()=>{onApply(active);setPreview(null)}}>Apply fix</ActionButton>
         <ActionButton className={btn} variant="outline" size="sm" onClick={()=>setPreview(null)}>Cancel</ActionButton>
        </div>
       </div>}
      </li>})}</ul>
    </div>)}
   </div>)}
  </section>)}
 </ModalShell>;
}

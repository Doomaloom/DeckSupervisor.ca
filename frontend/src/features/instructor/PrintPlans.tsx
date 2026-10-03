import {useEffect,useRef,useState} from 'react'
import {fetchLessonPlan,type InstructorSession,type InstructorClass,type LessonPlan} from '../../lib/serverApi'
import {openPrintWindow,openPdfPreview,openPdfPrintDialog} from '../../lib/browserPrint'
import PlanSelection from './PlanSelection'
export function SavedPlanPrint({session,course,week}: {session: InstructorSession;course: InstructorClass;week: string}) {
 const [plan,setPlan]=useState<LessonPlan|null>(null)
 const [loading,setLoading]=useState(true)
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
 const [retry,setRetry]=useState(0)
 const active=useRef(true)
 useEffect(()=>{active.current=true;let current=true;setLoading(true);setPlan(null);setError('');fetchLessonPlan(session.id,course.id,week).then(r=>{if(current){setPlan(r.plan);setLoading(false)}}).catch(e=>{if(current){setError(e.message);setLoading(false)}});return()=>{current=false;active.current=false}},[session.id,course.id,week,retry])
 async function showPdf(print: boolean){
  const target=openPrintWindow('Weekly lesson plan');if(!target){setError('Allow popups to preview or print your lesson plan.');return}
  setBusy(true);setError('')
  try{
   const saved=await fetchLessonPlan(session.id,course.id,week)
   if(!saved.plan)throw new Error('No saved lesson plan for this week.')
   const {generateLessonPlanPdf}=await import('../pdf/lessonPlan/generateLessonPlanPdf')
   const artifact=await generateLessonPlanPdf(session,course,saved.plan)
   if(!active.current){target.close();return}
   const shown=print?openPdfPrintDialog(artifact.blob,target,artifact):openPdfPreview(artifact.blob,artifact,target)
   if(!shown)throw new Error('Unable to open PDF preview.')
  }catch(e){target.close();if(active.current)setError(e instanceof Error?e.message:'Unable to print')}finally{if(active.current)setBusy(false)}
 }
 return <div className="flex flex-col gap-3">
 {loading && <p role="status">Loading saved lesson plan…</p>}
 {error && <p role="alert">{error} <button onClick={()=>setRetry(v=>v+1)}>Retry</button></p>}
 {!loading && !error && !plan && <p>No saved lesson plan for this week. Printing creates no plan.</p>}
 {plan && <><p>Print uses the saved lesson plan. Save editor changes before printing.</p><div className="flex gap-3"><button disabled={busy} className="rounded border p-2" onClick={()=>void showPdf(false)}>Preview PDF</button><button disabled={busy} className="rounded bg-primary p-2 text-white" onClick={()=>void showPdf(true)}>Print PDF</button></div></>}
 </div>
}
export default function PrintPlans(){return <PlanSelection title="Print">{(s,c,w)=><SavedPlanPrint key={`${s.id}:${c.id}:${w}`} session={s} course={c} week={w}/>}</PlanSelection>}

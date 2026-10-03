import { useEffect,useState,type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import useInstructorClasses,{sessionLabel} from './useInstructorClasses'
import type {InstructorSession,InstructorClass} from '../../lib/serverApi'

export default function PlanSelection({title,children}: {title: string;children: (s: InstructorSession,c: InstructorClass,w: string)=>ReactNode}) {
 const [params]=useSearchParams()
 const state=useInstructorClasses(params.get('session')||undefined)
 const [classId,setClassId]=useState('')
 const [week,setWeek]=useState('')
 useEffect(()=>{if(!state.loading){setClassId(state.classes.some(c=>c.id===params.get('class'))?params.get('class')!:state.classes[0]?.id||'');setWeek(state.session?.weeks[0]||'')}},[state.loading,state.sessionId,params])
 const selected=state.classes.find(c=>c.id===classId)
 const [dirty,setDirty]=useState(false)
 // Editor signals unsaved changes so changing a selector also prompts.
 useEffect(()=>{const listener=(e: Event)=>setDirty((e as CustomEvent<boolean>).detail);window.addEventListener('instructor-draft',listener);return()=>window.removeEventListener('instructor-draft',listener)},[])
 function change(action:()=>void){if(!dirty || window.confirm('Discard unsaved lesson plan changes?')){setDirty(false);action()}}
 return <section className="flex flex-col gap-4"><h2 className="text-2xl font-semibold">{title}</h2>
 {state.sessions.length>0 && <label>Session <select aria-label="Session" className="max-w-full border p-2" value={state.sessionId} onChange={e=>change(()=>state.selectSession(e.target.value))}>{state.sessions.map(s=><option key={s.id} value={s.id}>{sessionLabel(s)}</option>)}</select></label>}
 {state.loading && <p role="status">Loading linked classes…</p>}
 {state.error && <p role="alert">{state.error} <button onClick={()=>change(state.refresh)}>Retry</button></p>}
 {!state.loading && !state.error && !state.classes.length && <p>No linked classes. Ask your supervisor to link your account.</p>}
 {!state.loading && !state.error && state.classes.length>0 && <>
 <label>Class <select aria-label="Class" className="max-w-full border p-2" value={classId} onChange={e=>change(()=>setClassId(e.target.value))}>{state.classes.map(c=><option key={c.id} value={c.id}>{c.level} · {c.code} · {c.start_time.slice(0,5)} · {c.instructor}</option>)}</select></label>
 {!state.session?.weeks.length && <p>Planning is unavailable until the supervisor completes valid session dates and scheduled lesson days.</p>}
 {!!state.session?.weeks.length && <label>Week (Monday, America/Toronto) <select aria-label="Week" className="border p-2" value={week} onChange={e=>change(()=>setWeek(e.target.value))}>{state.session.weeks.map(w=><option key={w} value={w}>Week of {w}</option>)}</select></label>}
 {selected && state.session && week && children(state.session,selected,week)}
 </>}
 </section>
}

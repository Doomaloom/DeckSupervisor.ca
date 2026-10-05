import { Notice, EmptyState, PageShell, Card, Select, ActionButton } from '../../general-components'
import { useEffect,useState,type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import useInstructorClasses from './useInstructorClasses'
import type {InstructorSession,InstructorClass} from '../../lib/serverApi'

export default function PlanSelection({title,children}: {title: string;children: (s: InstructorSession,c: InstructorClass,w: string)=>ReactNode}) {
 const [params]=useSearchParams()
 const state=useInstructorClasses()
 const [classId,setClassId]=useState('')
 const [week,setWeek]=useState('')
 useEffect(()=>{if(!state.loading){setClassId((!params.get('session') || params.get('session')===state.sessionId) && state.classes.some(c=>c.id===params.get('class'))?params.get('class')!:state.classes[0]?.id||'');setWeek(state.session?.weeks[0]||'')}},[state.loading,state.sessionId,state.classes,state.session,params])
 const selected=state.classes.find(c=>c.id===classId)
 const [dirty,setDirty]=useState(false)
 // Editor signals unsaved changes so changing a selector also prompts.
 useEffect(()=>{const listener=(e: Event)=>setDirty((e as CustomEvent<boolean>).detail);window.addEventListener('instructor-draft',listener);return()=>window.removeEventListener('instructor-draft',listener)},[])
 function change(action:()=>void){if(!dirty || window.confirm('Discard unsaved lesson plan changes?')){setDirty(false);action()}}
 return <PageShell><Card className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-2"><h2 className="text-2xl font-semibold lg:col-span-2">{title}</h2>
 {state.loading && <p role="status">Loading linked classes…</p>}
 {state.error && <Notice tone="danger" role="alert">{state.error} <ActionButton onClick={()=>change(state.refresh)}>Retry</ActionButton></Notice>}
 {!state.loading && !state.error && !state.classes.length && <EmptyState>No linked classes. Ask your supervisor to link your account.</EmptyState>}
 {!state.loading && !state.error && state.classes.length>0 && <>
 <label className="flex min-w-0 flex-col gap-2 text-sm font-semibold">Class <Select aria-label="Class" className="max-w-full" value={classId} onChange={e=>change(()=>setClassId(e.target.value))}>{state.classes.map(c=><option key={c.id} value={c.id}>{c.level} · {c.code} · {c.start_time.slice(0,5)} · {c.instructor}</option>)}</Select></label>
 {!state.session?.weeks.length && <p>Planning is unavailable until the supervisor completes valid session dates and scheduled lesson days.</p>}
 {!!state.session?.weeks.length && <label className="flex min-w-0 flex-col gap-2 text-sm font-semibold">Week (Monday, America/Toronto) <Select aria-label="Week"  value={week} onChange={e=>change(()=>setWeek(e.target.value))}>{state.session.weeks.map(w=><option key={w} value={w}>Week of {w}</option>)}</Select></label>}
 {selected && state.session && week && <div className="min-w-0 border-t border-secondary/20 pt-6 lg:col-span-2">{children(state.session,selected,week)}</div>}
 </>}
 </Card></PageShell>
}

import { useEffect,useRef,useState } from 'react'
import { useBlocker } from 'react-router-dom'
import {fetchLessonPlan,saveLessonPlan,type LessonRow} from '../../lib/serverApi'
import PlanSelection from './PlanSelection'

export function LessonEditor({sessionId,classId,week}: {sessionId: string;classId: string;week: string}) {
 const [rows,setRows]=useState<LessonRow[]>([])
 const [saved,setSaved]=useState<LessonRow[]>([])
 const [missing,setMissing]=useState(true)
 const [loading,setLoading]=useState(true)
 const [saving,setSaving]=useState(false)
 const [error,setError]=useState('')
 const [notice,setNotice]=useState('')
 const [retry,setRetry]=useState(0)
 const active=useRef(true)
 const dirty=JSON.stringify(rows)!==JSON.stringify(saved)
 const blocker=useBlocker(dirty)
 useEffect(()=>{if(blocker.state==='blocked'){if(window.confirm('Discard unsaved lesson plan changes?'))blocker.proceed();else blocker.reset()}},[blocker])
 useEffect(()=>{
  active.current=true;let current=true;setLoading(true);setError('')
  fetchLessonPlan(sessionId,classId,week).then(r=>{if(current){setRows(r.plan?.rows||[]);setSaved(r.plan?.rows||[]);setMissing(!r.plan);setLoading(false)}}).catch(e=>{if(current){setError(e.message);setLoading(false)}})
  return()=>{current=false;active.current=false}
 },[sessionId,classId,week,retry])
 useEffect(()=>{window.dispatchEvent(new CustomEvent('instructor-draft',{detail:dirty}));const unload=(e: BeforeUnloadEvent)=>{if(dirty){e.preventDefault();e.returnValue=''}};window.addEventListener('beforeunload',unload);return()=>{window.removeEventListener('beforeunload',unload);window.dispatchEvent(new CustomEvent('instructor-draft',{detail:false}))}},[dirty])
 function edit(i: number,patch: Partial<LessonRow>){setNotice('');setRows(current=>current.map((r,index)=>index===i?{...r,...patch}:r))}
 function move(i: number,direction: number){setRows(current=>{const next=[...current];[next[i],next[i+direction]]=[next[i+direction],next[i]];return next})}
 if(loading)return <p role="status">Loading saved lesson plan…</p>
 if(error && !dirty && !rows.length)return <div role="alert">{error} <button onClick={()=>setRetry(v=>v+1)}>Retry</button></div>
 return <form className="flex flex-col gap-4" onSubmit={async e=>{e.preventDefault();setSaving(true);setError('');setNotice('');try{const result=await saveLessonPlan(sessionId,classId,week,rows);if(active.current){setSaved(result.plan.rows);setMissing(false);setNotice('Lesson plan saved.')}}catch(e){if(active.current)setError(e instanceof Error?e.message:'Save failed. Your draft is retained.')}finally{if(active.current)setSaving(false)}}}>
 {missing && <p>No lesson plan saved for this week. Opening this editor creates no record.</p>}
 {dirty && <p role="status">Unsaved changes</p>}
 {error && <p role="alert">{error} Your draft is retained.</p>}
 {notice && <p role="status">{notice}</p>}
 <fieldset disabled={saving} className="min-w-0"><div className="overflow-x-auto"><table className="w-full min-w-[620px] border-collapse text-left"><thead><tr>{['Skill','Activity / drill','Pool location','Duration (minutes)','Row actions'].map(h=><th key={h} className="border p-2">{h}</th>)}</tr></thead>
 <tbody>{rows.map((row,i)=><tr key={i}>
 <td className="border p-2"><textarea aria-label={`Skill ${i+1}`} className="w-full border p-1" maxLength={2000} value={row.skill} onChange={e=>edit(i,{skill:e.target.value})}/></td>
 <td className="border p-2"><textarea aria-label={`Activity / drill ${i+1}`} className="w-full border p-1" maxLength={10000} value={row.activity} onChange={e=>edit(i,{activity:e.target.value})}/></td>
 <td className="border p-2"><select aria-label={`Pool location ${i+1}`} value={row.location.startsWith('Lane')?'Lane':row.location} onChange={e=>edit(i,{location:e.target.value})}><option>Lane</option><option>Shallow end</option><option>Deep end</option></select>{row.location.startsWith('Lane') && <input aria-label={`Lane number ${i+1}`} className="w-20 border p-1" type="number" min={1} max={99} placeholder="Optional" value={row.location.split(' ')[1]||''} onChange={e=>edit(i,{location:e.target.value?`Lane ${e.target.value}`:'Lane'})}/>}</td>
 <td className="border p-2"><input className="w-20 border p-1" aria-label={`Duration (minutes) ${i+1}`} type="number" min={1} max={240} step={1} required value={row.duration} onChange={e=>edit(i,{duration:Number(e.target.value)})}/></td>
 <td className="border p-2"><button type="button" aria-label={`Move row ${i+1} up`} disabled={i===0} onClick={()=>move(i,-1)}>↑</button> <button type="button" aria-label={`Move row ${i+1} down`} disabled={i===rows.length-1} onClick={()=>move(i,1)}>↓</button> <button type="button" aria-label={`Delete row ${i+1}`} onClick={()=>setRows(current=>current.filter((_,index)=>index!==i))}>Delete</button></td>
 </tr>)}</tbody></table></div>
 <button type="button" className="mt-3 rounded border p-2" disabled={rows.length>=200} onClick={()=>setRows(current=>[...current,{skill:'',activity:'',location:'Lane',duration:5}])}>Add activity</button>
 <button type="submit" className="ml-3 rounded bg-primary p-2 text-white">{saving?'Saving…':'Save'}</button></fieldset>
 </form>
}
export default function LessonPlans(){return <PlanSelection title="Lesson Plans">{(s,c,w)=><LessonEditor key={`${s.id}:${c.id}:${w}`} sessionId={s.id} classId={c.id} week={w}/>}</PlanSelection>}

import { Notice, EmptyState, Select, TextInput, Textarea, ActionButton } from '../../general-components'
import { useEffect,useRef,useState } from 'react'
import { useBlocker } from 'react-router-dom'
import {fetchLessonPlan,saveLessonPlan,type LessonRow} from '../../lib/serverApi'
import PlanSelection from './PlanSelection'
import {curriculumLevels,findCurriculumLevel} from './lessonSkills'

export function LessonEditor({sessionId,classId,week,level}: {sessionId: string;classId: string;week: string;level: string}) {
 const [rows,setRows]=useState<LessonRow[]>([])
 const [saved,setSaved]=useState<LessonRow[]>([])
 const assignedLevel=findCurriculumLevel(level)
 const [curriculumLevel,setCurriculumLevel]=useState('')
 const [savedCurriculumLevel,setSavedCurriculumLevel]=useState('')
 const selectedLevel=assignedLevel || curriculumLevels.find(l=>l.id===curriculumLevel)
 const skills=selectedLevel?.skills || []
 const [missing,setMissing]=useState(true)
 const [loading,setLoading]=useState(true)
 const [saving,setSaving]=useState(false)
 const [error,setError]=useState('')
 const [notice,setNotice]=useState('')
 const [retry,setRetry]=useState(0)
 const active=useRef(true)
 const dirty=JSON.stringify(rows)!==JSON.stringify(saved) || (!assignedLevel && curriculumLevel!==savedCurriculumLevel)
 const blocker=useBlocker(dirty)
 useEffect(()=>{if(blocker.state==='blocked'){if(window.confirm('Discard unsaved lesson plan changes?'))blocker.proceed();else blocker.reset()}},[blocker])
 useEffect(()=>{
  active.current=true;let current=true;setLoading(true);setError('')
  fetchLessonPlan(sessionId,classId,week).then(r=>{if(current){setRows(r.plan?.rows||[]);setSaved(r.plan?.rows||[]);setCurriculumLevel(r.plan?.curriculum_level||'');setSavedCurriculumLevel(r.plan?.curriculum_level||'');setMissing(!r.plan);setLoading(false)}}).catch(e=>{if(current){setError(e.message);setLoading(false)}})
  return()=>{current=false;active.current=false}
 },[sessionId,classId,week,retry])
 useEffect(()=>{window.dispatchEvent(new CustomEvent('instructor-draft',{detail:dirty}));const unload=(e: BeforeUnloadEvent)=>{if(dirty){e.preventDefault();e.returnValue=''}};window.addEventListener('beforeunload',unload);return()=>{window.removeEventListener('beforeunload',unload);window.dispatchEvent(new CustomEvent('instructor-draft',{detail:false}))}},[dirty])
 function edit(i: number,patch: Partial<LessonRow>){setNotice('');setRows(current=>current.map((r,index)=>index===i?{...r,...patch}:r))}
 function move(i: number,direction: number){setRows(current=>{const next=[...current];[next[i],next[i+direction]]=[next[i+direction],next[i]];return next})}
 if(loading)return <p role="status">Loading saved lesson plan…</p>
 if(error && !dirty && !rows.length)return <Notice tone="danger" role="alert">{error} <ActionButton onClick={()=>setRetry(v=>v+1)}>Retry</ActionButton></Notice>
 return <form className="flex flex-col gap-4" onSubmit={async e=>{e.preventDefault();setSaving(true);setError('');setNotice('');try{const result=await saveLessonPlan(sessionId,classId,week,rows,assignedLevel?null:curriculumLevel||null);if(active.current){setSaved(result.plan.rows);setSavedCurriculumLevel(result.plan.curriculum_level||'');setMissing(false);setNotice('Lesson plan saved.')}}catch(e){if(active.current)setError(e instanceof Error?e.message:'Save failed. Your draft is retained.')}finally{if(active.current)setSaving(false)}}}>
 {missing && <EmptyState>No lesson plan saved for this week. Opening this editor creates no record.</EmptyState>}
 {dirty && <Notice tone="warning" role="status">Unsaved changes</Notice>}
 {error && <Notice tone="danger" role="alert">{error} Your draft is retained.</Notice>}
 {notice && <Notice tone="success" role="status">{notice}</Notice>}
 <fieldset disabled={saving} className="min-w-0 space-y-4">
 {!assignedLevel && <label className="mb-4 flex flex-col gap-2 text-sm font-semibold">Curriculum level <Select aria-label="Curriculum level" required className="max-w-full" value={curriculumLevel} onChange={e=>{setNotice('');setCurriculumLevel(e.target.value)}}><option value="">Select curriculum level</option>{curriculumLevels.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</Select></label>}
 <p className="text-sm md:hidden">Scroll the activity table sideways to edit pool location, duration, and row order.</p><div className="overflow-x-auto rounded-2xl border border-secondary/20 bg-accent" tabIndex={0} role="region" aria-label="Scrollable activity table"><table className="w-full min-w-[960px] border-collapse text-left"><thead className="bg-primary text-accent"><tr>{['Skill','Activity / drill','Pool location','Duration (minutes)','Row actions'].map(h=><th key={h} className="border-b border-secondary/20 p-3 align-top">{h}</th>)}</tr></thead>
 <tbody>{rows.map((row,i)=><tr key={i}>
 <td className="border-b border-secondary/20 p-3 align-top"><Select title={row.skill || undefined} aria-label={`Skill ${i+1}`} className="w-full min-w-40 max-w-xs" disabled={!selectedLevel} value={row.skill} onChange={e=>edit(i,{skill:e.target.value})}><option value="">{selectedLevel?'Select skill':'Choose curriculum level first'}</option>{row.skill && !skills.some(skill=>skill.name===row.skill) && <option value={row.skill}>{row.skill} (saved skill)</option>}{skills.map(skill=><option key={skill.id} value={skill.name}>{skill.name}</option>)}</Select></td>
 <td className="border-b border-secondary/20 p-3 align-top"><Textarea minRowsClassName="min-h-24" aria-label={`Activity / drill ${i+1}`} className="w-full min-w-48" maxLength={10000} value={row.activity} onChange={e=>edit(i,{activity:e.target.value})}/></td>
 <td className="space-y-2 border-b border-secondary/20 p-3 align-top"><Select aria-label={`Pool location ${i+1}`} value={row.location.startsWith('Lane')?'Lane':row.location} onChange={e=>edit(i,{location:e.target.value})}><option>Lane</option><option>Shallow end</option><option>Deep end</option></Select>{row.location.startsWith('Lane') && <TextInput aria-label={`Lane number ${i+1}`} className="w-24" type="number" min={1} max={99} placeholder="Optional" value={row.location.split(' ')[1]||''} onChange={e=>edit(i,{location:e.target.value?`Lane ${e.target.value}`:'Lane'})}/>}</td>
 <td className="border-b border-secondary/20 p-3 align-top"><TextInput className="w-24" aria-label={`Duration (minutes) ${i+1}`} type="number" min={1} max={240} step={1} required value={row.duration} onChange={e=>edit(i,{duration:Number(e.target.value)})}/></td>
 <td className="border-b border-secondary/20 p-3 align-top"><div className="flex flex-wrap gap-2"><ActionButton type="button" aria-label={`Move row ${i+1} up`} disabled={i===0} onClick={()=>move(i,-1)}>↑</ActionButton> <ActionButton type="button" aria-label={`Move row ${i+1} down`} disabled={i===rows.length-1} onClick={()=>move(i,1)}>↓</ActionButton> <ActionButton type="button" variant="danger" aria-label={`Delete row ${i+1}`} onClick={()=>setRows(current=>current.filter((_,index)=>index!==i))}>Delete</ActionButton></div></td>
 </tr>)}</tbody></table></div>
 <div className="flex flex-wrap gap-3"><ActionButton variant="outline" type="button" disabled={rows.length>=200} onClick={()=>setRows(current=>[...current,{skill:'',activity:'',location:'Lane',duration:5}])}>Add activity</ActionButton>
 <ActionButton variant="primary" type="submit">{saving?'Saving…':'Save'}</ActionButton></div></fieldset>
 </form>
}
export default function LessonPlans(){return <PlanSelection title="Lesson Plans">{(s,c,w)=><LessonEditor key={`${s.id}:${c.id}:${w}`} sessionId={s.id} classId={c.id} week={w} level={c.level}/>}</PlanSelection>}

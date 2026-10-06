import { Notice, Select, TextInput, Textarea, ActionButton } from '../../general-components'
import { useEffect,useId,useRef,useState } from 'react'
import { useBlocker } from 'react-router-dom'
import {fetchLessonPlan,saveLessonPlan,type LessonRow} from '../../lib/serverApi'
import ActivityLibraryModal from '../activity-library/ActivityLibraryModal'
import {activityText} from '../activity-library/activityLibrary'
import WorkoutBuilderModal from '../workout-builder/WorkoutBuilderModal'
import {workoutText} from '../workout-builder/workout'
import PlanSelection from './PlanSelection'
import {curriculumLevels,findCurriculumLevel,isWorkoutSkill} from './lessonSkills'

export function LessonEditor({sessionId,classId,week,level}: {sessionId: string;classId: string;week: string;level: string}) {
 const [workoutRow,setWorkoutRow]=useState<number|null>(null)
 const [libraryRow,setLibraryRow]=useState<number|null>(null)
 const dragHelpId=useId()
 const tableRef=useRef<HTMLTableElement>(null)
 const [drag,setDrag]=useState<{from: number;to: number|null}|null>(null)
 const [reorderNotice,setReorderNotice]=useState('')
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
 function changeSkill(i: number,skill: string){
  if(rows[i].workout && !isWorkoutSkill(skill)){
   if(!window.confirm('Changing to this skill will convert the workout to text. Continue?'))return
   edit(i,{skill,workout:undefined})
  }else edit(i,{skill})
 }
 function move(from: number,to: number){
  if(from===to || to<0 || to>=rows.length)return
  setNotice('')
  setRows(current=>{const next=[...current];const [row]=next.splice(from,1);next.splice(to,0,row);return next})
  setReorderNotice(`Row ${from+1} moved to position ${to+1}.`)
  tableRef.current?.querySelector<HTMLButtonElement>(`[data-row-index="${to}"] button`)?.focus()
 }
 function rowAtPoint(x: number,y: number){
  const row=document.elementFromPoint(x,y)?.closest<HTMLTableRowElement>('tr[data-row-index]')
  return row && tableRef.current?.contains(row)?Number(row.dataset.rowIndex):null
 }
 if(loading)return <p role="status">Loading saved lesson plan…</p>
 if(error && !dirty && !rows.length)return <Notice tone="danger" role="alert">{error} <ActionButton onClick={()=>setRetry(v=>v+1)}>Retry</ActionButton></Notice>
 return <form className="flex flex-col gap-4" onSubmit={async e=>{e.preventDefault();setSaving(true);setError('');setNotice('');try{const result=await saveLessonPlan(sessionId,classId,week,rows,assignedLevel?null:curriculumLevel||null);if(active.current){setSaved(result.plan.rows);setSavedCurriculumLevel(result.plan.curriculum_level||'');setMissing(false);setNotice('Lesson plan saved.')}}catch(e){if(active.current)setError(e instanceof Error?e.message:'Save failed. Your draft is retained.')}finally{if(active.current)setSaving(false)}}}>
 {dirty && <Notice tone="warning" role="status">Unsaved changes</Notice>}
 {error && <Notice tone="danger" role="alert">{error} Your draft is retained.</Notice>}
 {notice && <Notice tone="success" role="status">{notice}</Notice>}
 <fieldset disabled={saving} className="min-w-0 space-y-4">
 {!assignedLevel && <label className="mb-4 flex flex-col gap-2 text-sm font-semibold">Curriculum level <Select aria-label="Curriculum level" required className="max-w-full" value={curriculumLevel} onChange={e=>{setNotice('');setCurriculumLevel(e.target.value)}}><option value="">Select curriculum level</option>{curriculumLevels.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</Select></label>}
 <p id={dragHelpId} className="sr-only">Drag to reorder, or use the up and down arrow keys.</p>
 <p role="status" className="sr-only">{reorderNotice}</p>
 <p className="text-sm md:hidden">Scroll the activity table sideways to edit pool location, duration, and row order.</p><div className="overflow-x-auto rounded-2xl border border-secondary/20 bg-accent" tabIndex={0} role="region" aria-label="Scrollable activity table"><table ref={tableRef} className="w-full min-w-[960px] border-collapse text-left"><thead className="bg-primary text-accent"><tr><th className="w-12"><span className="sr-only">Reorder</span></th>{['Skill','Activity / drill','Pool location','Duration (minutes)'].map(h=><th key={h} className="border-b border-secondary/20 p-3 align-top">{h}</th>)}<th className="w-24"><span className="sr-only">Delete</span></th></tr></thead>
 <tbody>{missing && <tr><td colSpan={6} className="border-b border-secondary/20 bg-bg px-4 py-8 text-center text-sm text-secondary/70">No lesson plan saved for this week. Opening this editor creates no record.</td></tr>}{rows.map((row,i)=><tr key={i} data-row-index={i} className={drag?.to===i?'bg-secondary/10':undefined}>
 <td className="border-b border-secondary/20 p-3 align-top"><button type="button" aria-label={`Reorder row ${i+1}`} aria-describedby={dragHelpId} disabled={rows.length<2} className="flex h-11 w-11 touch-none select-none items-center justify-center rounded-lg text-secondary hover:bg-secondary/10 focus-visible:outline focus-visible:outline-2 disabled:opacity-40 cursor-grab active:cursor-grabbing" onKeyDown={e=>{
  if(e.key==='ArrowUp' || e.key==='ArrowDown'){e.preventDefault();move(i,i+(e.key==='ArrowUp'?-1:1))}
 }} onPointerDown={e=>{
  if(e.button!==0 || saving)return
  e.currentTarget.setPointerCapture(e.pointerId);setDrag({from:i,to:i})
 }} onPointerMove={e=>{
  if(!drag)return
  const to=rowAtPoint(e.clientX,e.clientY)
  setDrag({...drag,to})
 }} onPointerUp={e=>{
  if(!drag)return
  const to=rowAtPoint(e.clientX,e.clientY)
  if(to!==null)move(drag.from,to)
  setDrag(null)
  e.currentTarget.releasePointerCapture(e.pointerId)
 }} onPointerCancel={()=>setDrag(null)} onLostPointerCapture={()=>setDrag(null)}><svg aria-hidden="true" width="20" height="24" viewBox="0 0 20 24" fill="currentColor">{[6,12,18].flatMap(y=>[7,13].map(x=><circle key={`${x}-${y}`} cx={x} cy={y} r="1.5"/>))}</svg></button></td>
 <td className="border-b border-secondary/20 p-3 align-top"><Select title={row.skill || undefined} aria-label={`Skill ${i+1}`} className="w-full min-w-40 max-w-xs" disabled={!selectedLevel} value={row.skill} onChange={e=>changeSkill(i,e.target.value)}><option value="">{selectedLevel?'Select skill':'Choose curriculum level first'}</option>{row.skill && !skills.some(skill=>skill.name===row.skill) && <option value={row.skill}>{row.skill} (saved skill)</option>}{skills.map(skill=><option key={skill.id} value={skill.name}>{skill.compactName}</option>)}</Select></td>
 <td className="border-b border-secondary/20 p-3 align-top">{row.workout ? <><p className="whitespace-pre-wrap break-words text-sm" aria-label={`Workout summary ${i+1}`}>{row.activity}</p><div className="mt-2 flex flex-wrap gap-2">{isWorkoutSkill(row.skill) && <ActionButton size="sm" variant="outline" aria-label={`Edit workout for row ${i+1}`} onClick={()=>setWorkoutRow(i)}>Edit workout</ActionButton>}<ActionButton size="sm" variant="ghost" aria-label={`Convert workout in row ${i+1} to text`} onClick={()=>{if(window.confirm('Convert this workout to text? Its sets will no longer be editable in the workout builder.'))edit(i,{workout:undefined})}}>Convert to text</ActionButton></div></> : <><Textarea minRowsClassName="min-h-24" aria-label={`Activity / drill ${i+1}`} className="w-full min-w-48" maxLength={10000} value={row.activity} onChange={e=>edit(i,{activity:e.target.value})}/><div className="mt-2 flex flex-wrap gap-2"><ActionButton variant="outline" size="sm" aria-label={`Browse library for row ${i+1}`} onClick={()=>setLibraryRow(i)}>Browse library</ActionButton>{isWorkoutSkill(row.skill) && <ActionButton variant="outline" size="sm" aria-label={`Build workout for row ${i+1}`} onClick={()=>setWorkoutRow(i)}>Build workout</ActionButton>}</div></>}</td>
 <td className="border-b border-secondary/20 p-3 align-top"><Select aria-label={`Pool location ${i+1}`} value={row.location.startsWith('Lane')?'Lane':row.location} onChange={e=>edit(i,{location:e.target.value})}><option>Lane</option><option>Shallow end</option><option>Deep end</option></Select></td>
 <td className="border-b border-secondary/20 p-3 align-top"><TextInput className="w-24" aria-label={`Duration (minutes) ${i+1}`} type="number" min={1} max={240} step={1} required value={row.duration} onChange={e=>edit(i,{duration:Number(e.target.value)})}/></td>
 <td className="border-b border-secondary/20 p-3 align-top"><ActionButton type="button" variant="danger" aria-label={`Delete row ${i+1}`} onClick={()=>{setNotice('');setRows(current=>current.filter((_,index)=>index!==i))}}>Delete</ActionButton></td>
 </tr>)}</tbody></table></div>
 <div className="flex flex-wrap gap-3"><ActionButton variant="outline" type="button" disabled={rows.length>=200} onClick={()=>setRows(current=>[...current,{skill:'',activity:'',location:'Lane',duration:5}])}>Add activity</ActionButton>
 <ActionButton variant="primary" type="submit">{saving?'Saving…':'Save'}</ActionButton></div></fieldset>
 {libraryRow!==null && rows[libraryRow] && <ActivityLibraryModal selectedSkill={skills.find(skill=>skill.name===rows[libraryRow].skill)} onClose={()=>setLibraryRow(null)} onUse={activity=>{
  if(rows[libraryRow].activity.trim() && !window.confirm('Replace this row’s activity text with the selected library activity?'))return
  edit(libraryRow,{activity:activityText(activity)});setLibraryRow(null)
 }}/>}
 {workoutRow!==null && rows[workoutRow] && isWorkoutSkill(rows[workoutRow].skill) && <WorkoutBuilderModal initialWorkout={rows[workoutRow].workout} onClose={()=>setWorkoutRow(null)} onUse={workout=>{
  if(!rows[workoutRow].workout && rows[workoutRow].activity.trim() && !window.confirm('Replace this row’s activity text with the workout?'))return
  edit(workoutRow,{workout,activity:workoutText(workout)});setWorkoutRow(null)
 }}/>}
 </form>
}
export default function LessonPlans(){return <PlanSelection title="Lesson Plans">{(s,c,w)=><LessonEditor key={`${s.id}:${c.id}:${w}`} sessionId={s.id} classId={c.id} week={w} level={c.level}/>}</PlanSelection>}

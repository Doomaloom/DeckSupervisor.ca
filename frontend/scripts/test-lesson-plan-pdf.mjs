import {createServer} from 'vite'
import {mkdir,writeFile} from 'node:fs/promises'
import {resolve} from 'node:path'
const output=resolve(process.argv[2] || '../tmp/lesson-plan-pdf')
const server=await createServer({root:resolve(import.meta.dirname,'..'),optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false},appType:'custom'})
try {
 const {generateLessonPlanPdf}=await server.ssrLoadModule('/src/features/pdf/lessonPlan/generateLessonPlanPdf.tsx')
 const {newWorkout,workoutText}=await server.ssrLoadModule('/src/features/workout-builder/workout.ts')
 const {workoutPresets}=await server.ssrLoadModule('/src/features/workout-builder/workoutPresets.ts')
 const workout=newWorkout(); workout.title='PDF workout check'
 for(const [key,id] of [['warmUp','young-1-warm'],['mainSet','young-1-main'],['coolDown','young-1-cool']]) workout.sections[key]=workoutPresets.find(p=>p.id===id).sets
 const session={id:'synthetic-session',session_day:'Mo',session_season:'Fall',session_year:2026,location:'Synthetic Pool',start_date:'2026-10-05',end_date:'2026-10-26',weeks:['2026-10-05']}
 const course={id:'synthetic-class',instructor:'Alex Synthetic',level:'Swimmer 1',code:'SYNTHETIC-A',start_time:'09:00:00',end_time:'09:30:00'}
 await mkdir(output,{recursive:true})
 for(const [name,rows] of [
  ['workout',[{skill:'Swimming endurance',activity:workoutText(workout),workout,location:'Lane',duration:20}]],
  ['single',[{skill:'Floating',activity:'Practice supported front and back floats.',location:'Shallow end',duration:10},{skill:'Kicking',activity:'Flutter kick with a board.',location:'Lane 2',duration:15}]],
  ['multi',Array.from({length:32},(_,i)=>({skill:`Skill ${String(i+1).padStart(2,'0')}`,activity:i===15?'Very long activity with careful instruction and clear cues. '.repeat(120):`Activity ${String(i+1).padStart(2,'0')} - Practice technique with rest breaks and feedback. `.repeat(5),location:'Lane 2',duration:5}))]
 ]){
  const artifact=await generateLessonPlanPdf(session,course,{week:'2026-10-05',rows})
  await writeFile(resolve(output,`${name}.pdf`),Buffer.from(await artifact.blob.arrayBuffer()))
  console.log(`Rendered ${name}: ${rows.length} activities`)
 }
}finally{await server.close()}

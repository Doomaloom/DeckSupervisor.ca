import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider, Outlet } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import InstructorLayout from './InstructorLayout'
import MyClasses from './MyClasses'
import LessonPlans from './LessonPlans'
import PrintPlans from './PrintPlans'

const api=vi.hoisted(()=>({fetchInstructorSessions:vi.fn(),fetchInstructorClasses:vi.fn(),fetchLessonPlan:vi.fn()}))
vi.mock('../../app/AuthContext',()=>({useAuth:()=>({user:{id:'staff'},loading:false,workflowCapabilities:{instructor:true,supervisor:true},signOut:vi.fn()})}))
vi.mock('../../lib/serverApi',()=>api)
const sessions=['a','b'].map(id=>({id,session_day:'Monday',session_season:'Fall',session_year:2026,location:`Pool ${id}`,start_date:'2026-10-05',end_date:'2026-10-26',weeks:['2026-10-05']}))
const course=(id:string)=>({id:`class-${id}`,session_id:id,assignment_id:id,instructor:'Alex',code:id,level:'Splash 1',start_time:'09:00:00',end_time:'09:30:00'})
beforeEach(()=>{
 sessionStorage.clear();vi.restoreAllMocks()
 api.fetchInstructorSessions.mockReset().mockResolvedValue({sessions})
 api.fetchInstructorClasses.mockReset().mockImplementation(async(id:string)=>({classes:[course(id)]}))
 api.fetchLessonPlan.mockReset().mockResolvedValue({plan:null})
})
function setup(path='/instructor') {
 const router=createMemoryRouter([{element:<InstructorLayout><Outlet/></InstructorLayout>,children:[
  {path:'/instructor',element:<MyClasses/>},
  {path:'/instructor/lesson-plans',element:<LessonPlans/>},
  {path:'/instructor/attendance',element:<h2>Attendance placeholder</h2>},
  {path:'/instructor/print',element:<PrintPlans/>},
 ]}],{initialEntries:[path]})
 render(<RouterProvider router={router}/>);return router
}
it('shares a single picker across tabs without reloading session metadata',async()=>{
 const user=userEvent.setup();setup()
 await screen.findByRole('link',{name:/Plan Splash 1/})
 await user.selectOptions(screen.getByLabelText('Session'),'b')
 await waitFor(()=>expect(api.fetchInstructorClasses).toHaveBeenLastCalledWith('b'))
 for(const tab of ['Attendance','Lesson Plans','Print','My Classes']){
  await user.click(screen.getByRole('link',{name:tab}))
  expect(screen.getAllByRole('combobox',{name:'Session'})).toHaveLength(1)
  expect(screen.getByLabelText('Session')).toHaveValue('b')
 }
 expect(api.fetchInstructorSessions).toHaveBeenCalledTimes(1)
 expect(sessionStorage.getItem('instructor-session:staff')).toBe('b')
})
it('honors deep links and updates their session after a confirmed draft discard',async()=>{
 const user=userEvent.setup()
 const router=setup('/instructor/lesson-plans?session=b&class=class-b')
 await screen.findByRole('button',{name:'Add activity'})
 expect(screen.getByLabelText('Session')).toHaveValue('b')
 expect(screen.getByLabelText('Class')).toHaveValue('class-b')
 await user.click(screen.getByRole('button',{name:'Add activity'}))
 const confirm=vi.spyOn(window,'confirm').mockReturnValue(false)
 await user.selectOptions(screen.getByLabelText('Session'),'a')
 expect(screen.getByLabelText('Session')).toHaveValue('b')
 expect(screen.getByLabelText('Activity / drill 1')).toBeInTheDocument()
 expect(router.state.location.search).toContain('session=b')
 confirm.mockReturnValue(true)
 await user.selectOptions(screen.getByLabelText('Session'),'a')
 await waitFor(()=>expect(router.state.location.search).toBe('?session=a'))
 await screen.findByRole('button',{name:'Add activity'})
 expect(screen.getByLabelText('Class')).toHaveValue('class-a')
 expect(screen.queryByLabelText('Activity / drill 1')).not.toBeInTheDocument()
 expect(confirm).toHaveBeenCalledTimes(2)
 await user.click(screen.getByRole('link',{name:'Print'}))
 expect(screen.getByLabelText('Session')).toHaveValue('a')
})
it('falls back from an invalid saved and linked session',async()=>{
 sessionStorage.setItem('instructor-session:staff','missing')
 setup('/instructor/lesson-plans?session=missing&class=missing')
 await screen.findByRole('button',{name:'Add activity'})
 expect(screen.getByLabelText('Session')).toHaveValue('a')
 expect(screen.getByLabelText('Class')).toHaveValue('class-a')
})
it('shows session fetch errors and retries from the sidebar',async()=>{
 api.fetchInstructorSessions.mockRejectedValueOnce(new Error('Sessions unavailable'))
 const user=userEvent.setup();setup('/instructor/attendance')
 expect(await screen.findByRole('alert')).toHaveTextContent('Sessions unavailable')
 await user.click(screen.getByRole('button',{name:'Retry sessions'}))
 await waitFor(()=>expect(screen.getByLabelText('Session')).toHaveValue('a'))
 expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})
it('ignores delayed classes from the previous session',async()=>{
 let finish:(value:unknown)=>void=()=>{}
 api.fetchInstructorClasses.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve}))
 const user=userEvent.setup();setup()
 await waitFor(()=>expect(api.fetchInstructorClasses).toHaveBeenCalledWith('a'))
 await user.selectOptions(screen.getByLabelText('Session'),'b')
 await screen.findByRole('link',{name:/Plan Splash 1/})
 await act(async()=>finish({classes:[{...course('a'),level:'Stale class'}]}))
 expect(screen.queryByRole('link',{name:/Stale class/})).not.toBeInTheDocument()
 expect(screen.getByRole('link',{name:/Plan Splash 1/})).toHaveAttribute('href','/instructor/lesson-plans?session=b&class=class-b')
})

it('opens a different session deep link without loading the previous session’s plan',async()=>{
 const router=setup()
 await screen.findByRole('link',{name:/Plan Splash 1/})
 await act(async()=>{await router.navigate('/instructor/lesson-plans?session=b&class=class-b')})
 await screen.findByRole('button',{name:'Add activity'})
 expect(screen.getByLabelText('Session')).toHaveValue('b')
 expect(screen.getByLabelText('Class')).toHaveValue('class-b')
 expect(api.fetchLessonPlan).toHaveBeenCalledWith('b','class-b','2026-10-05')
 expect(api.fetchLessonPlan.mock.calls.every(([session])=>session==='b')).toBe(true)
})
it('disables the shared picker when no sessions are linked',async()=>{
 api.fetchInstructorSessions.mockResolvedValue({sessions:[]})
 setup('/instructor/attendance')
 await waitFor(()=>expect(screen.getByRole('option')).toHaveTextContent('No sessions available'))
 expect(screen.getByLabelText('Session')).toBeDisabled()
 expect(api.fetchInstructorClasses).not.toHaveBeenCalled()
})

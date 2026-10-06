import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider, Outlet } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import InstructorLayout from './InstructorLayout'
import InstructorHome, {groupInstructorSessions} from './InstructorHome'
import MyClasses from './MyClasses'
import ActivityLibrary from '../activity-library/ActivityLibrary'
import LessonPlans from './LessonPlans'
import PrintPlans from './PrintPlans'
import {closestUpcomingWeek} from './PlanSelection'

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
  {path:'/instructor',element:<InstructorHome/>},
  {path:'/instructor/my-classes',element:<MyClasses/>},
  {path:'/instructor/activity-library',element:<ActivityLibrary/>},
  {path:'/instructor/lesson-plans',element:<LessonPlans/>},
  {path:'/instructor/attendance',element:<h2>Attendance placeholder</h2>},
  {path:'/instructor/print',element:<PrintPlans/>},
 ]}],{initialEntries:[path]})
 render(<RouterProvider router={router}/>);return router
}
it('selects on Home and shares the session across tabs without reloading metadata',async()=>{
 const user=userEvent.setup();setup()
 await user.click(await screen.findByRole('button',{name:/Pool b/}))
 await waitFor(()=>expect(api.fetchInstructorClasses).toHaveBeenLastCalledWith('b'))
 for(const tab of ['Attendance','Lesson Plans','Print','My Classes']){
  await user.click(screen.getByRole('link',{name:tab}))
  expect(screen.queryByRole('combobox',{name:'Session'})).not.toBeInTheDocument()
  expect(sessionStorage.getItem('instructor-session:staff')).toBe('b')
 }
 expect(api.fetchInstructorSessions).toHaveBeenCalledTimes(1)
 expect(sessionStorage.getItem('instructor-session:staff')).toBe('b')
})
it('honors deep links and updates their session after a confirmed draft discard',async()=>{
 const user=userEvent.setup()
 const router=setup('/instructor/lesson-plans?session=b&class=class-b')
 await screen.findByRole('button',{name:'Add activity'})
 expect(sessionStorage.getItem('instructor-session:staff')).toBe('b')
 expect(screen.getByRole('button',{name:'Splash 1 · b · 09:00 · Alex'})).toHaveAttribute('aria-pressed','true')
 await user.click(screen.getByRole('button',{name:'Add activity'}))
 const confirm=vi.spyOn(window,'confirm').mockReturnValue(false)
 await user.click(screen.getByRole('link',{name:'Home'}))
 expect(sessionStorage.getItem('instructor-session:staff')).toBe('b')
 expect(screen.getByLabelText('Activity / drill 1')).toBeInTheDocument()
 expect(router.state.location.search).toContain('session=b')
 confirm.mockReturnValue(true)
 await user.click(screen.getByRole('link',{name:'Home'}))
 await user.click(await screen.findByRole('button',{name:/Pool a/}))
 await waitFor(()=>expect(router.state.location.search).toBe('?session=a'))
 await user.click(screen.getByRole('link',{name:'Lesson Plans'}))
 await screen.findByRole('button',{name:'Add activity'})
 expect(screen.getByRole('button',{name:'Splash 1 · a · 09:00 · Alex'})).toHaveAttribute('aria-pressed','true')
 expect(screen.queryByLabelText('Activity / drill 1')).not.toBeInTheDocument()
 expect(confirm).toHaveBeenCalledTimes(2)
 await user.click(screen.getByRole('link',{name:'Print'}))
 expect(sessionStorage.getItem('instructor-session:staff')).toBe('a')
})
it('requires a choice for invalid saved and linked sessions',async()=>{
 sessionStorage.setItem('instructor-session:staff','a')
 setup('/instructor/lesson-plans?session=missing&class=missing')
 await screen.findByRole('link',{name:'Choose a session'})
 expect(screen.getByLabelText('Current session')).toHaveTextContent('No session selected')
 expect(sessionStorage.getItem('instructor-session:staff')).toBeNull()
 expect(api.fetchInstructorClasses).not.toHaveBeenCalled()
})
it('shows session fetch errors and retries from the sidebar',async()=>{
 api.fetchInstructorSessions.mockRejectedValueOnce(new Error('Sessions unavailable'))
 const user=userEvent.setup();setup('/instructor/attendance')
 expect(await screen.findByRole('alert')).toHaveTextContent('Sessions unavailable')
 await user.click(screen.getByRole('button',{name:'Retry sessions'}))
 await screen.findByText('No session selected')
 expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})
it('ignores delayed classes from the previous session',async()=>{
 let finish:(value:unknown)=>void=()=>{}
 api.fetchInstructorClasses.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve}))
 const user=userEvent.setup();setup()
 await user.click(await screen.findByRole('button',{name:/Pool a/}))
 await waitFor(()=>expect(api.fetchInstructorClasses).toHaveBeenCalledWith('a'))
 await user.click(screen.getByRole('link',{name:'Home'}))
 await user.click(await screen.findByRole('button',{name:/Pool b/}))
 await screen.findByRole('link',{name:/Plan Splash 1/})
 await act(async()=>finish({classes:[{...course('a'),level:'Stale class'}]}))
 expect(screen.queryByRole('link',{name:/Stale class/})).not.toBeInTheDocument()
 expect(screen.getByRole('link',{name:/Plan Splash 1/})).toHaveAttribute('href','/instructor/lesson-plans?session=b&class=class-b')
})

it('opens a different session deep link without loading the previous session’s plan',async()=>{
 const router=setup('/instructor/my-classes?session=a')
 await screen.findByRole('link',{name:/Plan Splash 1/})
 await act(async()=>{await router.navigate('/instructor/lesson-plans?session=b&class=class-b')})
 await screen.findByRole('button',{name:'Add activity'})
 expect(sessionStorage.getItem('instructor-session:staff')).toBe('b')
 expect(screen.getByRole('button',{name:'Splash 1 · b · 09:00 · Alex'})).toHaveAttribute('aria-pressed','true')
 expect(api.fetchLessonPlan).toHaveBeenCalledWith('b','class-b','2026-10-05')
 expect(api.fetchLessonPlan.mock.calls.every(([session])=>session==='b')).toBe(true)
})
it('shows an empty Home when no sessions are linked',async()=>{
 api.fetchInstructorSessions.mockResolvedValue({sessions:[]})
 setup()
 await screen.findByText(/No sessions are linked/)
 expect(api.fetchInstructorClasses).not.toHaveBeenCalled()
})
it('requires an initial choice and remembers it when opening My Classes',async()=>{
 const user=userEvent.setup();const router=setup()
 await screen.findByRole('button',{name:/Pool a/})
 expect(api.fetchInstructorClasses).not.toHaveBeenCalled()
 expect(screen.getByLabelText('Current session')).toHaveTextContent('No session selected')
 await user.click(screen.getByRole('button',{name:/Pool b/}))
 await screen.findByRole('link',{name:/Plan Splash 1/})
 expect(router.state.location.pathname).toBe('/instructor/my-classes')
 expect(sessionStorage.getItem('instructor-session:staff')).toBe('b')
})
it('groups weekdays and special sessions with deterministic same-day ordering',()=>{
 const make=(id:string,day:string,date:string|null)=>({...sessions[0],id,session_day:day,start_date:date})
 const groups=groupInstructorSessions([make('sun','Su',null),make('late','Monday','2026-11-01'),make('mini','Mini Session 1',null),make('early','Mo','2026-10-01'),make('multi','Mo,Tu,We,Th,Fr',null),make('other','Unknown',null),make('undated','Mo',null)])
 expect(groups.map(g=>g.label)).toEqual(['Monday','Sunday','Mo,Tu,We,Th,Fr','Mini Session 1','Unknown'])
 expect(groups[0].sessions.map(s=>s.id)).toEqual(['early','late','undated'])
})

it('matches supervisor session titles on Home, the sidebar, and My Classes',async()=>{
 api.fetchInstructorSessions.mockResolvedValue({sessions:[{...sessions[0],session_day:'Mo',session_start_time24:'16:00',session_end_time24:'20:00'}]})
 const user=userEvent.setup();setup()
 await user.click(await screen.findByRole('button',{name:/Monday Fall 2026 \| 4:00 PM-8:00 PM/}))
 await screen.findByRole('link',{name:/Plan Splash 1/})
 expect(screen.getByLabelText('Current session')).toHaveTextContent('Monday Fall 2026 | 4:00 PM-8:00 PM')
 expect(screen.getAllByText('Monday Fall 2026 | 4:00 PM-8:00 PM')).toHaveLength(2)
})

it('opens the activity library without sessions or linked classes',async()=>{
 api.fetchInstructorSessions.mockResolvedValue({sessions:[]})
 setup('/instructor/activity-library')
 expect(await screen.findByRole('heading',{name:'Activity Library'})).toBeVisible()
 await screen.findByText('No session selected')
 expect(screen.getByRole('searchbox')).toBeVisible()
 expect(screen.queryByRole('link',{name:'Choose a session'})).not.toBeInTheDocument()
 expect(api.fetchInstructorClasses).not.toHaveBeenCalled()
})

it.each([
 ['2026-10-01T12:00:00Z','2026-10-05'],
 ['2026-10-05T03:59:00Z','2026-10-05'],
 ['2026-10-05T04:00:00Z','2026-10-05'],
 ['2026-10-06T12:00:00Z','2026-10-12'],
 ['2026-10-20T12:00:00Z','2026-10-26'],
 ['2026-11-01T12:00:00Z','2026-10-26'],
])('defaults to the next session week in Toronto at %s', (now,expected)=>{
 expect(closestUpcomingWeek(['2026-10-05','2026-10-12','2026-10-26'],new Date(now))).toBe(expected)
})
it('handles sessions without any weeks',()=>{
 expect(closestUpcomingWeek([],new Date('2026-10-05T12:00:00Z'))).toBe('')
})

it('opens the next week on Lesson Plans and Print',async()=>{
 vi.useFakeTimers({toFake:['Date']})
 vi.setSystemTime(new Date('2026-10-13T12:00:00Z'))
 try {
  api.fetchInstructorSessions.mockResolvedValue({sessions:[{...sessions[0],weeks:['2026-10-05','2026-10-12','2026-10-19']}]})
  const user=userEvent.setup();setup('/instructor/lesson-plans?session=a')
  await screen.findByRole('button',{name:'Add activity'})
  expect(screen.getByRole('status',{name:'Selected week'})).toHaveTextContent('Week 3 | 2026-10-19')
  expect(api.fetchLessonPlan).toHaveBeenCalledWith('a','class-a','2026-10-19')
  await user.click(screen.getByRole('link',{name:'Print'}))
  expect(screen.getByRole('status',{name:'Selected week'})).toHaveTextContent('Week 3 | 2026-10-19')
 } finally {vi.useRealTimers()}
})

it('steps through session weeks within their bounds and guards picker changes with unsaved drafts',async()=>{
 vi.useFakeTimers({toFake:['Date']})
 vi.setSystemTime(new Date('2026-10-01T12:00:00Z'))
 try {
 const weeks=['2026-10-05','2026-10-12','2026-10-19','2026-10-26','2026-11-02','2026-11-09']
 api.fetchInstructorSessions.mockResolvedValue({sessions:[{...sessions[0],weeks}]})
 api.fetchInstructorClasses.mockResolvedValue({classes:[course('a'),{...course('a'),id:'second',code:'second',level:'Splash 2A'}]})
 const user=userEvent.setup();setup('/instructor/lesson-plans?session=a&class=second')
 await screen.findByRole('button',{name:'Add activity'})
 const previous=screen.getByRole('button',{name:'Previous week'})
 const next=screen.getByRole('button',{name:'Next week'})
 expect(previous).toBeDisabled()
 expect(screen.getByRole('status',{name:'Selected week'})).toHaveTextContent(`Week 1 | ${weeks[0]}`)
 const firstClass=screen.getByRole('button',{name:'Splash 1 · a · 09:00 · Alex'})
 const secondClass=screen.getByRole('button',{name:'Splash 2A · second · 09:00 · Alex'})
 expect(secondClass).toHaveAttribute('aria-pressed','true')
 for(let i=1;i<weeks.length;i++){
  await user.click(next)
  await waitFor(()=>expect(api.fetchLessonPlan).toHaveBeenLastCalledWith('a','second',weeks[i]))
 }
 expect(next).toBeDisabled()
 expect(previous).toBeEnabled()
 await waitFor(()=>expect(api.fetchLessonPlan).toHaveBeenLastCalledWith('a','second',weeks[5]))
 await user.click(await screen.findByRole('button',{name:'Add activity'}))
 const confirm=vi.spyOn(window,'confirm').mockReturnValue(false)
 await user.click(previous)
 await user.click(firstClass)
 expect(screen.getByRole('status',{name:'Selected week'})).toHaveTextContent(`Week 6 | ${weeks[5]}`)
 expect(secondClass).toHaveAttribute('aria-pressed','true')
 expect(screen.getByLabelText('Activity / drill 1')).toBeInTheDocument()
 await user.click(secondClass)
 expect(confirm).toHaveBeenCalledTimes(2)
 confirm.mockReturnValue(true)
 await user.click(firstClass)
 await waitFor(()=>expect(api.fetchLessonPlan).toHaveBeenLastCalledWith('a','class-a',weeks[5]))
 expect(firstClass).toHaveAttribute('aria-pressed','true')
 expect(screen.queryByLabelText('Activity / drill 1')).not.toBeInTheDocument()
 await user.click(previous)
 await waitFor(()=>expect(api.fetchLessonPlan).toHaveBeenLastCalledWith('a','class-a',weeks[4]))
 expect(screen.getByRole('status',{name:'Selected week'})).toHaveTextContent(`Week 5 | ${weeks[4]}`)
 } finally {vi.useRealTimers()}
})

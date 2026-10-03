import { render,screen,waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter,RouterProvider } from 'react-router-dom'
import {beforeEach,expect,it,vi} from 'vitest'
import {LessonEditor} from './LessonPlans'
const api=vi.hoisted(()=>({fetchLessonPlan:vi.fn(),saveLessonPlan:vi.fn()}))
vi.mock('../../lib/serverApi',()=>api)
beforeEach(()=>{api.fetchLessonPlan.mockReset().mockResolvedValue({plan:null});api.saveLessonPlan.mockReset()})
function setup(){return render(<RouterProvider router={createMemoryRouter([{path:'/',element:<LessonEditor sessionId="s" classId="c" week="2026-10-05"/>}])}/>)}
it('keeps untouched plans null and retains drafts on save failure',async()=>{
 const user=userEvent.setup();setup()
 await screen.findByText(/No lesson plan saved/)
 expect(api.saveLessonPlan).not.toHaveBeenCalled()
 await user.click(screen.getByRole('button',{name:'Add activity'}))
 await user.type(screen.getByLabelText('Skill 1'),'Floating')
 api.saveLessonPlan.mockRejectedValueOnce(new Error('Offline'))
 await user.click(screen.getByRole('button',{name:'Save'}))
 expect(await screen.findByRole('alert')).toHaveTextContent('Your draft is retained')
 expect(screen.getByLabelText('Skill 1')).toHaveValue('Floating')
 api.saveLessonPlan.mockImplementation(async(_s,_c,_w,rows)=>({plan:{rows}}))
 await user.click(screen.getByRole('button',{name:'Save'}))
 expect(await screen.findByText('Lesson plan saved.')).toBeVisible()
 expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument()
})
it('reorders and removes rows before explicit save',async()=>{
 api.fetchLessonPlan.mockResolvedValue({plan:{rows:[{skill:'First',activity:'A',location:'Lane',duration:5},{skill:'Second',activity:'B',location:'Deep end',duration:10}]}})
 const user=userEvent.setup();setup();await screen.findByLabelText('Skill 1')
 await user.click(screen.getByRole('button',{name:'Move row 2 up'}))
 expect(screen.getByLabelText('Skill 1')).toHaveValue('Second')
 await user.click(screen.getByRole('button',{name:'Delete row 2'}))
 api.saveLessonPlan.mockImplementation(async(_s,_c,_w,rows)=>({plan:{rows}}))
 await user.click(screen.getByRole('button',{name:'Save'}))
 await waitFor(()=>expect(api.saveLessonPlan).toHaveBeenCalledWith('s','c','2026-10-05',[{skill:'Second',activity:'B',location:'Deep end',duration:10}]))
})

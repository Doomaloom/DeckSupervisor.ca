import {render,screen} from '@testing-library/react'
import {expect,it,vi} from 'vitest'
import {SavedPlanPrint} from './PrintPlans'
const api=vi.hoisted(()=>({fetchLessonPlan:vi.fn().mockResolvedValue({plan:null}),saveLessonPlan:vi.fn()}))
vi.mock('../../lib/serverApi',()=>api)
it('missing saved plans have no print controls and cause no writes',async()=>{
 render(<SavedPlanPrint session={{id:'s'} as any} course={{id:'c'} as any} week="2026-10-05"/>)
 expect(await screen.findByText(/No saved lesson plan/)).toBeVisible()
 expect(screen.queryByRole('button',{name:'Print PDF'})).not.toBeInTheDocument()
 expect(api.saveLessonPlan).not.toHaveBeenCalled()
})

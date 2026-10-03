import {render,screen} from '@testing-library/react'
import {expect,it,vi} from 'vitest'
import SchematicPage from './SchematicPage'
const state=vi.hoisted(()=>({owner:'owner'}))
vi.mock('../../app/AuthContext',()=>({useAuth:()=>({accountType:'full_time',user:{id:'owner'}})}))
vi.mock('../../app/DayContext',()=>({useDay:()=>({selectedDay:'Mo',setSelectedDay:vi.fn()})}))
vi.mock('../../app/useCurrentSession',()=>({useCurrentSession:()=>({access:{mode:'none'},session:null})}))
vi.mock('../../app/useCurrentTeam',()=>({useCurrentTeam:()=>({currentTeam:{name:'Synthetic team'},currentTeamId:'team'})}))
vi.mock('../../app/useCurrentTerm',()=>({useCurrentTerm:()=>({currentTerm:{label:'Fall 2026'}})}))
vi.mock('./hooks/useSchematicSchedule',()=>({useSchematicSchedule:()=>({})}))
vi.mock('./hooks/useFullTimeSchematicView',()=>({useFullTimeSchematicView:()=>({selectedDay:'Mo',days:[],locationOptions:[],termSessions:[{}],selectedSession:{id:'selected-session',created_by:state.owner},hasDbSchematic:false})}))
vi.mock('./components/AccountLinks',()=>({default:({sessionId}: {sessionId:string})=><div>Link controls for {sessionId}</div>}))
it('shows account link controls for full-time session owners',()=>{
 state.owner='owner';render(<SchematicPage/>);expect(screen.getByText('Link controls for selected-session')).toBeVisible()
})
it('preserves full-time view-only privileges for other owners’ sessions',()=>{
 state.owner='other-owner';render(<SchematicPage/>);expect(screen.queryByText('Link controls for selected-session')).not.toBeInTheDocument()
})

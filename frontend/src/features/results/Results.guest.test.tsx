// Completion-audit regression: guests are import-only and never reach the results APIs.
import {render,screen} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {expect,it,vi} from 'vitest';
import {SupervisorResults} from './Results.component';
import {session} from '../decksupervisor/DeviceExport/fixtures';
vi.mock('../../app/AuthContext',()=>({useAuth:()=>({isGuest:true,user:null})}));
vi.mock('../../app/useCurrentSession',()=>({useCurrentSession:()=>({session,sessionId:session.id,loading:false})}));
vi.mock('../instructor/session/InstructorSessionContext',()=>({useInstructorSession:()=>({session:null,sessionId:'',loading:false})}));
it('shows guests the import-only notice on /results without requesting results, identities or grants',()=>{
 const fetchSpy=vi.fn();vi.stubGlobal('fetch',fetchSpy);
 render(<MemoryRouter><SupervisorResults/></MemoryRouter>);
 expect(screen.getByText('Guest packages are import-only. Sign in to review submitted results.')).toBeVisible();
 expect(screen.queryByText('Attendance and results')).not.toBeInTheDocument();
 expect(fetchSpy).not.toHaveBeenCalled();
});

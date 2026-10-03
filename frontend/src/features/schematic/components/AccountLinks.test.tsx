import {render,screen,waitFor} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {expect,it,vi} from 'vitest'
import AccountLinks from './AccountLinks'
const api=vi.hoisted(()=>({fetchInstructorAssignments:vi.fn(),linkInstructorAssignment:vi.fn()}))
vi.mock('../../../lib/serverApi',()=>api)
it('refreshes the displayed account after unlink without deleting class plans',async()=>{
 api.fetchInstructorAssignments.mockResolvedValueOnce({assignments:[{id:'id',name:'Alex',account_id:'account-a'}]}).mockResolvedValue({assignments:[{id:'id',name:'Alex',account_id:null}]})
 api.linkInstructorAssignment.mockResolvedValue({assignments:[]})
 const user=userEvent.setup();render(<AccountLinks sessionId="session-a"/>)
 expect(await screen.findByLabelText('Account UUID for Alex')).toHaveValue('account-a')
 await user.click(screen.getByRole('button',{name:'Unlink',exact:true}))
 await waitFor(()=>expect(screen.getByLabelText('Account UUID for Alex')).toHaveValue(''))
 expect(api.linkInstructorAssignment).toHaveBeenCalledWith('session-a','id',null)
})

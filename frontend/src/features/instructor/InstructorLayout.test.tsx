import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import InstructorLayout from './InstructorLayout'
const auth=vi.hoisted(()=>({user:{id:'staff'},loading:false,workflowCapabilities:{instructor:true,supervisor:true},signOut:vi.fn()}))
vi.mock('../../app/AuthContext',()=>({useAuth:()=>auth}))
beforeEach(()=>{auth.user={id:'staff'};auth.workflowCapabilities={instructor:true,supervisor:true}})
it('offers four instructor destinations and an authorized return above logout',()=>{
 render(<MemoryRouter><InstructorLayout><p>Class content</p></InstructorLayout></MemoryRouter>)
 expect(screen.getByRole('link',{name:'My Classes'})).toHaveAttribute('href','/instructor')
 for(const label of ['Lesson Plans','Attendance','Print','Supervisor View'])expect(screen.getByRole('link',{name:label})).toBeVisible()
 expect(screen.getByRole('button',{name:'Logout'})).toBeVisible()
})
it('denies workflows when the account lacks capability',()=>{
 auth.workflowCapabilities={instructor:false,supervisor:false}
 render(<MemoryRouter><InstructorLayout><p>Private class content</p></InstructorLayout></MemoryRouter>)
 expect(screen.queryByText('Private class content')).not.toBeInTheDocument()
 expect(screen.getByText('Instructor access unavailable')).toBeVisible()
})

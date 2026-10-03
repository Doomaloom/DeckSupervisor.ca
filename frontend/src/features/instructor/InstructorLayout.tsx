import type { ReactNode } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../app/AuthContext'

export default function InstructorLayout({children}: {children: ReactNode}) {
 const {user,loading,workflowCapabilities,signOut}=useAuth()
 const navigate=useNavigate()
 if(loading)return <p role="status">Loading account…</p>
 if(!user)return <main className="p-6"><h1>Sign in to Instructor View</h1><Link to="/sign-in">Sign in</Link></main>
 if(!workflowCapabilities.instructor)return <main className="p-6"><h1>Instructor access unavailable</h1><Link to="/account">Account</Link></main>
 return <div className="min-h-screen bg-bg text-secondary md:flex">
 <aside className="flex flex-col gap-4 bg-primary p-5 text-accent md:min-h-screen md:w-64">
 <h1 className="text-xl font-semibold">Instructor View</h1>
 <nav aria-label="Instructor navigation" className="flex flex-wrap gap-3 md:flex-col">
 {['My Classes','Lesson Plans','Attendance','Print'].map((label,i)=><NavLink className={({isActive})=>isActive?'font-bold underline':'hover:underline'} key={label} end to={['/instructor','/instructor/lesson-plans','/instructor/attendance','/instructor/print'][i]}>{label}</NavLink>)}
 </nav>
 <div className="mt-auto flex flex-col gap-3">
 {workflowCapabilities.supervisor && <Link to="/">Supervisor View</Link>}
 <button className="text-left" onClick={async()=>{await signOut();navigate('/sign-in')}}>Logout</button>
 </div>
 </aside><main key={user.id} className="min-w-0 flex-1 p-4 md:p-8">{children}</main>
 </div>
}

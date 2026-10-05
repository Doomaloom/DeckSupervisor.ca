import { Card, PageShell } from '../../general-components'
import { BookOpenIcon, HomeIcon, CalendarDaysIcon, ClipboardDocumentListIcon, UsersIcon, PrinterIcon } from '@heroicons/react/24/outline'
import { useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../app/AuthContext'
import { InstructorSessionProvider, useInstructorSession } from './InstructorSessionContext'
import { sessionLabel } from './useInstructorClasses'

export default function InstructorLayout({children}: {children: ReactNode}) {
 const {user,loading,workflowCapabilities}=useAuth()
 if(loading)return <PageShell className="p-6"><Card role="status">Loading account…</Card></PageShell>
 if(!user)return <main className="p-6"><PageShell maxWidth="xl"><Card><h1 className="mb-4 text-xl font-semibold">Sign in to Instructor View</h1><Link to="/sign-in">Sign in</Link></Card></PageShell></main>
 if(!workflowCapabilities.instructor)return <main className="p-6"><PageShell maxWidth="xl"><Card><h1 className="mb-4 text-xl font-semibold">Instructor access unavailable</h1><Link to="/account">Account</Link></Card></PageShell></main>
 return <InstructorSessionProvider key={user!.id}><InstructorWorkspace>{children}</InstructorWorkspace></InstructorSessionProvider>
}

function InstructorWorkspace({children}: {children: ReactNode}) {
 const {user,workflowCapabilities,signOut}=useAuth()
 const navigate=useNavigate()
 const [dirty,setDirty]=useState(false)
 const state=useInstructorSession()
 const location=useLocation()
 const session=state.session
 useEffect(()=>{const listener=(e: Event)=>setDirty((e as CustomEvent<boolean>).detail);window.addEventListener('instructor-draft',listener);return()=>window.removeEventListener('instructor-draft',listener)},[])
 return <div className="min-h-screen bg-bg text-secondary md:flex md:h-screen md:overflow-hidden">
 <aside className="flex shrink-0 flex-col gap-6 bg-primary p-6 text-accent md:h-screen md:w-72 md:overflow-y-auto">
 <div className="flex flex-col gap-1.5"><Link to="/instructor" className="text-[1.2rem] font-semibold leading-tight text-accent">DeckSupervisor.ca</Link><h1 className="text-[0.95rem] opacity-80">Instructor View</h1></div>
 <div className="flex min-w-0 flex-col gap-2">
 <h3 className="text-[0.95rem] font-semibold">Current Session</h3>
 <div className="w-full break-words rounded-2xl border border-secondary/30 bg-accent px-4 py-2 text-sm text-secondary" aria-label="Current session">
 {state.sessionsLoading ? 'Loading sessions…' : session ? sessionLabel(session) : 'No session selected'}
 </div>
 {location.pathname!=='/instructor' && state.sessionError && <div role="alert" className="text-sm">{state.sessionError} <button type="button" className="underline" onClick={()=>{if(dirty && !window.confirm('Discard unsaved lesson plan changes?'))return;setDirty(false);state.refresh()}}>Retry sessions</button></div>}
 </div>
 <nav aria-label="Instructor navigation" className="flex flex-wrap gap-3 md:flex-col">
 {['Home','My Classes','Lesson Plans','Activity Library','Attendance','Print'].map((label,i)=><NavLink className={({isActive})=>`flex items-center gap-2 rounded-[10px] px-3 py-2 transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${isActive?'bg-accent font-semibold text-secondary':'bg-white/10 text-accent hover:bg-hover hover:text-secondary'}`} key={label} end to={['/instructor','/instructor/my-classes','/instructor/lesson-plans','/instructor/activity-library','/instructor/attendance','/instructor/print'][i]}>{[HomeIcon, CalendarDaysIcon,ClipboardDocumentListIcon,BookOpenIcon,UsersIcon,PrinterIcon].map((Icon,index)=>index===i?<Icon key={index} className="h-5 w-5 shrink-0" aria-hidden="true"/>:null)}{label}</NavLink>)}
 </nav>
 <div className="mt-auto flex flex-col gap-3">
 {workflowCapabilities.supervisor && <Link className="rounded-2xl bg-white/10 px-4 py-2 text-center text-sm font-semibold transition hover:bg-accent hover:text-secondary" to="/">Supervisor View</Link>}
 <button type="button" className="rounded-2xl border border-white/40 px-4 py-2 text-sm font-semibold text-accent transition hover:bg-accent hover:text-secondary" onClick={async()=>{if(dirty && !window.confirm('Discard unsaved lesson plan changes and log out?'))return;await signOut();navigate('/sign-in')}}>Logout</button>
 </div>
 </aside><main key={user!.id} className="min-w-0 flex-1 p-4 md:overflow-y-auto md:p-8">{location.pathname!=='/instructor' && location.pathname!=='/instructor/activity-library' && !state.sessionId ? <PageShell><Card>{state.sessionsLoading ? <p role="status">Loading sessions…</p> : <Link to="/instructor" className="font-semibold underline">Choose a session</Link>}</Card></PageShell> : children}</main>
 </div>
}

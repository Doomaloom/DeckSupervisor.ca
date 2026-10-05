import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../app/AuthContext'
import { fetchInstructorSessions, fetchInstructorClasses, type InstructorSession, type InstructorClass } from '../../lib/serverApi'

function useSessionState() {
 const {user}=useAuth()
 const location=useLocation()
 const navigate=useNavigate()
 const [sessions,setSessions]=useState<InstructorSession[]>([])
 const [sessionId,setSessionId]=useState('')
 const [classes,setClasses]=useState<InstructorClass[]>([])
 const [sessionsLoading,setSessionsLoading]=useState(true)
 const [classesLoading,setClassesLoading]=useState(false)
 const [classesForSession,setClassesForSession]=useState('')
 const [sessionError,setSessionError]=useState('')
 const [classError,setClassError]=useState('')
 const [retry,setRetry]=useState(0)
 const processedLocation=useRef('')
 const syncUrl=useRef(false)
 const requestedSession=new URLSearchParams(location.search).get('session')
 const initialSession=useRef(requestedSession)

 useEffect(()=>{
  let active=true
  setSessionsLoading(true);setSessionError('')
  fetchInstructorSessions().then(r=>{
   if(!active)return
   setSessions(r.sessions)
   setSessionId(current=>{
    const preferred=current || initialSession.current || sessionStorage.getItem(`instructor-session:${user!.id}`)
    return r.sessions.some(s=>s.id===preferred)?preferred!:r.sessions[0]?.id||''
   })
   setSessionsLoading(false)
  }).catch(e=>{if(active){setSessionError(e.message);setSessionsLoading(false)}})
  return()=>{active=false}
 },[user!.id,retry])

 // Apply a deep link once per navigation, rather than restoring its session on every render.
 useEffect(()=>{
  if(sessionsLoading || sessionError || processedLocation.current===location.key)return
  processedLocation.current=location.key
  if(requestedSession && sessions.some(s=>s.id===requestedSession) && requestedSession!==sessionId){
   setClasses([]);setSessionId(requestedSession)
  }
 },[location.key,requestedSession,sessions,sessionsLoading,sessionError,sessionId])

 useEffect(()=>{
  if(sessionId)sessionStorage.setItem(`instructor-session:${user!.id}`,sessionId)
 },[sessionId,user!.id])

 useEffect(()=>{
  let active=true
  setClasses([]);setClassError('')
  if(!sessionId || sessionsLoading || sessionError){setClassesLoading(false);return}
  setClassesLoading(true)
  fetchInstructorClasses(sessionId).then(r=>{if(active){setClasses(r.classes);setClassesForSession(sessionId);setClassesLoading(false)}})
   .catch(e=>{if(active){setClassError(e.message);setClassesForSession(sessionId);setClassesLoading(false)}})
  return()=>{active=false}
 },[sessionId,sessionsLoading,sessionError])

 // The previous editor has unmounted before replacing a stale deep-link URL.
 useEffect(()=>{
  if(!syncUrl.current)return
  syncUrl.current=false
  const params=new URLSearchParams(location.search)
  if(!params.has('session'))return
  params.set('session',sessionId);params.delete('class')
  navigate({pathname:location.pathname,search:`?${params}`,hash:location.hash},{replace:true})
 },[sessionId,location,navigate])

 function selectSession(id: string){
  if(id===sessionId || !sessions.some(s=>s.id===id))return
  setClasses([]);setClassesLoading(true);setSessionId(id);syncUrl.current=true
 }
 const changingFromLink=processedLocation.current!==location.key && !!requestedSession &&
  requestedSession!==sessionId && sessions.some(s=>s.id===requestedSession)
 return {sessions,sessionId,classes,sessionsLoading,sessionError,
  loading:sessionsLoading || classesLoading || changingFromLink || (!!sessionId && classesForSession!==sessionId && !sessionError),
  error:sessionError || classError,selectSession,refresh:()=>setRetry(v=>v+1),session:sessions.find(s=>s.id===sessionId)}
}

const InstructorSessionContext=createContext<ReturnType<typeof useSessionState>|null>(null)
export function InstructorSessionProvider({children}: {children: ReactNode}) {
 const state=useSessionState()
 return <InstructorSessionContext.Provider value={state}>{children}</InstructorSessionContext.Provider>
}
export function useInstructorSession() {
 const state=useContext(InstructorSessionContext)
 if(!state)throw new Error('Instructor session requires InstructorSessionProvider')
 return state
}

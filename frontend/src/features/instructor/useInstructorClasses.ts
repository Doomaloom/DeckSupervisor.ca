import { useEffect, useState } from 'react'
import { useAuth } from '../../app/AuthContext'
import { fetchInstructorSessions,fetchInstructorClasses,type InstructorSession,type InstructorClass } from '../../lib/serverApi'

export function sessionLabel(s: InstructorSession) {
 return [s.session_day,s.session_season,s.session_year,s.location,s.start_date,s.end_date].filter(Boolean).join(' · ')
}
export default function useInstructorClasses() {
 const {user}=useAuth()
 const [sessions,setSessions]=useState<InstructorSession[]>([])
 const [sessionId,setSessionId]=useState('')
 const [classes,setClasses]=useState<InstructorClass[]>([])
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState('')
 const [retry,setRetry]=useState(0)
 useEffect(()=>{
  let active=true;setSessions([]);setSessionId('');setClasses([]);setError('');setLoading(true)
  if(!user){setLoading(false);return}
  fetchInstructorSessions().then(r=>{if(active){setSessions(r.sessions);const stored=sessionStorage.getItem(`instructor-session:${user.id}`);setSessionId(r.sessions.some(s=>s.id===stored)?stored!:r.sessions[0]?.id||'');if(!r.sessions.length)setLoading(false)}}).catch(e=>{if(active){setError(e.message);setLoading(false)}})
  return()=>{active=false}
 },[user?.id,retry])
 useEffect(()=>{
  let active=true;setClasses([])
  if(!sessionId)return
  setLoading(true);setError('')
  fetchInstructorClasses(sessionId).then(r=>{if(active){setClasses(r.classes);setLoading(false)}}).catch(e=>{if(active){setError(e.message);setLoading(false)}})
  return()=>{active=false}
 },[user?.id,sessionId])
 function selectSession(id: string){setClasses([]);setSessionId(id);if(user)sessionStorage.setItem(`instructor-session:${user.id}`,id)}
 return {sessions,sessionId,classes,loading,error,selectSession,refresh:()=>setRetry(v=>v+1),session:sessions.find(s=>s.id===sessionId)}
}

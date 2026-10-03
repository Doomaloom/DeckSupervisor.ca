import {useEffect,useState} from 'react'
import {Link,useNavigate,useSearchParams} from 'react-router-dom'
import {passwordRecoveryStatus,resetRecoveredPassword,verifyPasswordRecovery} from '../../lib/authClient'
const invalid='This recovery link is invalid, expired, or already used. Request another reset email.'
export default function ResetPasswordPage(){
 const [params]=useSearchParams(),navigate=useNavigate()
 const hash=params.get('token_hash')||''
 const [password,setPassword]=useState(''),[confirm,setConfirm]=useState(''),[error,setError]=useState('')
 const [verified,setVerified]=useState(false),[busy,setBusy]=useState(false),[checking,setChecking]=useState(!hash)
 useEffect(()=>{
  let active=true
  if(hash){setChecking(false);if(params.get('type') && params.get('type')!=='recovery')setError(invalid);return}
  if(verified){setChecking(false);return}
  passwordRecoveryStatus().then(()=>{if(active)setVerified(true)}).catch(()=>{if(active)setError(invalid)}).finally(()=>{if(active)setChecking(false)})
  return()=>{active=false}
 },[hash,params,verified])
 return <main className="mx-auto flex max-w-xl flex-col gap-4 rounded-card border bg-accent p-6 text-secondary">
 <h1 className="text-2xl font-semibold">Reset password</h1><p>Set and confirm a new password that meets your account's password requirements.</p>
 {checking?<p role="status">Checking recovery session…</p>:<form className="flex flex-col gap-4" onSubmit={async e=>{
  e.preventDefault();setError('')
  if(password!==confirm){setError('Passwords must match.');return}
  setBusy(true)
  try{
   if(!verified){if(!hash || (params.get('type') && params.get('type')!=='recovery'))throw new Error(invalid);await verifyPasswordRecovery(hash);setVerified(true);navigate('/reset-password',{replace:true})}
   await resetRecoveredPassword(password,confirm);navigate('/sign-in?reset=success',{replace:true})
  }catch(e){setError(e instanceof Error?e.message:invalid)}finally{setBusy(false)}
 }}>
 <label>New password <input className="w-full rounded border p-2" type="password" autoComplete="new-password" minLength={6} maxLength={1024} required value={password} onChange={e=>setPassword(e.target.value)}/></label>
 <label>Confirm password <input className="w-full rounded border p-2" type="password" autoComplete="new-password" minLength={6} maxLength={1024} required value={confirm} onChange={e=>setConfirm(e.target.value)}/></label>
 <button className="rounded bg-primary p-3 text-white" disabled={busy}>{busy?'Resetting…':'Reset password'}</button>
 </form>}
 {error && <p role="alert">{error}</p>}
 <Link to="/forgot-password">Request another reset email</Link><Link to="/sign-in">Back to sign in</Link>
 </main>
}

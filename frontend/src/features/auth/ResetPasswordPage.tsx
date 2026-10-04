import { PageShell, Card, Notice, TextInput, ActionButton } from '../../general-components'
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
 return <PageShell maxWidth="xl"><Card className="flex flex-col gap-4">
 <h1 className="text-xl font-semibold">Reset password</h1><p>Set and confirm a new password that meets your account's password requirements.</p>
 {checking?<p role="status">Checking recovery session…</p>:<form className="flex flex-col gap-4" onSubmit={async e=>{
  e.preventDefault();setError('')
  if(password!==confirm){setError('Passwords must match.');return}
  setBusy(true)
  try{
   if(!verified){if(!hash || (params.get('type') && params.get('type')!=='recovery'))throw new Error(invalid);await verifyPasswordRecovery(hash);setVerified(true);navigate('/reset-password',{replace:true})}
   await resetRecoveredPassword(password,confirm);navigate('/sign-in?reset=success',{replace:true})
  }catch(e){setError(e instanceof Error?e.message:invalid)}finally{setBusy(false)}
 }}>
 <label className="flex flex-col gap-2 text-sm font-semibold">New password <TextInput className="w-full" type="password" autoComplete="new-password" minLength={6} maxLength={1024} required value={password} onChange={e=>setPassword(e.target.value)}/></label>
 <label className="flex flex-col gap-2 text-sm font-semibold">Confirm password <TextInput className="w-full" type="password" autoComplete="new-password" minLength={6} maxLength={1024} required value={confirm} onChange={e=>setConfirm(e.target.value)}/></label>
 <ActionButton type="submit" variant="primary"  disabled={busy}>{busy?'Resetting…':'Reset password'}</ActionButton>
 </form>}
 {error && <Notice tone="danger" role="alert">{error}</Notice>}
 <Link className="text-sm font-semibold text-secondary/70 transition hover:text-secondary" to="/forgot-password">Request another reset email</Link><Link className="text-sm font-semibold text-secondary/70 transition hover:text-secondary" to="/sign-in">Back to sign in</Link>
 </Card></PageShell>
}

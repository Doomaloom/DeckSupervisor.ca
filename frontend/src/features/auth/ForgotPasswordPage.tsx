import {useState} from 'react'
import {Link} from 'react-router-dom'
import {requestPasswordRecovery} from '../../lib/authClient'
export default function ForgotPasswordPage(){
 const [email,setEmail]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('')
 return <main className="mx-auto flex max-w-xl flex-col gap-4 rounded-card border bg-accent p-6 text-secondary">
 <h1 className="text-2xl font-semibold">Forgot password?</h1><p>Enter your email to request a password reset link.</p>
 <form className="flex flex-col gap-4" onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');setMessage('');try{const result=await requestPasswordRecovery(email.trim());setMessage(result.message||'If an account exists for that email, you will receive a password reset link.')}catch(e){setError(e instanceof Error?e.message:'Unable to request reset.')}finally{setBusy(false)}}}>
 <label>Email <input className="w-full rounded border p-2" type="email" autoComplete="email" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)}/></label>
 <button className="rounded bg-primary p-3 text-white" disabled={busy}>{busy?'Requesting…':'Send reset link'}</button>
 </form>{message && <p role="status">{message}</p>}{error && <p role="alert">{error}</p>}<Link to="/sign-in">Back to sign in</Link>
 </main>
}

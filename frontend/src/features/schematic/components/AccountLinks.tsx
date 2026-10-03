import { useEffect, useState } from 'react'
import { fetchInstructorAssignments, linkInstructorAssignment, type InstructorAssignment } from '../../../lib/serverApi'

export default function AccountLinks({sessionId}: {sessionId: string}) {
 const [rows,setRows]=useState<InstructorAssignment[]>([])
 const [error,setError]=useState('')
 const [version,setVersion]=useState(0)
 useEffect(()=>{let active=true;setRows([]);setError('');fetchInstructorAssignments(sessionId).then(r=>{if(active)setRows(r.assignments)}).catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[sessionId,version])
 return <section className="rounded-card border p-4" aria-label="Instructor account links">
 <h2>Instructor account links</h2><p>Save the schedule first, then link each column to a staff account UUID. Names do not grant access. Unlinking preserves lesson plans.</p>
 <button onClick={()=>setVersion(v=>v+1)}>Refresh saved columns</button>
 {error && <p role="alert">{error}</p>}
 {rows.map(row=><form key={row.id} className="my-3 flex flex-wrap gap-3" onSubmit={async e=>{e.preventDefault();const form=new FormData(e.currentTarget);try {await linkInstructorAssignment(sessionId,row.id,String(form.get('account')||'').trim()||null);setVersion(v=>v+1)}catch(e){setError(e instanceof Error?e.message:'Link failed')}}}>
 <label>{row.name || 'Unnamed instructor'} <input name="account" aria-label={`Account UUID for ${row.name || row.id}`} defaultValue={row.account_id||''} className="border p-2" placeholder="Staff account UUID" /></label>
 <button type="submit">Save link</button><button type="button" onClick={async()=>{try{await linkInstructorAssignment(sessionId,row.id,null);setVersion(v=>v+1)}catch(e){setError(e instanceof Error?e.message:'Unlink failed')}}}>Unlink</button>
 </form>)}
 {!rows.length && !error && <p>No saved columns. Save this schematic and refresh.</p>}
 </section>
}

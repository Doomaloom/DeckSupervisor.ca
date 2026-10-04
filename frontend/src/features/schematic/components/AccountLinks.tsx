import { Notice, EmptyState, TextInput, ActionButton } from '../../../general-components'
import { useEffect, useState } from 'react'
import { fetchInstructorAssignments, linkInstructorAssignment, type InstructorAssignment } from '../../../lib/serverApi'

export default function AccountLinks({sessionId}: {sessionId: string}) {
 const [rows,setRows]=useState<InstructorAssignment[]>([])
 const [error,setError]=useState('')
 const [version,setVersion]=useState(0)
 useEffect(()=>{let active=true;setRows([]);setError('');fetchInstructorAssignments(sessionId).then(r=>{if(active)setRows(r.assignments)}).catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[sessionId,version])
 return <section className="rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md" aria-label="Instructor account links">
 <h2 className="text-xl font-semibold">Instructor account links</h2><p className="my-3 text-sm text-secondary/70">Save the schedule first, then link each column to a staff account UUID. Names do not grant access. Unlinking preserves lesson plans.</p>
 <ActionButton onClick={()=>setVersion(v=>v+1)}>Refresh saved columns</ActionButton>
 {error && <Notice tone="danger" role="alert">{error}</Notice>}
 {rows.map(row=><form key={`${row.id}:${row.account_id ?? 'unlinked'}`} className="my-4 flex flex-wrap items-end gap-3 rounded-2xl border border-secondary/20 bg-bg p-4" onSubmit={async e=>{e.preventDefault();const form=new FormData(e.currentTarget);try {await linkInstructorAssignment(sessionId,row.id,String(form.get('account')||'').trim()||null);setVersion(v=>v+1)}catch(e){setError(e instanceof Error?e.message:'Link failed')}}}>
 <label className="flex min-w-0 flex-1 flex-col gap-2 text-sm font-semibold">{row.name || 'Unnamed instructor'} <TextInput className="w-full" name="account" aria-label={`Account UUID for ${row.name || row.id}`} defaultValue={row.account_id||''}  placeholder="Staff account UUID" /></label>
 <ActionButton type="submit">Save link</ActionButton><ActionButton variant="outline" type="button" onClick={async()=>{try{await linkInstructorAssignment(sessionId,row.id,null);setVersion(v=>v+1)}catch(e){setError(e instanceof Error?e.message:'Unlink failed')}}}>Unlink</ActionButton>
 </form>)}
 {!rows.length && !error && <EmptyState>No saved columns. Save this schematic and refresh.</EmptyState>}
 </section>
}

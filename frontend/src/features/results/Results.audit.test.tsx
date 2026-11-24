// Completion-audit regressions. Unlike Results.test.tsx these leave lib/resultsApi unmocked and
// intercept fetch, so every assertion is made against the real request the browser would send.
import {render,screen,waitFor,within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {beforeEach,expect,it,vi} from 'vitest';
import {webcrypto} from 'node:crypto';
import {ResultsView} from './Results.component';
import curriculum from './curriculum.json';
import {session,classes,students} from '../decksupervisor/DeviceExport/fixtures';
import {buildCourses,type ExportCourse} from '../decksupervisor/DeviceExport/services/exportPackage';
import {loadRegistry} from '../decksupervisor/DeviceExport/services/exportStorage';
import {courseSourceId,studentMatchKey} from '../decksupervisor/DeviceExport/services/resultRegistry';
import {installLocalStorage} from '../../test/storage';
import {setStorageScope} from '../../lib/storageScope';
import {COMPLETED_PRINT_CURRICULUM_VERSION} from '../../shared/attendance-print/completedAttendance';
import type {ResultRecord,ResultRegistry,Results,ResultGrant} from '../../lib/resultsApi';

const mocks=vi.hoisted(()=>({roster:vi.fn(),popup:vi.fn(),print:vi.fn(),cards:vi.fn()}));
vi.mock('../decksupervisor/DeviceExport/services/loadExportCourses',()=>({loadExportCourses:mocks.roster}));
vi.mock('../../shared/attendance-print/openAttendancePrintWindow',()=>({openAttendancePrintWindow:mocks.popup}));
vi.mock('../../shared/attendance-print/printAttendanceHtml',()=>({printAttendanceHtml:mocks.print}));
// Report cards use the real page builder with one synthetic card map; only the print dialog is replaced.
vi.mock('../../shared/report-cards/reportCards',async original=>{const real=await original<typeof import('../../shared/report-cards/reportCards')>();
 const map={level:'Splash1',images:{outside:'s1-outside.jpg',inside:'s1-inside.jpg'},fields:{participant:{page:'outside',x:70,y:72}},nextLevel:[{level:'Splash1',page:'outside',x:36,y:20},{level:'Splash2A',page:'outside',x:36,y:24}],criteria:{'Splash1:1:1':{page:'inside',x:4,y:13}}};
 return {...real,reportCardMap:(id:string)=>id==='Splash1'?map:undefined,printReportCards:mocks.cards};});

type Call={method:string;url:string;body?:any};
type Reply={status:number;body?:unknown;text?:string};
const DATE='2026-09-04',V=COMPLETED_PRINT_CURRICULUM_VERSION;
const sourceId=courseSourceId(session.id,'004201');
let course:ExportCourse,harroldKey:string,johnnyKey:string,oldJohnnyKey:string;
let calls:Call[],server:{registry:ResultRegistry|null;results:Results;grants:ResultGrant[];submit:(c:Call)=>Reply;resolve:(c:Call)=>Reply;afterReconcile:()=>void};
const sent=(method:string,suffix:string)=>calls.filter(c=>c.method===method&&c.url.endsWith(suffix));
const attempt=(over:Partial<ResultRecord>={}):ResultRecord=>({operationId:'original-op',sessionId:session.id,datasetId:'synthetic-dataset',classId:'class-one',enrollmentId:'enrollment-h',recordId:'attempt-one',kind:'attempt',action:'upsert',baseRevision:0,lessonDate:DATE,curriculumVersion:V,payload:{skillId:'LittleSplash1:1',createdAt:'2026-09-04T12:00:00Z',submittedAt:'2026-09-04T12:01:00Z',results:[{subskillId:'LittleSplash1:1:1',status:'successful'},{subskillId:'LittleSplash1:1:2',status:'not_yet'}]},revision:3,deleted:false,success:false,updatedAt:'2026-09-04T12:01:00Z',...over});
const results=(records:ResultRecord[],over:Partial<Results>={}):Results=>({schemaVersion:1,records,history:[],conflicts:[],...over});
const json=(r:Reply)=>new Response(r.status===204?null:r.text??JSON.stringify(r.body??{}),{status:r.status});

beforeEach(async()=>{
 vi.stubGlobal('crypto',webcrypto);installLocalStorage();localStorage.clear();setStorageScope('results-audit');
 course=buildCourses(session,classes,students).find(c=>c.code==='004201')!;
 const [harrold,johnny]=course.students.filter(s=>!s.waitlist);
 harroldKey=await studentMatchKey(sourceId,harrold);johnnyKey=await studentMatchKey(sourceId,johnny);oldJohnnyKey=await studentMatchKey(sourceId,{...johnny,name:'Jonny'});
 calls=[];
 server={registry:{schemaVersion:1,sessionId:session.id,datasetId:'synthetic-dataset',courses:[{sourceId,classId:'class-one',instructorId:'instructor-one',lessonDates:[DATE,'2026-09-11'],swimmers:[{sourceId:'source-h',enrollmentId:'enrollment-h',matchKey:harroldKey},{sourceId:'source-j',enrollmentId:'enrollment-j',matchKey:oldJohnnyKey}]}]},results:results([attempt()]),grants:[],submit:c=>({status:200,body:{schemaVersion:1,receipts:[{operationId:c.body.operations[0].operationId,status:'accepted',revision:4}]}}),resolve:()=>({status:200,body:{resolved:true}}),afterReconcile:()=>{}};
 vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
  const call:Call={method:init?.method??'GET',url:String(input),body:init?.body?JSON.parse(String(init.body)):undefined};calls.push(call);
  const {method,url}=call;
  if(url.endsWith('/result-identities')&&method==='GET')return json(server.registry?{status:200,body:server.registry}:{status:404,text:'not registered'});
  if(url.endsWith('/result-identities')&&method==='PUT'){server.afterReconcile();return json({status:200,body:call.body});}
  if(url.endsWith('/result-identities/reconcile')){server.afterReconcile();return json({status:200,body:{}});}
  // The page loads results per registered class (GET /results?classId=<id>); filter like result_snapshot's p_class.
  const byClass=/\/results\?classId=([^&]+)$/.exec(url);
  if(byClass&&method==='GET'){const c=decodeURIComponent(byClass[1]),all=server.results;return json({status:200,body:{...all,records:all.records.filter(r=>r.classId===c),conflicts:all.conflicts.filter(x=>x.operation.classId===c),history:all.history.filter(h=>h.record.classId===c)}});}
  if(url.endsWith('/results')&&method==='POST')return json(server.submit(call));
  if(url.endsWith('/resolve'))return json(server.resolve(call));
  if(url.endsWith('/result-grants'))return json({status:200,body:{grants:server.grants}});
  if(url.includes('/result-grants/')&&method==='DELETE')return json({status:204});
  return json({status:500,text:`unexpected ${method} ${url}`});
 }));
 mocks.roster.mockReset().mockImplementation(async()=>[course]);
 mocks.popup.mockReset().mockReturnValue({});mocks.print.mockReset().mockResolvedValue({status:'printed'});
});
const show=(supervisor=true)=>render(<ResultsView session={session} supervisor={supervisor}/>);
const personal=()=>[...course.students.flatMap(s=>[s.name,s.phone]),'Jonny'];
function expectNoPersonalData(){
 expect(calls.length).toBeGreaterThan(0);
 for(const c of calls){const wire=`${c.url} ${JSON.stringify(c.body??null)}`;for(const value of personal())expect(wire,`${c.method} ${c.url}`).not.toContain(value);expect(wire).not.toMatch(/"(name|phone|email|contact)"/i);}
}

it('never silently matches a changed signature: shows the fallback label until a supervisor reconciles to the existing enrollment',async()=>{
 server.results=results([attempt({recordId:'attempt-j',enrollmentId:'enrollment-j'})]);
 const user=userEvent.setup();show();
 expect(await screen.findByText('Unresolved student (enrollme)',{selector:'strong'})).toBeVisible();
 expect(screen.getByText('004201: Johnny — unresolved')).toBeVisible();
 expect(screen.queryByText('004201: Harrold — unresolved')).not.toBeInTheDocument();
 await user.click(screen.getByRole('button',{name:'Confirm reconciliation'}));
 expect(await screen.findByRole('alert')).toHaveTextContent('Choose an existing enrollment or explicitly create a new enrollment');
 expect(sent('POST','/result-identities/reconcile')).toHaveLength(0);expect(sent('PUT','/result-identities')).toHaveLength(0);
 server.afterReconcile=()=>{server.registry!.courses[0].swimmers[1].matchKeys=[johnnyKey];};
 await user.selectOptions(screen.getByLabelText('Identity for Johnny'),'enrollment-j');
 await user.click(screen.getByRole('button',{name:'Confirm reconciliation'}));
 await waitFor(()=>expect(sent('POST','/result-identities/reconcile')).toHaveLength(1));
 expect(sent('POST','/result-identities/reconcile')[0].body).toEqual({courseId:sourceId,swimmerId:'source-j',enrollmentId:'enrollment-j',matchKey:johnnyKey});
 expect(johnnyKey).toMatch(/^[a-f0-9]{64}$/);
 expect(await screen.findByText('Johnny',{selector:'strong'})).toBeVisible();
 expect(screen.queryByText('004201: Johnny — unresolved')).not.toBeInTheDocument();
 expect(loadRegistry(session.id)?.people[johnnyKey]).toMatchObject({sourceId:'source-j',courseId:sourceId});
 expect(sent('PUT','/result-identities')).toHaveLength(0);
 expectNoPersonalData();
});

it('registers a new student or transfer as a new enrollment, leaving existing enrollments untouched and sending only opaque identity fields',async()=>{
 const user=userEvent.setup();show();
 await user.selectOptions(await screen.findByLabelText('Identity for Johnny'),'new');
 await user.click(screen.getByRole('button',{name:'Confirm reconciliation'}));
 await waitFor(()=>expect(sent('PUT','/result-identities')).toHaveLength(1));
 const body=sent('PUT','/result-identities')[0].body,swimmers=body.courses[0].swimmers;
 expect(Object.keys(body).sort()).toEqual(['courses','datasetId','schemaVersion','sessionId']);
 expect(Object.keys(body.courses[0]).sort()).toEqual(['classId','instructorId','lessonDates','sourceId','swimmers']);
 expect(swimmers.slice(0,2)).toEqual([{sourceId:'source-h',enrollmentId:'enrollment-h',matchKey:harroldKey},{sourceId:'source-j',enrollmentId:'enrollment-j',matchKey:oldJohnnyKey}]);
 expect(swimmers).toHaveLength(3);expect(Object.keys(swimmers[2]).sort()).toEqual(['enrollmentId','matchKey','sourceId']);
 expect(swimmers[2].matchKey).toBe(johnnyKey);expect(['enrollment-h','enrollment-j']).not.toContain(swimmers[2].enrollmentId);expect(['source-h','source-j']).not.toContain(swimmers[2].sourceId);
 expect(sent('POST','/result-identities/reconcile')).toHaveLength(0);
 expect(loadRegistry(session.id)?.people[johnnyKey].sourceId).toBe(swimmers[2].sourceId);
 expectNoPersonalData();
});

it('blocks indistinguishable duplicate roster entries from reconciliation and from borrowing a registered identity',async()=>{
 const [harrold]=course.students;course={...course,students:[harrold,{...harrold}]};
 const user=userEvent.setup();show();
 expect(await screen.findAllByText('Indistinguishable duplicate. Correct the source roster before reconciling.')).toHaveLength(2);
 expect(screen.queryByLabelText('Identity for Harrold')).not.toBeInTheDocument();
 expect(screen.queryByRole('button',{name:'Confirm reconciliation'})).not.toBeInTheDocument();
 expect(screen.getAllByText('Unresolved student (enrollme)',{selector:'strong'})[0]).toBeVisible();
 await user.click(screen.getByRole('button',{name:'Print completed sheet for 004201'}));
 expect(await screen.findByRole('alert')).toHaveTextContent('Load and reconcile every student name before printing');
 expect(mocks.print).not.toHaveBeenCalled();
 expect(calls.every(c=>c.method==='GET')).toBe(true);
});

it('shows server-derived success rather than recomputing it from criteria, and displays timed benchmark totals',async()=>{
 const allCriteria=attempt({recordId:'all-successful-but-not-accepted',payload:{...attempt().payload,results:attempt().payload.results!.map(c=>({...c,status:'successful' as const}))},success:false});
 const timed=attempt({recordId:'timed',payload:{skillId:'Splash7:10',createdAt:'2026-09-04T12:00:00Z',submittedAt:'2026-09-04T12:01:00Z',results:[{subskillId:'Splash7:10:1',status:'not_yet'}],timed:{lapsRequired:4,lapsCompleted:4,elapsedMs:170000}},success:true});
 server.results=results([allCriteria,timed]);
 const skills=curriculum.skills as Record<string,string>;
 const user=userEvent.setup();show();
 await user.click(await screen.findByRole('button',{name:'Open skill progress for Harrold'}));
 expect(await screen.findByText(`${skills['LittleSplash1:1']}: 0 / 3 successful attempts`)).toBeVisible();
 expect(screen.getByText(`${skills['Splash7:10']}: 1 / 3 successful attempts`)).toBeVisible();
 const article=screen.getByText('4 of 4 laps in 170.0 seconds').closest('article')!;
 await user.click(within(article).getByText('Correct submitted assessment'));
 const elapsed=within(article).getByLabelText('Elapsed milliseconds');await user.clear(elapsed);await user.type(elapsed,'185000');
 await user.click(within(article).getByRole('button',{name:'Save correction as a new revision'}));
 await waitFor(()=>expect(sent('POST','/results')).toHaveLength(1));
 const body=sent('POST','/results')[0].body,op=body.operations[0];
 expect(body.schemaVersion).toBe(1);expect(body.operations).toHaveLength(1);
 expect(Object.keys(op).sort()).toEqual(['action','baseRevision','classId','curriculumVersion','datasetId','enrollmentId','kind','lessonDate','operationId','payload','recordId','sessionId']);
 expect(op).toMatchObject({recordId:'timed',action:'upsert',baseRevision:3,curriculumVersion:V,payload:{skillId:'Splash7:10',createdAt:'2026-09-04T12:00:00Z',timed:{lapsRequired:4,lapsCompleted:4,elapsedMs:185000}}});
 expect(JSON.stringify(body)).not.toMatch(/"success"|"revision"|"deleted"|"updatedAt"/);
});

it('retains the reviewer’s unsaved correction and reports the reason when the server rejects or fails the save',async()=>{
 server.submit=c=>({status:200,body:{schemaVersion:1,receipts:[{operationId:c.body.operations[0].operationId,status:'rejected',revision:3,reason:'changed operation reuse'}]}});
 const user=userEvent.setup();show();
 await user.click(await screen.findByRole('button',{name:'Open skill progress for Harrold'}));
 await user.click(await screen.findByText('Correct submitted assessment'));
 const select=()=>screen.getByLabelText(new RegExp((curriculum.criteria as Record<string,string>)['LittleSplash1:1:2'].replace(/[.*+?^${}()|[\]\\]/g,'\\$&'))) as HTMLSelectElement;
 await user.selectOptions(select(),'successful');
 await user.click(screen.getByRole('button',{name:'Save correction as a new revision'}));
 expect(await screen.findByRole('alert')).toHaveTextContent('changed operation reuse');
 expect(select().value).toBe('successful');expect(screen.queryByRole('status')).not.toBeInTheDocument();
 server.submit=()=>({status:503,text:'results service unavailable'});
 await user.click(screen.getByRole('button',{name:'Save correction as a new revision'}));
 await waitFor(()=>expect(screen.getByRole('alert')).toHaveTextContent('results service unavailable'));
 expect(select().value).toBe('successful');
 server.submit=c=>({status:200,body:{schemaVersion:1,receipts:[{operationId:c.body.operations[0].operationId,status:'pending_review',revision:3}]}});
 await user.click(screen.getByRole('button',{name:'Save correction as a new revision'}));
 expect(await screen.findByRole('status')).toHaveTextContent('Correction requires supervisor review.');
 const operations=sent('POST','/results').map(c=>c.body.operations[0]);
 expect(operations).toHaveLength(3);expect(new Set(operations.map(o=>o.operationId)).size).toBe(3);
 expect(operations.every(o=>o.baseRevision===3&&o.payload.results[1].status==='successful')).toBe(true);
});

it('sends the displayed revision when resolving a conflict and surfaces a stale-revision rejection without hiding the conflict',async()=>{
 const incoming={...attempt(),operationId:'incoming-op',baseRevision:1};
 server.results=results([attempt()],{conflicts:[{id:'conflict-one',operation:incoming,current:attempt(),resolved:false},{id:'conflict-new',operation:{...incoming,recordId:'never-accepted',operationId:'incoming-two'},current:null,resolved:false},{id:'conflict-done',operation:incoming,current:attempt(),resolved:true}]});
 server.resolve=()=>({status:409,text:'expected revision is stale'});
 const user=userEvent.setup();show();
 expect(await screen.findAllByRole('button',{name:'Accept incoming'})).toHaveLength(2);
 await user.click(screen.getAllByRole('button',{name:'Accept incoming'})[0]);
 expect(await screen.findByRole('alert')).toHaveTextContent('expected revision is stale');
 expect(sent('POST','/results/conflicts/conflict-one/resolve')[0].body).toEqual({choice:'incoming',expectedRevision:3});
 expect(screen.getAllByRole('button',{name:'Accept incoming'})).toHaveLength(2);
 server.results={...server.results,records:[attempt({revision:4})],conflicts:server.results.conflicts.map(c=>c.current?{...c,current:attempt({revision:4})}:c)};
 server.resolve=()=>({status:200,body:{resolved:true}});
 await user.click(screen.getByRole('button',{name:'Refresh submissions'}));
 await user.click(await screen.findByRole('button',{name:'Open skill progress for Harrold'}));
 await screen.findByText(/revision 4/);
 await user.click(screen.getByRole('button',{name:'Close skill progress'}));
 await user.click(screen.getAllByRole('button',{name:'Keep current'})[0]);
 await waitFor(()=>expect(sent('POST','/results/conflicts/conflict-one/resolve')).toHaveLength(2));
 expect(sent('POST','/results/conflicts/conflict-one/resolve')[1].body).toEqual({choice:'current',expectedRevision:4});
 await user.click(screen.getAllByRole('button',{name:'Accept incoming'})[1]);
 await waitFor(()=>expect(sent('POST','/results/conflicts/conflict-new/resolve')).toHaveLength(1));
 expect(sent('POST','/results/conflicts/conflict-new/resolve')[0].body).toEqual({choice:'incoming',expectedRevision:0});
});

it('cuts heat times to a tenth of a second like the tablet instead of rounding them',async()=>{
 const heat=(recordId:string,elapsedMs:number)=>attempt({recordId,payload:{skillId:'Splash7:10',createdAt:'2026-09-04T12:00:00Z',submittedAt:'2026-09-04T12:01:00Z',results:[{subskillId:'Splash7:10:1',status:'not_yet'}],timed:{lapsRequired:4,lapsCompleted:4,elapsedMs}}});
 server.results=results([heat('heat-a',7784),heat('heat-b',4665)]);
 const user=userEvent.setup();show();
 await user.click(await screen.findByRole('button',{name:'Open skill progress for Harrold'}));
 expect(await screen.findByText('4 of 4 laps in 7.7 seconds')).toBeVisible();
 expect(screen.getByText('4 of 4 laps in 4.6 seconds')).toBeVisible();
});

it('shows the plain "already changed" message when another reviewer resolved the conflict, and reloads the list',async()=>{
 const incoming={...attempt(),operationId:'incoming-op',baseRevision:1};
 server.results=results([attempt()],{conflicts:[{id:'conflict-one',operation:incoming,current:attempt(),resolved:false}]});
 server.resolve=()=>{server.results={...server.results,conflicts:[{id:'conflict-one',operation:incoming,current:attempt(),resolved:true}]};return {status:409,text:'This conflict changed or was already resolved. Reload the page to see the latest.'};};
 const user=userEvent.setup();show();
 await user.click(await screen.findByRole('button',{name:'Keep current'}));
 expect(await screen.findByRole('alert')).toHaveTextContent('This conflict changed or was already resolved. Reload the page to see the latest.');
 expect(screen.getByRole('alert')).not.toHaveTextContent('Invalid request');
 await waitFor(()=>expect(screen.queryByRole('button',{name:'Keep current'})).not.toBeInTheDocument());
});

it('displays tombstones as deleted, keeps them out of progress, and deletes through an audited delete operation',async()=>{
 server.results=results([attempt({recordId:'tombstone',action:'delete',payload:{},deleted:true,success:false,revision:5}),attempt({recordId:'attendance:enrollment-h:2026-09-04',kind:'attendance',payload:{status:'present'},revision:2})],{history:[{recordId:'tombstone',revision:4,record:attempt({recordId:'tombstone',revision:4,success:true})}]});
 const user=userEvent.setup();show();
 await user.click(await screen.findByRole('button',{name:'Open skill progress for Harrold'}));
 const tombstone=(await screen.findByText(/revision 5 · deleted/)).closest('article')!;
 expect(within(tombstone).getByText('Deleted')).toBeVisible();
 expect(within(tombstone).getByRole('button',{name:'Delete record with audit history'})).toBeDisabled();
 expect(within(tombstone).queryByText('Correct submitted assessment')).not.toBeInTheDocument();
 expect(within(tombstone).getByText(`Revision 4 · ${DATE}`)).toBeInTheDocument();
 expect(screen.getByText('No current curriculum assessments submitted.')).toBeVisible();
 const live=screen.getByText('Attendance: present').closest('article')!;
 await user.click(within(live).getByRole('button',{name:'Delete record with audit history'}));
 await waitFor(()=>expect(sent('POST','/results')).toHaveLength(1));
 expect(sent('POST','/results')[0].body.operations[0]).toMatchObject({recordId:'attendance:enrollment-h:2026-09-04',kind:'attendance',action:'delete',baseRevision:2,payload:{}});
 expect(sent('POST','/results')[0].body.operations[0].operationId).not.toBe('original-op');
});

it('marks attendance with the contract record ID and first-revision base, then corrects against the accepted revision',async()=>{
 server.registry!.courses[0].swimmers[1].matchKey=johnnyKey;server.results=results([]);
 const user=userEvent.setup();show();
 await user.selectOptions(await screen.findByLabelText('Lesson date for 004201'),DATE);
 await user.selectOptions(screen.getByLabelText('Attendance for Johnny'),'absent');
 await waitFor(()=>expect(sent('POST','/results')).toHaveLength(1));
 expect(sent('POST','/results')[0].body.operations[0]).toMatchObject({sessionId:session.id,datasetId:'synthetic-dataset',classId:'class-one',enrollmentId:'enrollment-j',recordId:`attendance:enrollment-j:${DATE}`,kind:'attendance',action:'upsert',baseRevision:0,lessonDate:DATE,payload:{status:'absent'}});
 server.results=results([attempt({recordId:`attendance:enrollment-j:${DATE}`,enrollmentId:'enrollment-j',kind:'attendance',payload:{status:'absent'},revision:7})]);
 await user.click(screen.getByRole('button',{name:'Refresh submissions'}));
 await waitFor(()=>expect((screen.getByLabelText('Attendance for Johnny') as HTMLSelectElement).value).toBe('absent'));
 await user.selectOptions(screen.getByLabelText('Attendance for Johnny'),'present');
 await waitFor(()=>expect(sent('POST','/results')).toHaveLength(2));
 expect(sent('POST','/results')[1].body.operations[0]).toMatchObject({recordId:`attendance:enrollment-j:${DATE}`,baseRevision:7,payload:{status:'present'}});
 expectNoPersonalData();
});

it('gives instructors the scoped classes only, without grants, reconciliation or conflict-resolution controls',async()=>{
 server.results=results([attempt()],{conflicts:[{id:'conflict-one',operation:attempt(),current:attempt(),resolved:false}]});
 server.grants=[{id:'grant-one',instructorId:'instructor-one',expiresAt:'2026-10-01T00:00:00Z',revoked:false}];
 show(false);
 expect(await screen.findByText('Some submissions need supervisor review. Accepted results remain displayed until those conflicts are resolved.')).toBeVisible();
 expect([...document.querySelectorAll('[data-component="results-class-card"]')].map(e=>e.getAttribute('data-class-id'))).toEqual(['class-one']);
 for(const heading of ['Identity reconciliation','Conflicts requiring review','Tablet access grants'])expect(screen.queryByText(heading)).not.toBeInTheDocument();
 for(const name of ['Keep current','Accept incoming','Revoke access','Confirm reconciliation'])expect(screen.queryByRole('button',{name})).not.toBeInTheDocument();
 expect(calls.some(c=>c.url.includes('result-grants')||c.url.includes('result-classes'))).toBe(false);
 expect(calls.every(c=>c.method==='GET')).toBe(true);
 expect(mocks.roster).toHaveBeenCalledWith(expect.objectContaining({id:session.id}),true);
});

it('lists active and revoked grants and revokes only through the grant endpoint',async()=>{
 server.grants=[{id:'grant-one',instructorId:'instructor-one',expiresAt:'2026-10-01T00:00:00Z',revoked:false},{id:'grant-two',instructorId:'instructor-two',expiresAt:'2026-10-02T00:00:00Z',revoked:true}];
 const user=userEvent.setup();show();
 expect(await screen.findByText('instructor-one · expires 2026-10-01T00:00:00Z · Active')).toBeVisible();
 expect(screen.getByText('instructor-two · expires 2026-10-02T00:00:00Z · Revoked')).toBeVisible();
 const buttons=screen.getAllByRole('button',{name:'Revoke access'});expect(buttons[1]).toBeDisabled();
 await user.click(buttons[0]);
 await waitFor(()=>expect(calls.filter(c=>c.method==='DELETE')).toHaveLength(1));
 expect(calls.find(c=>c.method==='DELETE')!.url).toBe(`/api/sessions/${session.id}/result-grants/grant-one`);
});

it('builds completed sheets from accepted server-successful records only and blocks mixed curriculum versions',async()=>{
 server.registry!.courses[0].swimmers[1].matchKey=johnnyKey;
 server.registry!.courses[0].swimmers.push({sourceId:'source-gone',enrollmentId:'enrollment-gone',matchKey:'c'.repeat(64),active:false});
 server.registry!.courses.push({sourceId:courseSourceId(session.id,'other'),classId:'class-two',instructorId:'instructor-two',lessonDates:[DATE],swimmers:[]});
 const skill=(recordId:string,over:Partial<ResultRecord>={})=>attempt({recordId,payload:{...attempt().payload,skillId:'Splash1:2'},success:true,...over});
 const good=[skill('a'),skill('b'),skill('c',{success:false}),skill('d',{deleted:true,action:'delete'}),skill('e',{classId:'class-two'}),skill('f',{enrollmentId:'enrollment-gone'}),
  attempt({recordId:`attendance:enrollment-h:${DATE}`,kind:'attendance',payload:{status:'present'}}),attempt({recordId:`attendance:enrollment-j:${DATE}`,enrollmentId:'enrollment-j',kind:'attendance',payload:{status:'absent'}})];
 server.results=results([...good,skill('old',{curriculumVersion:'templates-older'})],{conflicts:[{id:'elsewhere',operation:skill('x',{classId:'class-two'}),current:null,resolved:false}]});
 const user=userEvent.setup();show();
 await user.click(await screen.findByRole('button',{name:'Print completed sheet for 004201'}));
 expect(await screen.findByRole('alert')).toHaveTextContent('one curriculum version');expect(mocks.print).not.toHaveBeenCalled();
 server.results={...server.results,records:good};
 await user.click(screen.getByRole('button',{name:'Refresh submissions'}));
 await waitFor(()=>expect(screen.queryByRole('alert')).not.toBeInTheDocument());
 await user.click(screen.getByRole('button',{name:'Print completed sheet for 004201'}));
 await waitFor(()=>expect(mocks.print).toHaveBeenCalledTimes(1));
 const request=mocks.print.mock.calls[0][0];
 expect(request.rosters).toHaveLength(1);expect(request.rosters[0].template).toBe('Splash1');
 const roster=request.rosters[0].roster;
 expect(roster.completed).toEqual({curriculumVersion:V,lessonDates:[DATE,'2026-09-11']});
 expect(roster.students).toEqual([
  {name:'Harrold',enrollmentId:'enrollment-h',results:{attendance:{[DATE]:'present'},successfulAttempts:{'Splash1:2':2}}},
  {name:'Johnny',enrollmentId:'enrollment-j',results:{attendance:{[DATE]:'absent'},successfulAttempts:{}}},
 ]);
});

it('lists swimmers in blank-sheet name order on the completed sheet and the class card, not in database order',async()=>{
 server.registry!.courses[0].swimmers[1].matchKey=johnnyKey;
 server.registry!.courses[0].swimmers.reverse();
 server.results=results([attempt({recordId:'attempt-j',enrollmentId:'enrollment-j'}),attempt()]);
 const user=userEvent.setup();show();
 const card=await screen.findByRole('region',{name:/\(004201\)/});
 await within(card).findByRole('button',{name:'Open skill progress for Johnny'});
 expect(within(card).getAllByRole('button',{name:/^Open skill progress for /}).map(b=>b.getAttribute('aria-label'))).toEqual(['Open skill progress for Harrold','Open skill progress for Johnny']);
 await user.click(screen.getByRole('button',{name:'Print completed sheet for 004201'}));
 await waitFor(()=>expect(mocks.print).toHaveBeenCalledTimes(1));
 expect(mocks.print.mock.calls[0][0].rosters[0].roster.students.map((s:{name:string})=>s.name)).toEqual(['Harrold','Johnny']);
});

it('resolves names from a local class package without sending it anywhere, and rejects a package from another dataset',async()=>{
 mocks.roster.mockRejectedValue(new Error('No local roster'));
 const pkg=(datasetId:string)=>({schemaVersion:1,kind:'rec-tablet-classes',datasetId,instructor:'Package Teacher',courses:[{sourceId,name:'Splash 1',level:'Splash1',startTime:'16:00',location:'Pool',lessonDates:[DATE],swimmers:[{sourceId:'source-h',name:'Package Only Name'}]}]});
 const file=(datasetId:string)=>new File([JSON.stringify(pkg(datasetId))],'classes.json',{type:'application/json'});
 const user=userEvent.setup();show(false);
 expect((await screen.findAllByText('Unresolved student (enrollme)',{selector:'strong'}))[0]).toBeVisible();
 expect(screen.getByText(/Load this session’s class package below to resolve names/)).toBeVisible();
 const input=screen.getByLabelText('Load local class package to resolve names (stays in this browser)');
 await waitFor(()=>expect(input).toBeEnabled());
 await user.upload(input,file('another-dataset'));
 expect(await screen.findByRole('alert')).toHaveTextContent('Choose a class package from this registered session.');
 expect(screen.queryByText('Package Only Name',{selector:'strong'})).not.toBeInTheDocument();
 expect(JSON.stringify(Array.from({length:localStorage.length},(_,i)=>localStorage.getItem(localStorage.key(i)!)))).not.toContain('Package Only Name');
 await user.upload(input,file('synthetic-dataset'));
 expect(await screen.findByText('Package Only Name',{selector:'strong'})).toBeVisible();
 expect(calls.every(c=>c.method==='GET')).toBe(true);
 for(const c of calls)expect(`${c.url}${JSON.stringify(c.body??'')}`).not.toMatch(/Package Only Name|Package Teacher/);
});
it('loads results one registered class at a time and never asks for the whole session at once',async()=>{
 server.registry!.courses.push({sourceId:courseSourceId(session.id,'other'),classId:'class-two',instructorId:'instructor-two',lessonDates:[DATE],swimmers:[]});
 server.results=results([attempt(),attempt({recordId:'other-attempt',classId:'class-two'})]);
 const user=userEvent.setup();show();
 await user.click(await screen.findByRole('button',{name:'Open skill progress for Harrold'}));
 await screen.findByText('Submitted records and revision history');
 await waitFor(()=>expect(calls.filter(c=>c.method==='GET'&&c.url.includes('/results')).map(c=>c.url.split('/results')[1]).sort()).toEqual(['?classId=class-one','?classId=class-two']));
 expect(await screen.findAllByText(/revision \d/)).toHaveLength(2);
});

it('prints one instructor or every instructor in one job, skipping classes that are not ready and saying why',async()=>{
 server.registry!.courses[0].swimmers[1].matchKey=johnnyKey;
 server.registry!.courses.push({sourceId:courseSourceId(session.id,'other'),classId:'class-two',instructorId:'instructor-two',lessonDates:[DATE],swimmers:[]});
 server.results=results([attempt({payload:{...attempt().payload,skillId:'Splash1:2'},success:true})]);
 const user=userEvent.setup();show();
 await user.click(await screen.findByRole('button',{name:'Print all instructors'}));
 await waitFor(()=>expect(mocks.print).toHaveBeenCalledTimes(1));
 expect(mocks.print.mock.calls[0][0].rosters.map((r:{roster:{code:string}})=>r.roster.code)).toEqual(['004201']);
 expect(screen.getByText('Printed 1 of 2 classes.')).toBeVisible();
 expect(screen.getByText(/other Class other \(Unassigned\): Load and reconcile every student name before printing/)).toBeVisible();
 // Printing changes nothing on the server, so it does not reload every class afterwards.
 expect(calls.filter(c=>c.method==='GET'&&c.url.includes('/results?classId=')).length).toBe(2);
 await user.selectOptions(screen.getByLabelText('Instructor'),course.instructor);
 expect(document.querySelectorAll('[data-component="results-class-card"]')).toHaveLength(1);
 await user.click(screen.getByRole('button',{name:`Print completed sheets for ${course.instructor}`}));
 await waitFor(()=>expect(mocks.print).toHaveBeenCalledTimes(2));
 expect(mocks.print.mock.calls[1][0].rosters).toHaveLength(1);
 expect(screen.getByText('Printed 1 of 1 classes.')).toBeVisible();
 await user.selectOptions(screen.getByLabelText('Instructor'),'Unassigned');
 await user.click(screen.getByRole('button',{name:'Print completed sheets for Unassigned'}));
 expect(await screen.findByRole('alert')).toHaveTextContent('None of these classes can print yet');
 expect(mocks.print).toHaveBeenCalledTimes(2);
});

it('prints filled report cards for a class, one swimmer, or every instructor, on blank or pre-printed paper',async()=>{
 server.registry!.courses[0].swimmers[1].matchKey=johnnyKey;
 server.registry!.courses.push({sourceId:courseSourceId(session.id,'other'),classId:'class-two',instructorId:'instructor-two',lessonDates:[DATE],swimmers:[]});
 server.results=results([1,2,3].map(i=>attempt({recordId:`ok-${i}`,payload:{...attempt().payload,skillId:'Splash1:1',results:[{subskillId:'Splash1:1:1',status:'successful'}]},success:true})));
 mocks.cards.mockReset().mockResolvedValue(undefined);
 const user=userEvent.setup();show();
 await user.click(await screen.findByRole('button',{name:'Print report cards for 004201'}));
 await waitFor(()=>expect(mocks.cards).toHaveBeenCalledTimes(1));
 const doc=new DOMParser().parseFromString(mocks.cards.mock.calls[0][0],'text/html');
 expect([...doc.querySelectorAll('[data-field="participant"]')].map(f=>f.textContent)).toEqual(['Harrold','Johnny']);
 expect(doc.querySelectorAll('.rc-page')).toHaveLength(4);expect(doc.querySelectorAll('img.rc-scan')).toHaveLength(4);
 const harrold=doc.querySelectorAll('.rc-page[data-side="inside"]')[0],johnny=doc.querySelectorAll('.rc-page[data-side="inside"]')[1];
 expect(harrold.querySelector('[data-criterion="Splash1:1:1"]')).not.toBeNull();expect(johnny.querySelector('[data-criterion]')).toBeNull();
 expect(doc.querySelector('style')!.textContent).toContain('.rc-hl');expect(screen.getByLabelText('Highlight skills not yet achieved')).toBeChecked();
 await user.selectOptions(screen.getByLabelText('Report card paper'),'preprinted');
 await user.click(screen.getByRole('button',{name:'Open skill progress for Johnny'}));
 await user.click(screen.getByRole('button',{name:'Print report card'}));
 await waitFor(()=>expect(mocks.cards).toHaveBeenCalledTimes(2));
 const one=new DOMParser().parseFromString(mocks.cards.mock.calls[1][0],'text/html');
 expect([...one.querySelectorAll('[data-field="participant"]')].map(f=>f.textContent)).toEqual(['Johnny']);expect(one.querySelectorAll('img')).toHaveLength(0);
 await user.click(screen.getByRole('button',{name:'Close skill progress'}));
 await user.click(screen.getByRole('button',{name:'Print all report cards'}));
 await waitFor(()=>expect(mocks.cards).toHaveBeenCalledTimes(3));
 expect(screen.getByText('Printed 1 of 2 classes.')).toBeVisible();
 expect(calls.every(c=>c.method==='GET')).toBe(true);
});

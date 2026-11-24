import {render,screen,waitFor,within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {beforeEach,expect,it,vi} from 'vitest';
import {webcrypto} from 'node:crypto';
import {ResultsView} from './Results.component';
import {session} from '../decksupervisor/DeviceExport/fixtures';
import {installLocalStorage} from '../../test/storage';
import {setStorageScope} from '../../lib/storageScope';
import {COMPLETED_PRINT_CURRICULUM_VERSION} from '../../shared/attendance-print/completedAttendance';
import type {Oddity,FixPlan} from './oddities';
const mocks=vi.hoisted(()=>({registry:vi.fn(),results:vi.fn(),grants:vi.fn(),submit:vi.fn(),roster:vi.fn(),find:vi.fn(),plan:vi.fn(),load:vi.fn(),save:vi.fn()}));
vi.mock('../../lib/resultsApi',async original=>({...await original<typeof import('../../lib/resultsApi')>(),fetchResultRegistry:mocks.registry,fetchResults:mocks.results,fetchResultGrants:mocks.grants,submitResult:mocks.submit}));
vi.mock('../decksupervisor/DeviceExport/services/loadExportCourses',()=>({loadExportCourses:mocks.roster}));
vi.mock('./oddities',()=>({findOddities:mocks.find,planOddityFix:mocks.plan,loadIgnoredOddities:mocks.load,saveIgnoredOddities:mocks.save}));
const registry={schemaVersion:1,sessionId:session.id,datasetId:'synthetic-dataset',courses:[{sourceId:`session:${session.id}:course:004201`,classId:'class-one',instructorId:'instructor-one',lessonDates:['2026-09-04'],swimmers:[{sourceId:'student-one',enrollmentId:'enrollment-one',matchKey:'a'.repeat(64)}]}]};
const V=COMPLETED_PRINT_CURRICULUM_VERSION;
const attempt={operationId:'original-op',sessionId:session.id,datasetId:'synthetic-dataset',classId:'class-one',enrollmentId:'enrollment-one',recordId:'attempt-one',kind:'attempt' as const,action:'upsert' as const,baseRevision:0,lessonDate:'2026-09-04',curriculumVersion:V,payload:{skillId:'LittleSplash1:1',results:[]},revision:3,deleted:false,success:false,updatedAt:'2026-09-04T12:01:00Z'};
const oddity:Oddity={id:'class-one:enrollment-one:Splash2A:rhythmic kick',classId:'class-one',enrollmentId:'enrollment-one',level:'Splash2A',key:'rhythmic kick',label:'Rhythmic kick',criteria:[{criterionId:'a',skillId:'Splash2A:1',skillName:'Flutter kick on front',ticked:true,successfulMarks:3,skillSuccesses:3,skillComplete:true,attempts:3},{criterionId:'b',skillId:'Splash2A:2',skillName:'Front crawl',ticked:false,successfulMarks:1,skillSuccesses:1,skillComplete:false,attempts:1}]};
const op=(n:number)=>({...attempt,operationId:`fix-${n}`,recordId:`r${n}`,baseRevision:n});
beforeEach(()=>{
 vi.stubGlobal('crypto',webcrypto);installLocalStorage();localStorage.clear();setStorageScope('results-oddities');
 mocks.registry.mockResolvedValue(registry);mocks.results.mockResolvedValue({schemaVersion:1,records:[attempt],history:[],conflicts:[]});mocks.grants.mockResolvedValue({grants:[]});
 mocks.submit.mockReset().mockResolvedValue({receipts:[{operationId:'x',status:'accepted',revision:4}]});mocks.roster.mockRejectedValue(new Error('No local roster'));
 mocks.find.mockReset().mockReturnValue([oddity]);mocks.load.mockReset().mockReturnValue(new Set());mocks.save.mockReset();
 mocks.plan.mockReset().mockImplementation((_o:Oddity,_r:unknown,direction:'tick'):FixPlan=>({direction,possible:true,operations:[op(1),op(2)],changes:['Front crawl: Rhythmic kick'],warnings:[]}));
});
it('adds a review button after Print all instructors that opens the oddities modal',async()=>{
 const user=userEvent.setup();render(<ResultsView session={session} supervisor/>);
 const review=await screen.findByRole('button',{name:'Review report card oddities (1)'});
 expect(screen.getByRole('button',{name:'Print all instructors'}).nextElementSibling).toBe(review);
 expect(mocks.find).toHaveBeenCalledWith(expect.any(Array),{classId:'class-one',enrollmentId:'enrollment-one',curriculumVersion:V});
 await user.click(review);
 expect(screen.getByRole('dialog',{name:'Report card oddities'})).toBeVisible();expect(screen.getByText('Front crawl: Not ticked · 1 of 3 marks')).toBeVisible();
});
it('submits the plan operations in order and reports the fix',async()=>{
 const user=userEvent.setup();render(<ResultsView session={session} supervisor/>);
 await user.click(await screen.findByRole('button',{name:'Review report card oddities (1)'}));
 await user.click(screen.getByRole('button',{name:/^Tick Rhythmic kick everywhere for /}));
 expect(mocks.plan).toHaveBeenCalledWith(oddity,[attempt],'tick',expect.objectContaining({sessionId:session.id,datasetId:'synthetic-dataset',lessonDates:['2026-09-04'],curriculumVersion:V}));
 await user.click(screen.getByRole('button',{name:'Apply fix'}));
 await waitFor(()=>expect(mocks.submit).toHaveBeenCalledTimes(2));
 expect(mocks.submit.mock.calls.map(c=>c[1].operationId)).toEqual(['fix-1','fix-2']);
 expect(await screen.findByRole('status')).toHaveTextContent(/Fixed: Rhythmic kick for .* \(2 changes\)/);
});
it('persists ignored oddities and excludes them from the count',async()=>{
 const user=userEvent.setup();render(<ResultsView session={session} supervisor/>);
 await user.click(await screen.findByRole('button',{name:'Review report card oddities (1)'}));
 await user.click(screen.getByRole('button',{name:/^Ignore Rhythmic kick for /}));
 expect(mocks.save).toHaveBeenCalledWith(expect.stringContaining(`results-oddities-ignored:${session.id}`),new Set([oddity.id]));
 expect(screen.getByRole('button',{name:'Review report card oddities (0)'})).toBeInTheDocument();
});
it('opens the swimmer progress from an oddity',async()=>{
 const user=userEvent.setup();render(<ResultsView session={session} supervisor/>);
 await user.click(await screen.findByRole('button',{name:'Review report card oddities (1)'}));
 await user.click(within(screen.getByRole('dialog',{name:'Report card oddities'})).getByRole('button',{name:/^Open skill progress for /}));
 expect(screen.queryByRole('dialog',{name:'Report card oddities'})).not.toBeInTheDocument();expect(screen.getByText('Skill progress')).toBeVisible();
});

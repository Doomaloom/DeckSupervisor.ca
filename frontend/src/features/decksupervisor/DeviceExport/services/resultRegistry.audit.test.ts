// Completion-audit regressions for canonical identity publication and recovery.
import {createHash,webcrypto} from 'node:crypto';
import {beforeEach,expect,it,vi} from 'vitest';
import {recoverRegistry,registerResults,studentMatchKey,courseSourceId,assertRegisteredRoster} from './resultRegistry';
import {buildCourses,buildPackage,newRegistry,type ExportCourse,type ExportRegistry} from './exportPackage';
import {loadRegistry,saveRegistry} from './exportStorage';
import {session,classes,students} from '../fixtures';
import {installLocalStorage} from '../../../../test/storage';
import {setStorageScope} from '../../../../lib/storageScope';
const mocks=vi.hoisted(()=>({get:vi.fn(),put:vi.fn(),classes:vi.fn()}));
vi.mock('../../../../lib/resultsApi',()=>({fetchResultRegistry:mocks.get,putResultRegistry:mocks.put,fetchResultClasses:mocks.classes}));
let courses:ExportCourse[],a:ExportCourse,b:ExportCourse;
const A=courseSourceId(session.id,'004201'),B=courseSourceId(session.id,'004203');
beforeEach(()=>{vi.stubGlobal('crypto',webcrypto);installLocalStorage();localStorage.clear();setStorageScope('registry-audit');courses=buildCourses(session,classes,students);a=courses.find(c=>c.code==='004201')!;b=courses.find(c=>c.code==='004203')!;mocks.get.mockReset().mockResolvedValue(null);mocks.put.mockReset().mockResolvedValue({});mocks.classes.mockReset().mockResolvedValue({classes:courses.map(c=>({id:`class-${c.code}`,code:c.code,instructorId:`instructor-${c.instructor}`}))});});
const personal=()=>courses.flatMap(c=>c.students.flatMap(s=>[s.name,s.phone]));
const local=(people:Record<string,{sourceId:string;courseId:string;name:string}>):ExportRegistry=>({...newRegistry(session.id),datasetId:'decksupervisor:existing',people});

it('derives matchKey as an opaque lowercase SHA256 scoped to the session and class',async()=>{
 const [person]=a.students,key=await studentMatchKey(A,person);
 expect(key).toBe(createHash('sha256').update(JSON.stringify([A,person.name.trim(),person.phone.trim()])).digest('hex'));
 expect(key).toMatch(/^[a-f0-9]{64}$/);expect(key).not.toContain(person.name.toLowerCase());
 expect(await studentMatchKey(A,{name:` ${person.name} `,phone:` ${person.phone} `})).toBe(key);
 expect(await studentMatchKey(courseSourceId('another-session','004201'),person)).not.toBe(key);
 expect(await studentMatchKey(B,person)).not.toBe(key);
 expect(await studentMatchKey(A,{...person,phone:'changed'})).not.toBe(key);
 expect(A).toContain(session.id);
});

it('publishes IDs minted by an existing browser registry verbatim and sends only opaque identity fields',async()=>{
 // A browser that exported before results sync already holds dataset and swimmer IDs.
 const legacy=await buildPackage(session.id,'Alex',courses,newRegistry(session.id));saveRegistry(legacy.registry);
 const recovered=await recoverRegistry(session.id,courses);
 expect(recovered).toEqual(legacy.registry);
 const again=await buildPackage(session.id,'Alex',courses,recovered);
 expect(again.package).toEqual(legacy.package);
 await registerResults(session.id,courses.filter(c=>c.instructor==='Alex'),again.registry);
 const sent=mocks.put.mock.calls[0][0];
 expect(Object.keys(sent).sort()).toEqual(['courses','datasetId','schemaVersion','sessionId']);
 expect(sent).toMatchObject({schemaVersion:1,sessionId:session.id,datasetId:legacy.package.datasetId});
 expect(sent.courses.map((c:{sourceId:string})=>c.sourceId)).toEqual(legacy.package.courses.map(c=>c.sourceId));
 for(const [index,course] of sent.courses.entries()){
  expect(Object.keys(course).sort()).toEqual(['classId','instructorId','lessonDates','sourceId','swimmers']);
  expect(course.swimmers.map((s:{sourceId:string})=>s.sourceId).sort()).toEqual(legacy.package.courses[index].swimmers.map(s=>s.sourceId).sort());
  for(const swimmer of course.swimmers){expect(Object.keys(swimmer).sort()).toEqual(['enrollmentId','matchKey','sourceId']);expect(swimmer.matchKey).toMatch(/^[a-f0-9]{64}$/);}
 }
 const wire=JSON.stringify(sent);for(const value of personal())expect(wire).not.toContain(value);
 expect(wire).not.toMatch(/"(name|phone|email|people|instructor)"/);
 // The name-bearing export registry stays local.
 expect(JSON.stringify(loadRegistry(session.id))).toContain(a.students[0].name);
});

it('keeps class packages on schemaVersion 1 without client-authored sync metadata',async()=>{
 const built=await buildPackage(session.id,'Alex',courses,newRegistry(session.id));
 expect(built.package.schemaVersion).toBe(1);expect(built.package.kind).toBe('rec-tablet-classes');
 expect(Object.keys(built.package).sort()).toEqual(['courses','datasetId','instructor','kind','schemaVersion']);
 expect(JSON.stringify(built.package)).not.toMatch(/"sync"|uploadToken|readToken|enrollmentId|matchKey/);
});

it('refuses to mix a saved registry with a differently registered dataset',async()=>{
 saveRegistry(local({}));mocks.get.mockResolvedValue({schemaVersion:1,sessionId:session.id,datasetId:'decksupervisor:other',courses:[]});
 await expect(recoverRegistry(session.id,courses)).rejects.toThrow('Restore the original ID backup');
 expect(loadRegistry(session.id)?.datasetId).toBe('decksupervisor:existing');
});

it('never rebinds a changed name or contact value, and refuses to publish it as a new identity for a registered class',async()=>{
 const [harrold,johnny]=a.students,hKey=await studentMatchKey(A,harrold),jKey=await studentMatchKey(A,johnny);
 const remote={schemaVersion:1,sessionId:session.id,datasetId:'decksupervisor:existing',courses:[{sourceId:A,classId:'class-004201',instructorId:'instructor-Alex',lessonDates:a.lessonDates,swimmers:[{sourceId:'src-h',enrollmentId:'enr-h',matchKey:hKey},{sourceId:'src-j',enrollmentId:'enr-j',matchKey:jKey}]}]};
 mocks.get.mockResolvedValue(remote);
 for(const changed of [{...johnny,name:'Johnny Renamed'},{...johnny,phone:'555-changed'}]){
  localStorage.clear();
  const roster=[{...a,students:[harrold,changed]}],changedKey=await studentMatchKey(A,changed);
  const recovered=await recoverRegistry(session.id,roster);
  expect(recovered.people[hKey].sourceId).toBe('src-h');expect(recovered.people[changedKey]).toBeUndefined();
  expect(Object.values(recovered.people).some(p=>p.sourceId==='src-j')).toBe(false);
  await expect(assertRegisteredRoster(session.id,roster)).rejects.toThrow('explicit reconciliation');
  // Even if a local ID is minted for the changed entry, publication is refused.
  const minted={...recovered,people:{...recovered.people,[changedKey]:{sourceId:'freshly-minted',courseId:A,name:changed.name}}};
  await expect(registerResults(session.id,roster,minted,true)).rejects.toThrow(`Reconcile ${changed.name} in Results before sharing.`);
  await expect(registerResults(session.id,roster,recovered,true)).rejects.toThrow(`Resolve ${changed.name} before sharing.`);
 }
 expect(mocks.put).not.toHaveBeenCalled();
 // After the supervisor records an alias, the unchanged enrollment and original match key are republished.
 const renamed={...johnny,name:'Johnny Renamed'},alias=await studentMatchKey(A,renamed);
 mocks.get.mockResolvedValue({...remote,courses:[{...remote.courses[0],swimmers:[remote.courses[0].swimmers[0],{...remote.courses[0].swimmers[1],matchKeys:[alias]}]}]});
 localStorage.clear();const roster=[{...a,students:[harrold,renamed]}];
 const recovered=await recoverRegistry(session.id,roster);expect(recovered.people[alias].sourceId).toBe('src-j');
 await expect(assertRegisteredRoster(session.id,roster)).resolves.toBeUndefined();
 await registerResults(session.id,roster,recovered,true);
 expect(mocks.put.mock.calls[0][0].courses[0].swimmers).toEqual([{sourceId:'src-h',enrollmentId:'enr-h',matchKey:hKey},{sourceId:'src-j',enrollmentId:'enr-j',matchKey:jKey}]);
});

it('blocks indistinguishable duplicate entries until the source roster is corrected',async()=>{
 const [harrold]=a.students,hKey=await studentMatchKey(A,harrold),roster=[{...a,students:[harrold,{...harrold}]}];
 mocks.get.mockResolvedValue({schemaVersion:1,sessionId:session.id,datasetId:'decksupervisor:existing',courses:[{sourceId:A,classId:'class-004201',instructorId:'instructor-Alex',lessonDates:a.lessonDates,swimmers:[{sourceId:'src-h',enrollmentId:'enr-h',matchKey:hKey}]}]});
 const recovered=await recoverRegistry(session.id,roster);
 expect(Object.keys(recovered.people)).toEqual([hKey]);
 await expect(buildPackage(session.id,'Alex',roster,recovered)).rejects.toThrow('indistinguishable');
});

it('gives a transferred student a new enrollment in the destination class and never moves the earlier enrollment',async()=>{
 const [harrold,johnny]=a.students,[morgan]=b.students;
 const hKey=await studentMatchKey(A,harrold),jKeyA=await studentMatchKey(A,johnny),mKey=await studentMatchKey(B,morgan),jKeyB=await studentMatchKey(B,johnny);
 const from={...a,students:[harrold]},to={...b,students:[morgan,johnny]};
 const courseA={sourceId:A,classId:'class-004201',instructorId:'instructor-Alex',lessonDates:a.lessonDates,swimmers:[{sourceId:'src-h',enrollmentId:'enr-h',matchKey:hKey},{sourceId:'src-j',enrollmentId:'enr-j',matchKey:jKeyA}]};
 const courseB={sourceId:B,classId:'class-004203',instructorId:'instructor-Sam',lessonDates:b.lessonDates,swimmers:[{sourceId:'src-m',enrollmentId:'enr-m',matchKey:mKey}]};
 mocks.get.mockResolvedValue({schemaVersion:1,sessionId:session.id,datasetId:'decksupervisor:existing',courses:[courseA,courseB]});
 // The same person in another class has a different signature and is not auto-matched to the old enrollment.
 const recovered=await recoverRegistry(session.id,[from,to]);
 expect(recovered.people[jKeyB]).toBeUndefined();expect(Object.values(recovered.people).some(p=>p.sourceId==='src-j')).toBe(false);
 await expect(assertRegisteredRoster(session.id,[from,to])).rejects.toThrow('explicit reconciliation');
 const unreviewed={...recovered,people:{...recovered.people,[jKeyB]:{sourceId:'src-j2',courseId:B,name:johnny.name}}};
 await expect(registerResults(session.id,[from,to],unreviewed,true)).rejects.toThrow('Reconcile Johnny in Results before sharing.');
 expect(mocks.put).not.toHaveBeenCalled();
 // Supervisor chose "new enrollment" in Results: the destination class now has a distinct enrollment.
 mocks.get.mockResolvedValue({schemaVersion:1,sessionId:session.id,datasetId:'decksupervisor:existing',courses:[courseA,{...courseB,swimmers:[...courseB.swimmers,{sourceId:'src-j2',enrollmentId:'enr-j2',matchKey:jKeyB}]}]});
 await registerResults(session.id,[from,to],unreviewed,true);
 const sent=mocks.put.mock.calls[0][0],sentA=sent.courses.find((c:{sourceId:string})=>c.sourceId===A),sentB=sent.courses.find((c:{sourceId:string})=>c.sourceId===B);
 expect(sentA.swimmers).toEqual([{sourceId:'src-h',enrollmentId:'enr-h',matchKey:hKey}]);
 expect(sentB.swimmers).toEqual([{sourceId:'src-m',enrollmentId:'enr-m',matchKey:mKey},{sourceId:'src-j2',enrollmentId:'enr-j2',matchKey:jKeyB}]);
 expect(JSON.stringify(sentB)).not.toContain('enr-j"');expect(JSON.stringify(sent)).not.toContain('"src-j"');
});

it('requires exactly one saved class assignment before registering identities',async()=>{
 const built=await buildPackage(session.id,'Alex',courses,newRegistry(session.id));
 mocks.classes.mockResolvedValue({classes:[]});
 await expect(registerResults(session.id,[a],built.registry)).rejects.toThrow('needs one saved instructor assignment before sharing');
 mocks.classes.mockResolvedValue({classes:[{id:'one',code:'004201',instructorId:'i'},{id:'two',code:'004201',instructorId:'i'}]});
 await expect(registerResults(session.id,[a],built.registry)).rejects.toThrow('needs one saved instructor assignment before sharing');
 expect(mocks.put).not.toHaveBeenCalled();
});

import {describe,expect,it} from 'vitest';
import {buildReportCardHtml,levelSkills,recommendedNextLevel,reportCardMarks,type ReportCardMap} from './reportCards';
import type {ResultRecord} from '../../lib/resultsApi';

const V='v1';
let n=0;
const attempt=(skillId:string,results:[string,'successful'|'not_yet'][],success:boolean,over:Partial<ResultRecord>={}):ResultRecord=>({operationId:`op${n}`,sessionId:'s',datasetId:'d',classId:'c',enrollmentId:'e',recordId:`r${n++}`,kind:'attempt',action:'upsert',baseRevision:0,lessonDate:'2026-09-04',curriculumVersion:V,payload:{skillId,results:results.map(([subskillId,status])=>({subskillId,status}))},revision:1,deleted:false,success,updatedAt:'',...over});
const map:ReportCardMap={level:'Splash1',images:{outside:'splash-1-outside.jpg',inside:'splash-1-inside.jpg'},
 fields:{participant:{page:'outside',x:76,y:72},instructor:{page:'outside',x:76,y:77},date:{page:'outside',x:74,y:82},session:{page:'outside',x:87,y:82}},
 nextLevel:[{level:'Splash1',page:'outside',x:36.7,y:20.3},{level:'Splash2A',page:'outside',x:36.7,y:24.3}],
 criteria:{'Splash1:1:1':{page:'inside',x:4.1,y:13.5},'Splash1:1:2':{page:'inside',x:4.2,y:16.8},'Splash1:2:1':{page:'inside',x:4.2,y:20}}};

describe('reportCardMarks',()=>{
 it('ticks a criterion after three successful marks and every criterion of a skill with three successful attempts',()=>{
  const twice=[1,2].map(()=>attempt('Splash1:1',[['Splash1:1:1','successful'],['Splash1:1:2','not_yet']],false));
  const third=attempt('Splash1:1',[['Splash1:1:1','successful'],['Splash1:1:2','not_yet']],false);
  expect([...reportCardMarks(twice,'Splash1',V).ticked]).toEqual([]);
  expect([...reportCardMarks([...twice,third],'Splash1',V).ticked]).toEqual(['Splash1:1:1']);
  const jumps=[1,2,3].map(()=>attempt('Splash1:2',[['Splash1:2:1','successful']],true));
  const marks=reportCardMarks(jumps,'Splash1',V);
  expect(marks.ticked.has('Splash1:2:1')).toBe(true);expect([...marks.completeSkills]).toEqual(['Splash1:2']);expect(marks.levelComplete).toBe(false);
 });
 it('ignores deleted attempts, other curriculum versions, other levels and attendance',()=>{
  const ok=(over:Partial<ResultRecord>)=>attempt('Splash1:2',[['Splash1:2:1','successful']],true,over);
  const marks=reportCardMarks([ok({}),ok({}),ok({deleted:true}),ok({curriculumVersion:'old'}),attempt('Splash2A:1',[['Splash2A:1:1','successful']],true),{...ok({}),kind:'attendance'}],'Splash1',V);
  expect(marks.ticked.size).toBe(0);
 });
 it('completes the level only when every skill has three successful attempts',()=>{
  const all=levelSkills('Splash1').flatMap(s=>[1,2,3].map(()=>attempt(s,[],true)));
  expect(reportCardMarks(all,'Splash1',V).levelComplete).toBe(true);
  expect(reportCardMarks(all.slice(1),'Splash1',V).levelComplete).toBe(false);
 });
});

describe('recommendedNextLevel',()=>{
 it('recommends the next level after a complete level and the same level otherwise',()=>{
  expect(recommendedNextLevel(map,true)?.level).toBe('Splash2A');
  expect(recommendedNextLevel(map,false)?.level).toBe('Splash1');
 });
});

describe('linked extra boxes',()=>{
 it('ticks a box with no criterion of its own when all, or any, of its linked criteria are ticked',()=>{
  const linkedMap:ReportCardMap={...map,extraBoxes:[{page:'inside',x:50,y:50,label:'roll back to front',ticksWith:['Splash1:1:1','Splash1:1:2']},{page:'outside',x:4,y:38,label:'Water Smart participation',ticksWith:['Splash1:1:1','Splash1:2:1'],match:'any'},{page:'inside',x:9,y:9,label:'unlinked'}]};
  const html=(ticked:string[])=>new DOMParser().parseFromString(buildReportCardHtml([{map:linkedMap,participant:'A',instructor:'B',date:'',session:'',marks:{ticked:new Set(ticked),completeSkills:new Set(),levelComplete:false}}],{paper:'preprinted',imageBase:'',title:''}),'text/html');
  expect([...html(['Splash1:1:1']).querySelectorAll('[data-linked]')].map(e=>e.getAttribute('data-linked'))).toEqual(['Splash1:1:1 Splash1:2:1']);
  expect(html(['Splash1:1:1','Splash1:1:2']).querySelectorAll('[data-linked]')).toHaveLength(2);
  expect(html([]).querySelectorAll('[data-linked]')).toHaveLength(0);
 });
});

describe('buildReportCardHtml',()=>{
 const card={map,participant:'Ana <O’Neil>',instructor:'Cleo',date:'2025-06-17',session:'Spring 2025',marks:{ticked:new Set(['Splash1:1:2']),completeSkills:new Set<string>(),levelComplete:false}};
 it('prints outside then inside as landscape pages with the scan, fields, ticked boxes and the next level',()=>{
  const doc=new DOMParser().parseFromString(buildReportCardHtml([card,card],{paper:'blank',imageBase:'/report-cards/',title:'Report cards'}),'text/html');
  expect([...doc.querySelectorAll('.rc-page')].map(p=>p.getAttribute('data-side'))).toEqual(['outside','inside','outside','inside']);
  expect(doc.querySelector('style')!.textContent).toContain('size:letter landscape');
  const outside=doc.querySelector('.rc-page[data-side="outside"]')!,inside=doc.querySelector('.rc-page[data-side="inside"]')!;
  expect(outside.querySelector('img')!.getAttribute('src')).toBe('/report-cards/splash-1-outside.jpg');
  expect(outside.querySelector('[data-field="participant"]')!.textContent).toBe('Ana <O’Neil>');
  expect(outside.querySelector('[data-next-level]')!.getAttribute('data-next-level')).toBe('Splash1');
  expect([...inside.querySelectorAll('[data-criterion]')].map(t=>t.getAttribute('data-criterion'))).toEqual(['Splash1:1:2']);
  expect((inside.querySelector('[data-criterion]') as HTMLElement).style.left).toBe('4.2%');
 });
 it('leaves the scan out for pre-printed cards',()=>{
  const doc=new DOMParser().parseFromString(buildReportCardHtml([card],{paper:'preprinted',imageBase:'/report-cards/',title:'x'}),'text/html');
  expect(doc.querySelectorAll('img')).toHaveLength(0);expect(doc.querySelectorAll('.rc-tick')).toHaveLength(2);
 });
});

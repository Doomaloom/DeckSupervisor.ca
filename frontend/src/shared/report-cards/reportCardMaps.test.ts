// Every report card map must match the current curriculum (generated from the rec-tablet catalog, whose source is the report cards) and point at page images that exist.
import {describe,expect,it} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {reportCardMap,type ReportCardMap} from './reportCards';
import curriculum from '../../features/results/curriculum.json';

type Catalog={levels:{id:string;skills:{id:string;subskills:{id:string}[]}[]}[]};
const dir=path.resolve(__dirname,'maps'),publicDir=path.resolve(__dirname,'../../../public/report-cards');
// Built from the website's own copy so the test also runs in a checkout without rec-tablet.
const levelOf=(id:string)=>id.split(':')[0],skillOf=(id:string)=>id.split(':').slice(0,2).join(':');
const catalog:Catalog={levels:[...new Set(Object.keys(curriculum.skills).map(levelOf))].map(id=>({id,skills:Object.keys(curriculum.skills).filter(s=>levelOf(s)===id).map(s=>({id:s,subskills:Object.keys(curriculum.criteria).filter(c=>skillOf(c)===s).map(c=>({id:c}))}))}))};
const maps=fs.readdirSync(dir).filter(f=>f.endsWith('.json')).map(f=>JSON.parse(fs.readFileSync(path.join(dir,f),'utf8')) as ReportCardMap);
const inRange=(p:{x:number;y:number})=>p.x>=0&&p.x<=100&&p.y>=0&&p.y<=100;

describe('report card maps',()=>{
 it('covers every catalog level except Splash Fitness and Splash Private, which have no card',()=>{
  const levels=catalog.levels.map(l=>l.id).filter(l=>l!=='SplashFitness'&&l!=='SplashPrivate').sort();
  expect(maps.map(m=>m.level).sort()).toEqual(levels);
  for(const l of levels)expect(reportCardMap(l)?.level).toBe(l);
 });
 for(const map of maps)describe(map.level,()=>{
  const level=catalog.levels.find(l=>l.id===map.level)!;
  const own=level.skills.flatMap(s=>s.subskills.map(x=>x.id));
  it('maps every subskill of the catalog exactly once, with nothing unmapped',()=>{
   expect(map.unmapped??[]).toEqual([]);
   expect(Object.keys(map.criteria).sort()).toEqual([...own].sort());
   expect(new Set(own).size).toBe(own.length);
  });
  it('only ticks real subskills of the level and headings of real skills',()=>{
   for(const b of map.extraBoxes??[]){
    expect(b.ticksWith?.length,b.label).toBeGreaterThan(0);
    for(const id of b.ticksWith??[])expect(own,`${b.label} ticksWith ${id}`).toContain(id);
   }
   const skillIds=level.skills.map(s=>s.id);
   for(const id of Object.keys(map.skills??{}))expect(skillIds,id).toContain(id);
  });
  it('places every box and field on the page, with no two criteria in one box',()=>{
   const points=[...Object.values(map.criteria),...map.nextLevel,...Object.values(map.fields),...(map.extraBoxes??[])];
   for(const p of points){expect(['outside','inside']).toContain(p.page);expect(inRange(p),JSON.stringify(p)).toBe(true);}
   const keys=Object.values(map.criteria).map(p=>`${p.page}:${p.x}:${p.y}`);expect(new Set(keys).size).toBe(keys.length);
   expect(Object.keys(map.fields).sort()).toEqual(['date','instructor','participant','session']);
  });
  it('points at page images that exist',()=>{
   for(const side of ['outside','inside'] as const)expect(fs.existsSync(path.join(publicDir,map.images[side])),map.images[side]).toBe(true);
  });
 });
});

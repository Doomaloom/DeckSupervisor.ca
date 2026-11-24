// Every report card map must match the curriculum and point at page images that exist.
import {describe,expect,it} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import curriculum from '../../features/results/curriculum.json';
import {reportCardMap,type ReportCardMap} from './reportCards';

const dir=path.resolve(__dirname,'maps'),publicDir=path.resolve(__dirname,'../../../public/report-cards');
const maps=fs.readdirSync(dir).filter(f=>f.endsWith('.json')).map(f=>JSON.parse(fs.readFileSync(path.join(dir,f),'utf8')) as ReportCardMap);
const criteria=Object.keys(curriculum.criteria as Record<string,string>);
const inRange=(p:{x:number;y:number})=>p.x>=0&&p.x<=100&&p.y>=0&&p.y<=100;

describe('report card maps',()=>{
 it('covers every curriculum level except Splash Fitness, which has no card',()=>{
  const levels=[...new Set(criteria.map(id=>id.split(':')[0]))].filter(l=>l!=='SplashFitness').sort();
  expect(maps.map(m=>m.level).sort()).toEqual(levels);
  for(const l of levels)expect(reportCardMap(l)?.level).toBe(l);
 });
 for(const map of maps)describe(map.level,()=>{
  const own=criteria.filter(id=>id.startsWith(`${map.level}:`));
  it('accounts for every criterion exactly once and names only real criteria',()=>{
   const mapped=Object.keys(map.criteria),unmapped=(map.unmapped??[]).map(u=>u.criterionId);
   for(const id of [...mapped,...unmapped])expect(own,id).toContain(id);
   expect([...mapped,...unmapped].sort()).toEqual([...own].sort());
   for(const b of map.extraBoxes??[])for(const id of b.ticksWith??[])expect(own,`${b.label} ticksWith ${id}`).toContain(id);
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

#!/usr/bin/env node
// Rebuilds src/shared/report-cards/maps/<Level>.json from rec-tablet's report card transcriptions.
// Usage: node scripts/report-cards/generate-maps-from-reportcards.mjs [path/to/rec-tablet/src/workflows/swimming/curriculum/reportcards]
// Keeps level, images, source, fields and nextLevel from the existing map; criteria, extraBoxes and skills come
// from the transcription (new subskill/skill ids); unmapped is always empty.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const mapsDir=path.resolve(here,'../../src/shared/report-cards/maps');
const cardsDir=path.resolve(process.argv[2]??path.resolve(here,'../../../../rec-tablet/src/workflows/swimming/curriculum/reportcards'));
if(!fs.existsSync(cardsDir)){console.error(`Transcriptions not found: ${cardsDir}`);process.exit(1);}

for(const file of fs.readdirSync(cardsDir).filter(f=>f.endsWith('.json')).sort()){
 const card=JSON.parse(fs.readFileSync(path.join(cardsDir,file),'utf8'));
 const mapFile=path.join(mapsDir,`${card.level}.json`);
 if(!fs.existsSync(mapFile)){console.error(`No existing map for ${card.level}; it supplies images/fields/nextLevel`);process.exit(1);}
 const old=JSON.parse(fs.readFileSync(mapFile,'utf8'));
 const criteria={},skills={};
 for(const skill of card.skills){
  if(skill.heading)skills[skill.id]=skill.heading;
  for(const sub of skill.subskills){
   if(criteria[sub.id])throw new Error(`${card.level}: duplicate subskill ${sub.id}`);
   criteria[sub.id]=sub.box;
  }
 }
// A shared Water Smart participation box is ticked once the swimmer has any message (as on the hand-made maps).
 const extraBoxes=(card.derivedBoxes??[]).map(d=>({page:d.box.page,x:d.box.x,y:d.box.y,label:d.label,ticksWith:d.ticksWith,...(/participation|water smart/i.test(d.label)?{match:'any'}:{}),...(d.box.highlight?{highlight:d.box.highlight}:{})}));
 const map={level:old.level,images:old.images,source:old.source,fields:old.fields,nextLevel:old.nextLevel,criteria,unmapped:[],extraBoxes,skills};
 fs.writeFileSync(mapFile,JSON.stringify(map,null,1)+'\n');
 console.log(`${card.level}: ${Object.keys(criteria).length} criteria, ${extraBoxes.length} extra boxes, ${Object.keys(skills).length} skill headings`);
}

import {readFileSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const catalogPath=process.argv[2]||resolve(root,'../rec-tablet/src/workflows/swimming/curriculum/catalog.json');
const catalog=JSON.parse(readFileSync(catalogPath,'utf8'));
const skills={},criteria={};
for(const level of catalog.levels)for(const skill of level.skills){skills[skill.id]=skill.name;for(const criterion of skill.subskills)criteria[criterion.id]=criterion.text;}
writeFileSync(resolve(root,'frontend/src/features/results/curriculum.json'),JSON.stringify({version:catalog.version,skills,criteria},null,2)+'\n');

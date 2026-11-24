import {readFileSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
// Writes the results website's curriculum labels: the CURRENT catalog (curriculum.json), the PREVIOUS one that old
// records were saved in (curriculum-previous.json) and the migration between them (curriculum-migration.json).
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const dir=resolve(root,'../rec-tablet/src/workflows/swimming/curriculum');
const catalogPath=process.argv[2]||resolve(dir,'catalog.json');
const migrationPath=process.argv[3]||resolve(dir,'catalog-migration.json');
const out=name=>resolve(root,'frontend/src/features/results',name);
const read=path=>JSON.parse(readFileSync(path,'utf8'));
function labels(catalog){
 const skills={},criteria={};
 for(const level of catalog.levels)for(const skill of level.skills){skills[skill.id]=skill.name;for(const criterion of skill.subskills)criteria[criterion.id]=criterion.text;}
 return {version:catalog.version,skills,criteria};
}
const catalog=read(catalogPath),migration=read(migrationPath);
if(migration.to!==catalog.version)throw new Error(`Migration targets ${migration.to}, but the catalog is ${catalog.version}.`);
const previousPath=resolve(dirname(catalogPath),`catalog-${migration.from}.json`);
const previous=read(previousPath);
if(previous.version!==migration.from)throw new Error(`${previousPath} is version ${previous.version}, not ${migration.from}.`);
const write=(name,value)=>writeFileSync(out(name),JSON.stringify(value,null,2)+'\n');
write('curriculum.json',labels(catalog));
write('curriculum-previous.json',labels(previous));
write('curriculum-migration.json',migration);

import {expect,it} from 'vitest'
import {readFileSync,existsSync} from 'node:fs'
import {resolve} from 'node:path'
import {curriculumLevels,findCurriculumLevel} from './lessonSkills'
import levels from './lessonSkills.json'

it.each([
 ['Splash 2a','Splash2A'],['Little Splash 3','LittleSplash3'],
 ['Parent & Tot 2','ParentandTot2'],['Teen / Adult 1','TeenAdult1'],
 ['Splash Fitness','SplashFitness'],['SplashPrivate',undefined],['',undefined],
 ['Unknown',undefined],['Splash 2',undefined],
])('matches %s without guessing a curriculum', (name,id)=>{
 expect(findCurriculumLevel(name)?.id).toBe(id)
})
const sourcePath=resolve(process.cwd(),'../../rec-tablet/internal/workflows/swimming/curriculum/catalog.json')
it.skipIf(!existsSync(sourcePath))('keeps generated curriculum aligned with the Rectab extraction',()=>{
 const source=JSON.parse(readFileSync(sourcePath,'utf8'))
 expect(levels).toEqual(source.levels.map(({id,name,skills}: {id:string;name:string;skills:{id:string;name:string}[]})=>({id,name,skills:skills.map(({id,name})=>({id,name}))})))
 expect(curriculumLevels.every(level=>level.skills.length>0)).toBe(true)
})

import {render,screen} from '@testing-library/react';
import {expect,it} from 'vitest';
import {RecordValue,skillName} from './StudentProgressModal';
import {CURRENT_CURRICULUM_VERSION as NEW,PREVIOUS_CURRICULUM_VERSION as OLD} from './translate';
import type {ResultOperation} from '../../lib/resultsApi';

const op=(curriculumVersion:string):ResultOperation=>({operationId:'o',sessionId:'s',datasetId:'d',classId:'c',enrollmentId:'e',recordId:'r',kind:'attempt',action:'upsert',baseRevision:0,lessonDate:'2026-09-04',curriculumVersion,
 payload:{skillId:'LittleSplash1:5a',results:[{subskillId:'LittleSplash1:5a:1',status:'successful'}]}});
it('labels a submitted record with the wording of the curriculum version it was saved in',()=>{
 const {unmount}=render(<RecordValue value={op(OLD)}/>);
 expect(screen.getByText('Relaxed float on front and on back (with assistance): Successful')).toBeVisible();unmount();
 render(<RecordValue value={op(NEW)}/>);
 expect(screen.getByText('Relaxed float on front (with assistance): Successful')).toBeVisible();
});
it('names skills in the current curriculum unless a version is given',()=>{
 expect(skillName('LittleSplash1:1')).toBe('Enter and exit shallow water (assisted)');
 expect(skillName('LittleSplash1:1',OLD)).toBe('Enter and Exit Shallow Water (Assisted)');
 expect(skillName(undefined)).toBe('Unknown skill');
});

import {render,screen} from '@testing-library/react';
import {it,expect,vi} from 'vitest';
import Attendance from './Attendance.component';
vi.mock('../../results/Results.component',()=>({InstructorResults:()=> <p>Submitted attendance and results</p>}));
it('uses the instructor results workspace',()=>{render(<Attendance/>);expect(screen.getByText('Submitted attendance and results')).toBeVisible()});

import {render,screen,within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {expect,it,vi} from 'vitest';
import {ReportCardOdditiesModal,type OdditiesInstructorGroup} from './ReportCardOdditiesModal';
import type {FixPlan,Oddity} from './oddities';

const oddity=(over:Partial<Oddity>={}):Oddity=>({id:'c1:e1:Splash2A:rhythmic kick',classId:'c1',enrollmentId:'e1',level:'Splash2A',key:'rhythmic kick',label:'Rhythmic kick',criteria:[
 {criterionId:'Splash2A:1:1',skillId:'Splash2A:1',skillName:'Flutter kick on front',ticked:true,successfulMarks:3,skillSuccesses:3,skillComplete:true,attempts:3},
 {criterionId:'Splash2A:2:1',skillId:'Splash2A:2',skillName:'Front crawl',ticked:false,successfulMarks:1,skillSuccesses:1,skillComplete:false,attempts:3}],skills:[{skillId:'Splash2A:1',skillName:'Flutter kick on front',successes:3,complete:true,attempts:3,criteria:[{criterionId:'Splash2A:1:1',label:'Rhythmic kick',ticked:true,successfulMarks:3,matched:true},{criterionId:'Splash2A:1:2',label:'Body on front',ticked:true,successfulMarks:3,matched:false}]},{skillId:'Splash2A:2',skillName:'Front crawl',successes:1,complete:false,attempts:3,criteria:[{criterionId:'Splash2A:2:1',label:'Rhythmic kick',ticked:false,successfulMarks:1,matched:true},{criterionId:'Splash2A:2:2',label:'Alternate arm action',ticked:false,successfulMarks:2,matched:false}]}],...over});
const plan=(over:Partial<FixPlan>={}):FixPlan=>({direction:'tick',possible:true,operations:[],changes:['Front crawl: Rhythmic kick, marks 2025-09-04','Adds 1 supervisor attempt dated 2025-09-11'],warnings:[],...over});
const groups=(extra:Oddity[]=[]):OdditiesInstructorGroup[]=>[{instructor:'Ana Instructor',classes:[{classId:'c1',code:'004201',title:'Splash 2A : 16:00',swimmers:[{enrollmentId:'e1',name:'Idris Patel',oddities:[oddity(),...extra]}]}]}];
function show(over:Partial<React.ComponentProps<typeof ReportCardOdditiesModal>>={}){
 const props={groups:groups(),ignored:new Set<string>(),busy:false,planFix:vi.fn(()=>plan()),onApply:vi.fn(),onIgnore:vi.fn(),onRestore:vi.fn(),onOpenProgress:vi.fn(),onClose:vi.fn(),...over};
 render(<ReportCardOdditiesModal {...props}/>);return props;
}

it('groups oddities by instructor, class and swimmer and shows both skills side by side with the matching subskill highlighted',()=>{
 show();
 expect(screen.getByRole('heading',{name:'Ana Instructor'})).toBeVisible();expect(screen.getByRole('heading',{name:'004201 Splash 2A : 16:00'})).toBeVisible();expect(screen.getByRole('heading',{name:'Idris Patel'})).toBeVisible();
 expect(screen.getByText(/is ticked in Flutter kick on front but not in Front crawl/)).toBeVisible();
 const front=screen.getByRole('region',{name:'Flutter kick on front'}),crawl=screen.getByRole('region',{name:'Front crawl'});
 expect(within(front).getByText('3 of 3 successful attempts · skill complete')).toBeVisible();expect(within(crawl).getByText('1 of 3 successful attempts · skill not complete')).toBeVisible();
 const row=(col:HTMLElement,label:string)=>within(col).getByText(label).closest('li')!;
 expect(row(front,'Rhythmic kick')).toHaveAttribute('data-matched','true');expect(row(front,'Rhythmic kick')).toHaveTextContent('✓ Ticked');
 expect(row(crawl,'Rhythmic kick')).toHaveAttribute('data-matched','true');expect(row(crawl,'Rhythmic kick')).toHaveTextContent('✗ Not ticked');expect(row(crawl,'Rhythmic kick')).toHaveTextContent('1 of 3 marks');
 expect(row(crawl,'Alternate arm action')).not.toHaveAttribute('data-matched');expect(row(front,'Body on front')).toHaveTextContent('3 marks');
});
it('previews a fix with its changes and warnings and applies the plan',async()=>{
 const p=plan({warnings:['Front crawl will drop to 2 of 3 successful attempts']});const props=show({planFix:vi.fn(()=>p)});const user=userEvent.setup();
 await user.click(screen.getByRole('button',{name:'Tick Rhythmic kick everywhere for Idris Patel'}));
 expect(props.planFix).toHaveBeenCalledWith(expect.objectContaining({id:'c1:e1:Splash2A:rhythmic kick'}),'tick');
 const preview=screen.getByRole('group',{name:/preview/});
 expect(within(preview).getByText('Adds 1 supervisor attempt dated 2025-09-11')).toBeVisible();expect(within(preview).getByText(/will drop to 2 of 3/)).toBeVisible();
 await user.click(screen.getByRole('button',{name:'Apply fix'}));
 expect(props.onApply).toHaveBeenCalledWith(p);expect(screen.queryByRole('group',{name:/preview/})).not.toBeInTheDocument();
});
it('uses the untick direction and can cancel a preview',async()=>{
 const props=show();const user=userEvent.setup();
 await user.click(screen.getByRole('button',{name:'Untick Rhythmic kick everywhere for Idris Patel'}));expect(props.planFix).toHaveBeenCalledWith(expect.anything(),'untick');
 await user.click(screen.getByRole('button',{name:'Cancel'}));expect(screen.queryByRole('button',{name:'Apply fix'})).not.toBeInTheDocument();expect(props.onApply).not.toHaveBeenCalled();
});
it('disables Apply fix when the plan is not possible',async()=>{
 show({planFix:()=>plan({possible:false,changes:[],warnings:['Timed skills cannot get new attempts']})});const user=userEvent.setup();
 await user.click(screen.getByRole('button',{name:'Tick Rhythmic kick everywhere for Idris Patel'}));
 expect(screen.getByRole('button',{name:'Apply fix'})).toBeDisabled();expect(screen.getByText('Timed skills cannot get new attempts')).toBeVisible();
});
it('ignores, shows ignored ones and restores them',async()=>{
 const props=show();const user=userEvent.setup();
 await user.click(screen.getByRole('button',{name:'Ignore Rhythmic kick for Idris Patel'}));expect(props.onIgnore).toHaveBeenCalledWith('c1:e1:Splash2A:rhythmic kick');
});
it('hides ignored oddities until Show ignored, then offers Restore',async()=>{
 const id='c1:e1:Splash2A:rhythmic kick',props=show({ignored:new Set([id])});const user=userEvent.setup();
 expect(screen.getByText('No oddities found. Every matching must-see agrees on each report card.')).toBeVisible();
 await user.click(screen.getByRole('button',{name:'Show ignored (1)'}));
 await user.click(screen.getByRole('button',{name:'Restore Rhythmic kick for Idris Patel'}));expect(props.onRestore).toHaveBeenCalledWith(id);
 expect(screen.queryByRole('button',{name:/^Tick /})).not.toBeInTheDocument();
});
it('opens progress and closes on Escape',async()=>{
 const props=show();const user=userEvent.setup();
 await user.click(screen.getByRole('button',{name:'Open skill progress for Idris Patel'}));expect(props.onOpenProgress).toHaveBeenCalledWith('c1','e1');
 await user.keyboard('{Escape}');expect(props.onClose).toHaveBeenCalled();
});
it('shows page errors and notices inside the modal',()=>{show({error:'Boom',notice:'Fixed it'});expect(screen.getByRole('alert')).toHaveTextContent('Boom');expect(screen.getByRole('status')).toHaveTextContent('Fixed it');});

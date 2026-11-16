// Synthetic, disposable provider only. Run via scripts/test-results-roundtrip.sh.
import {chromium} from 'playwright-core';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
const fixture=JSON.parse(await readFile(process.argv[2],'utf8'));
const out=resolve(process.argv[3]||'../tmp/results-browser');
await mkdir(out,{recursive:true});
const base='http://127.0.0.1:18082', path=`/api/sessions/${fixture.sessionId}/results`;
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true});
const evidence={syntheticOnly:true,fixture,checks:[]};
async function api(context,url=path){const r=await context.request.get(base+url);assert.equal(r.status(),200);return r.json();}
async function login(page,email='supervisor@example.invalid'){
 await page.goto(base+'/sign-in');await page.getByPlaceholder('Email',{exact:true}).fill(email);
 await page.getByPlaceholder('Password',{exact:true}).fill('Synthetic-test-only-42!');
 await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.waitForURL(base+'/');
}
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000}});
 // Keep the print popup open when Chromium's PDF capture fires afterprint.
 await context.addInitScript(()=>{window.print=()=>{window.__printed=true;};window.close=()=>{};});
 const page=await context.newPage();await login(page);
 await page.getByRole('button',{name:'Select Existing Session',exact:true}).click();
 await page.getByRole('button').filter({hasText:'Synthetic Pool A'}).click();
 await page.goto(base+'/results');await page.getByRole('heading',{name:'Attendance and results',exact:true}).waitFor();
 const pkg={schemaVersion:1,kind:'rec-tablet-classes',datasetId:fixture.datasetId,instructor:'Alex',courses:[{sourceId:fixture.courseSourceId,name:'Synthetic QA Class',level:'Splash1',startTime:'09:00',location:'Pool',lessonDates:[fixture.lessonDate],swimmers:[{sourceId:fixture.swimmerSourceId,name:'Synthetic QA Swimmer'}]}]};
 await page.waitForFunction(()=>{const input=document.querySelector('input[type=file]');return input&&!input.disabled;});
 await page.getByLabel('Load local class package to resolve names (stays in this browser)').setInputFiles({name:'synthetic.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(pkg))});
 await page.locator('label').filter({hasText:/^Class/}).locator('select').selectOption(fixture.classId);
 await page.locator('article strong').filter({hasText:/^Synthetic QA Swimmer$/}).first().waitFor();
 let data=await api(context);
 const attempt=()=>data.records.find(r=>r.recordId===fixture.attemptId);
 assert.equal(attempt().revision,2);assert.equal(attempt().success,false);
 assert.equal(data.records.find(r=>r.recordId===fixture.deletedAttemptId).deleted,true);
 assert.equal(data.records.find(r=>r.kind==='attendance').payload.status,'absent');
 assert.ok(data.history.filter(r=>r.recordId===fixture.attemptId).length>=2);
 const article=page.locator('article').filter({has:page.getByText('Correct submitted assessment',{exact:true})});
 assert.equal(await article.count(),1);
 await article.getByText('Revision history',{exact:true}).click();
 await article.getByText(/Revision 1 ·/).waitFor();await article.getByText('Not yet',{exact:false}).first().waitFor();
 await article.getByText('Correct submitted assessment',{exact:true}).click();
 const selects=article.locator('select');for(let i=0;i<await selects.count();i++)await selects.nth(i).selectOption('successful');
 await article.getByRole('button',{name:'Save correction as a new revision',exact:true}).click();
 await page.getByRole('status').filter({hasText:'Saved as a new revision.'}).waitFor();
 data=await api(context);assert.equal(attempt().revision,3);assert.equal(attempt().success,true);
 await page.getByText(/1 \/ 3 successful attempts/).waitFor();
 const current=attempt();const {revision,deleted,success,updatedAt,...operation}=current;
 const conflict=await context.request.post(base+path,{data:{schemaVersion:1,operations:[{...operation,operationId:randomUUID(),baseRevision:1,payload:{...operation.payload,results:operation.payload.results.map(c=>({...c,status:'not_yet'}))}}]}});
 assert.equal(conflict.status(),200);assert.equal((await conflict.json()).receipts[0].status,'pending_review');
 await page.getByRole('button',{name:'Refresh submissions',exact:true}).click();
 await page.getByRole('button',{name:'Accept incoming',exact:true}).waitFor();
 await page.getByRole('button',{name:'Accept incoming',exact:true}).click();
 await page.getByRole('button',{name:'Refresh submissions',exact:true}).waitFor({state:'visible'});
 await page.getByRole('button',{name:'Accept incoming',exact:true}).waitFor({state:'detached'});
 data=await api(context);assert.equal(attempt().revision,4);assert.equal(attempt().success,false);
 assert.equal(data.conflicts.filter(c=>!c.resolved).length,0);
 await page.getByText(/0 \/ 3 successful attempts/).waitFor();
 for(const [name,viewport] of [['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}]]){
  await page.setViewportSize(viewport);
  if(name==='mobile')await page.getByRole('button',{name:'Collapse sidebar',exact:true}).click();
  await page.locator('#layout-main').evaluate(el=>{el.scrollTop=0;});
  await page.screenshot({path:resolve(out,`${name}-results.png`),fullPage:true});
  const contentWidth=await page.locator('article').first().evaluate(el=>el.getBoundingClientRect().width);
  assert.ok(contentWidth>=200,`Results need a readable content width; got ${contentWidth}px at ${viewport.width}px`);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 }
 await page.setViewportSize({width:1440,height:1000});
 const popupPromise=context.waitForEvent('page');await page.getByRole('button',{name:'Print completed sheets',exact:true}).click();
 const popup=await popupPromise;await popup.waitForFunction(()=>window.__printed===true);
 const rows=await popup.locator('[data-generated-attendance-row]').evaluateAll(rows=>rows.map(row=>({enrollmentId:row.dataset.enrollmentId,text:row.textContent,checks:[...row.querySelectorAll('[data-earned-checks]')].map(c=>Number(c.dataset.earnedChecks))})));
 assert.equal(rows.length,1);assert.equal(rows[0].enrollmentId,fixture.enrollmentId);assert.match(rows[0].text,/Synthetic QA Swimmer/);assert.ok(rows[0].text.includes(`${fixture.lessonDate.slice(5).replace('-', '/')} ×`));assert.ok(rows[0].checks.every(n=>n===0));
 await popup.pdf({path:resolve(out,'completed-results.pdf'),preferCSSPageSize:true,printBackground:true});
 await writeFile(resolve(out,'completed-print.html'),await popup.content());
 const other=await browser.newContext();const otherPage=await other.newPage();await login(otherPage,'instructor-b@example.invalid');
 const response=await other.request.get(base+path);
 if(response.status()===200){const otherData=await response.json();assert.equal(otherData.records.some(r=>r.classId===fixture.classId),false);}else assert.ok([403,404].includes(response.status()));
 evidence.checks=['tablet accepted criteria and attendance','corrected revision and tombstone history','browser correction revision 3','stale conflict pending review','supervisor incoming resolution revision 4','accepted progress excludes deleted and unsuccessful attempts','desktop/mobile no horizontal overflow','completed print marks match canonical server','instructor B isolated'];
 evidence.printRows=rows;evidence.finalResults=data;evidence.crossAccountStatus=response.status();
 await writeFile(resolve(out,'results.json'),JSON.stringify(evidence,null,2));console.log(JSON.stringify({passed:true,checks:evidence.checks,output:out},null,2));
}finally{await browser.close();}

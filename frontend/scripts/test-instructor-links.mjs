import {chromium} from 'playwright-core'
import {resolve} from 'node:path'
import {writeFile} from 'node:fs/promises'
import assert from 'node:assert/strict'
const base='http://127.0.0.1:18082',out=resolve('docs/qa/cycle-2/screenshots')
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true})
try{
 const supervisor=await browser.newContext({viewport:{width:1440,height:1000}}),page=await supervisor.newPage()
 await page.goto(base+'/sign-in');await page.getByPlaceholder('Email',{exact:true}).fill('supervisor@example.invalid');await page.getByPlaceholder('Password',{exact:true}).fill('Synthetic-test-only-42!');await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.waitForURL(base+'/')
 await page.getByRole('button',{name:'Select Existing Session',exact:true}).click()
 await page.getByRole('button').filter({hasText:'Synthetic Pool A'}).click()
 await page.getByRole('link',{name:'Schematic',exact:true}).click()
 const panel=page.getByRole('region',{name:'Instructor account links'})
 await panel.getByRole('button',{name:'Unlink',exact:true}).first().waitFor()
 await page.screenshot({path:resolve(out,'supervisor-account-links.png'),fullPage:true})
 const rows=await (await supervisor.request.get(base+'/api/sessions/20000000-0000-0000-0000-000000000004/instructor-assignments')).json()
 const aid=rows.assignments.find(a=>a.account_id?.endsWith('07')).id
 const first=panel.locator('form').filter({has:page.locator(`input[value="00000000-0000-0000-0000-000000000007"]`)})
 await first.getByRole('button',{name:'Unlink',exact:true}).click()
 await page.waitForResponse(r=>r.url().includes('instructor-assignments')&&r.request().method()==='GET')
 const a=await browser.newContext();await a.request.post(base+'/api/auth/sign-in',{data:{email:'instructor-a@example.invalid',password:'Synthetic-test-only-42!'}})
 const classes=await (await a.request.get(base+'/api/instructor/sessions/20000000-0000-0000-0000-000000000004/classes')).json();assert.equal(classes.classes.length,0)
 const input=panel.getByLabel('Account UUID for Alex').first();await input.fill('00000000-0000-0000-0000-000000000008');await panel.locator('form').first().getByRole('button',{name:'Save link',exact:true}).click()
 await page.waitForResponse(r=>r.url().includes('instructor-assignments')&&r.request().method()==='GET')
 const b=await browser.newContext();await b.request.post(base+'/api/auth/sign-in',{data:{email:'instructor-b@example.invalid',password:'Synthetic-test-only-42!'}})
 const transferred=(await (await b.request.get(base+'/api/instructor/sessions/20000000-0000-0000-0000-000000000004/classes')).json()).classes.find(c=>c.code==='A')
 assert.ok(transferred)
 const plan=await b.request.get(base+`/api/instructor/sessions/20000000-0000-0000-0000-000000000004/classes/${transferred.id}/plans/2026-10-05`)
 assert.equal(plan.status(),200);assert.equal((await plan.json()).plan.rows[0].skill,'mobile floating practice')
 const old=await a.request.get(base+`/api/instructor/sessions/20000000-0000-0000-0000-000000000004/classes/${transferred.id}/plans/2026-10-05`);assert.equal(old.status(),403)
 await supervisor.request.patch(base+`/api/sessions/20000000-0000-0000-0000-000000000004/instructor-assignments/${aid}`,{data:{account_id:'00000000-0000-0000-0000-000000000007'}})
 await page.getByRole('link',{name:'Instructor View',exact:true}).click();await page.getByRole('heading',{name:'My Classes',exact:true}).waitFor();await page.getByRole('link',{name:'Supervisor View',exact:true}).click();await page.getByRole('link',{name:'Schematic',exact:true}).click();await panel.getByRole('button',{name:'Unlink',exact:true}).first().waitFor()
 const result={unlinkHidesClasses:true,reassignmentRetainsSavedPlan:true,previousAccountPlanStatus:old.status(),authorizedReturnPreservesSupervisorSession:true}
 await writeFile(resolve(out,'link-results.json'),JSON.stringify(result,null,2));console.log(result)
 await supervisor.close();await a.close();await b.close()
}finally{await browser.close()}

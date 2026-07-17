import html2canvas from 'html2canvas'
import legacyStyles from './features/pdf/attendance/legacyAttendance.css?inline'
import sansRegular from './features/pdf/fonts/LiberationSans-Regular.ttf?url'
import sansBold from './features/pdf/fonts/LiberationSans-Bold.ttf?url'
import serifRegular from './features/pdf/fonts/LiberationSerif-Regular.ttf?url'
import serifBold from './features/pdf/fonts/LiberationSerif-Bold.ttf?url'
import type { PreparedAttendanceGroup, PreparedAttendancePage } from './features/pdf/attendance/legacyAttendanceDom'
import { ATTENDANCE_CAPTURE_PIXEL_RATIO, ATTENDANCE_STAGE_HEIGHT, ATTENDANCE_STAGE_WIDTH, computeAttendanceContentScale } from './features/pdf/attendance/attendanceCaptureConstants'

const fontRules = (urls: [string,string,string,string]) => `@font-face{font-family:Arial;src:url("${urls[0]}");font-weight:400}@font-face{font-family:Arial;src:url("${urls[1]}");font-weight:700}@font-face{font-family:Calibri;src:url("${urls[0]}");font-weight:400}@font-face{font-family:Calibri;src:url("${urls[1]}");font-weight:700}@font-face{font-family:"Times New Roman";src:url("${urls[2]}");font-weight:400}@font-face{font-family:"Times New Roman";src:url("${urls[3]}");font-weight:700}@font-face{font-family:Times;src:url("${urls[2]}");font-weight:400}@font-face{font-family:Times;src:url("${urls[3]}");font-weight:700}`
const externalFontCss = fontRules([sansRegular,sansBold,serifRegular,serifBold])
function installStyles(group: PreparedAttendanceGroup) {
  document.querySelectorAll('[data-attendance-style]').forEach(node=>node.remove()); const holder=document.createElement('template'); holder.innerHTML=group.headHtml
  holder.content.querySelectorAll('style').forEach(source=>{const style=document.createElement('style');style.dataset.attendanceStyle='';style.textContent=source.textContent;document.head.append(style)})
  const style=document.createElement('style');style.dataset.attendanceStyle='';style.textContent=`${externalFontCss}\n${legacyStyles}`;document.head.append(style)
}
function createStage(page: PreparedAttendancePage) {
  const stage=document.createElement('div');stage.className='attendance-page-stage';stage.dataset.pageKind=page.kind
  const printable=document.createElement('div');printable.className='attendance-page-printable';const content=document.createElement('div');content.className='attendance-page-content combined-page';content.innerHTML=page.html
  printable.append(content);stage.append(printable);document.body.append(stage);const width=Math.max(content.scrollWidth,content.getBoundingClientRect().width);const height=Math.max(content.scrollHeight,content.getBoundingClientRect().height)
  content.style.width=`${width}px`;content.style.height=`${height}px`;content.style.transform=`scale(${computeAttendanceContentScale(width,height)})`;return stage
}
function timeout<T>(promise: Promise<T>, label: string) { return new Promise<T>((resolve,reject)=>{const timer=window.setTimeout(()=>reject(new Error(`Attendance ${label} capture exceeded 30 seconds.`)),30000);promise.then(value=>{clearTimeout(timer);resolve(value)},error=>{clearTimeout(timer);reject(error)})}) }
const capture = async (group: PreparedAttendanceGroup) => {
  document.body.replaceChildren();group.bodyAttributes.forEach(([name,value])=>document.body.setAttribute(name,value));installStyles(group);await document.fonts.ready;const blobs:Blob[]=[]
  for(const page of group.pages){const stage=createStage(page);await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));const label=`${page.templateKeys.join('+')} ${page.kind}`;const canvas=await timeout(html2canvas(stage,{width:ATTENDANCE_STAGE_WIDTH,height:ATTENDANCE_STAGE_HEIGHT,scale:ATTENDANCE_CAPTURE_PIXEL_RATIO,backgroundColor:'#fff',useCORS:true,logging:false,removeContainer:true}),label);const blob=await timeout(new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('Canvas returned no PNG.')),'image/png')),label);blobs.push(blob);stage.remove()}
  return blobs as [Blob,Blob]
}
window.addEventListener('message', async event => {
  if (event.origin !== location.origin || event.data?.type !== 'attendance-capture-request') return
  try { const blobs = await capture(event.data.group); parent.postMessage({type:'attendance-capture-result',id:event.data.id,blobs},event.origin) }
  catch(error){ parent.postMessage({type:'attendance-capture-error',id:event.data.id,message:error instanceof Error?error.message:String(error)},event.origin) }
})
parent.postMessage({type:'attendance-capture-ready'}, location.origin)

import curriculum from '../../features/results/curriculum.json';
import type {ResultRecord} from '../../lib/resultsApi';

export type CardPage='outside'|'inside';
export type CardRect={x:number;y:number;w:number;h:number};
export type CardPoint={page:CardPage;x:number;y:number;highlight?:CardRect};
export type ReportCardMap={
 level:string;images:Record<CardPage,string>;source?:{pdf:string;outsidePage:number;insidePage:number};
 fields:Partial<Record<'participant'|'instructor'|'date'|'session',CardPoint>>;
 nextLevel:(CardPoint&{level:string})[];criteria:Record<string,CardPoint>;
 /** Skill headings on the card, highlighted while the skill is not achieved. */
 skills?:Record<string,(CardRect&{page:CardPage})|(CardRect&{page:CardPage})[]>;
 unmapped?:{criterionId:string;reason:string}[];
 /** Boxes with no criterion of their own. One with `ticksWith` ticks when all (or, with match "any", one) of those criteria are ticked. */
 extraBoxes?:(CardPoint&{label:string;ticksWith?:string[];match?:'all'|'any'})[];
};
const maps=import.meta.glob<ReportCardMap>('./maps/*.json',{eager:true,import:'default'});
const byLevel=new Map(Object.values(maps).map(m=>[m.level.toLowerCase(),m]));
export const reportCardMap=(levelId:string)=>byLevel.get(levelId.toLowerCase());

/** Successful marks needed on one criterion before its box is ticked, matching the 3 successful attempts that complete a skill. */
export const CRITERION_TICK_THRESHOLD=3;
const criterionIds=Object.keys(curriculum.criteria as Record<string,string>),skillIds=Object.keys(curriculum.skills as Record<string,string>);
export const levelSkills=(levelId:string)=>skillIds.filter(id=>id.startsWith(`${levelId}:`));
const skillCriteria=(skillId:string)=>criterionIds.filter(id=>id.startsWith(`${skillId}:`));

export type ReportCardMarks={ticked:Set<string>;completeSkills:Set<string>;levelComplete:boolean};
/**
 * Accepted, nondeleted attempts of the given curriculum version decide the ticks. A criterion is ticked once it was
 * marked successful on CRITERION_TICK_THRESHOLD attempts; a skill with that many successful attempts ticks all its criteria.
 */
export function reportCardMarks(records:ResultRecord[],levelId:string,curriculumVersion:string):ReportCardMarks{
 const skillSuccess=new Map<string,number>(),criterionSuccess=new Map<string,number>();
 for(const r of records){
  if(r.deleted||r.kind!=='attempt'||r.curriculumVersion!==curriculumVersion||!r.payload.skillId?.startsWith(`${levelId}:`))continue;
  if(r.success)skillSuccess.set(r.payload.skillId,(skillSuccess.get(r.payload.skillId)??0)+1);
  for(const c of r.payload.results??[])if(c.status==='successful')criterionSuccess.set(c.subskillId,(criterionSuccess.get(c.subskillId)??0)+1);
 }
 const completeSkills=new Set(levelSkills(levelId).filter(s=>(skillSuccess.get(s)??0)>=CRITERION_TICK_THRESHOLD));
 const ticked=new Set<string>();
 for(const s of levelSkills(levelId))for(const c of skillCriteria(s))if(completeSkills.has(s)||(criterionSuccess.get(c)??0)>=CRITERION_TICK_THRESHOLD)ticked.add(c);
 const skills=levelSkills(levelId);
 return {ticked,completeSkills,levelComplete:skills.length>0&&skills.every(s=>completeSkills.has(s))};
}
/** A swimmer who completed every skill is recommended the next level printed on the card; otherwise the same level again. */
export function recommendedNextLevel(map:ReportCardMap,levelComplete:boolean){
 const same=map.nextLevel.find(o=>o.level.toLowerCase()===map.level.toLowerCase());
 return levelComplete?map.nextLevel.find(o=>o!==same):same;
}

export type ReportCardPrint={map:ReportCardMap;participant:string;instructor:string;date:string;session:string;marks:ReportCardMarks};
export type ReportCardPaper='blank'|'preprinted';
const esc=(v:string)=>v.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]!);
const at=(p:CardPoint)=>`left:${p.x}%;top:${p.y}%`;
/**
 * Every card prints as two landscape letter pages, outside then inside, for duplex printing (flip on the short edge).
 * On blank paper the scan prints behind the marks; on pre-printed cards only the marks print.
 */
const linkedTicked=(b:NonNullable<ReportCardMap['extraBoxes']>[number],ticked:Set<string>)=>!!b.ticksWith?.length&&(b.match==='any'?b.ticksWith.some(id=>ticked.has(id)):b.ticksWith.every(id=>ticked.has(id)));
/** A skill heading stays highlighted until every one of its criteria printed on the card is ticked (or, with none printed, the skill is complete). */
export function skillAchieved(map:ReportCardMap,skillId:string,marks:ReportCardMarks){
 const onCard=Object.keys(map.criteria).filter(id=>id.startsWith(`${skillId}:`));
 return onCard.length?onCard.every(id=>marks.ticked.has(id)):marks.completeSkills.has(skillId);
}
export function buildReportCardHtml(cards:ReportCardPrint[],{paper,imageBase,title,highlight=false}:{paper:ReportCardPaper;imageBase:string;title:string;highlight?:boolean}){
 const page=(card:ReportCardPrint,side:CardPage)=>{
  const {map,marks}=card,next=recommendedNextLevel(map,marks.levelComplete);
  const linked=(map.extraBoxes??[]).filter(b=>b.page===side&&linkedTicked(b,marks.ticked));
  // Highlights mark what is not achieved yet: unticked criteria and linked boxes, and the headings of unfinished skills.
  const areas=new Map<string,string>();
  if(highlight){
   const add=(r:CardRect|undefined,kind:string,id:string)=>{if(!r)return;const key=`${r.x}:${r.y}:${r.w}:${r.h}`;if(!areas.has(key))areas.set(key,`<span class="rc-hl" data-${kind}="${esc(id)}" style="left:${r.x}%;top:${r.y}%;width:${r.w}%;height:${r.h}%"></span>`);};
   for(const [id,p] of Object.entries(map.criteria))if(p.page===side&&!marks.ticked.has(id))add(p.highlight,'hl-criterion',id);
   for(const b of map.extraBoxes??[])if(b.page===side&&b.ticksWith?.length&&!linkedTicked(b,marks.ticked))add(b.highlight,'hl-linked',b.ticksWith.join(' '));
   for(const [id,value] of Object.entries(map.skills??{}))for(const r of Array.isArray(value)?value:[value])if(r.page===side&&!skillAchieved(map,id,marks))add(r,'hl-skill',id);
  }
  const ticks=[...Object.entries(map.criteria).filter(([id,p])=>p.page===side&&marks.ticked.has(id)).map(([id,p])=>`<span class="rc-tick" data-criterion="${esc(id)}" style="${at(p)}">✓</span>`),
   ...linked.map(b=>`<span class="rc-tick" data-linked="${esc(b.ticksWith!.join(' '))}" style="${at(b)}">✓</span>`),
   ...(next&&next.page===side?[`<span class="rc-tick rc-next" data-next-level="${esc(next.level)}" style="${at(next)}">✓</span>`]:[])];
  const fields=(['participant','instructor','date','session'] as const).flatMap(name=>{const p=map.fields[name];return p&&p.page===side?[`<span class="rc-field" data-field="${name}" style="${at(p)}">${esc(card[name])}</span>`]:[]});
  return `<section class="rc-page" data-level="${esc(map.level)}" data-side="${side}">${paper==='blank'?`<img class="rc-scan" alt="" src="${esc(imageBase+map.images[side])}">`:''}${[...areas.values()].join('')}${fields.join('')}${ticks.join('')}</section>`;
 };
 return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>
@page{size:letter landscape;margin:0}
*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff}
.rc-page{position:relative;width:11in;height:8.5in;overflow:hidden;break-after:page;page-break-after:always}
.rc-page:last-child{break-after:auto;page-break-after:auto}
.rc-scan{position:absolute;inset:0;width:100%;height:100%}
.rc-hl{position:absolute;background:rgba(255,222,0,.45);mix-blend-mode:multiply;border-radius:2px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.rc-tick{position:absolute;transform:translate(-45%,-58%);font:700 0.26in/1 Arial,sans-serif;color:#0b2a8a}
.rc-field{position:absolute;transform:translate(0.06in,-55%);font:600 11pt/1 Arial,sans-serif;color:#0b2a8a;white-space:nowrap}
@media screen{body{background:#666}.rc-page{margin:0.25in auto;background:#fff;box-shadow:0 2px 8px #0006}}
</style></head><body>${cards.flatMap(c=>[page(c,'outside'),page(c,'inside')]).join('')}</body></html>`;
}

/** Writes the cards into an already-open window, waits for the scans, then opens the print dialog. */
export async function printReportCards(html:string,printWindow:Window,timeoutMs=20_000){
 printWindow.document.open();printWindow.document.write(html);printWindow.document.close();
 const images=[...printWindow.document.images];
 await Promise.race([
  Promise.all(images.map(img=>img.complete?Promise.resolve():new Promise<void>((resolve,reject)=>{img.addEventListener('load',()=>resolve(),{once:true});img.addEventListener('error',()=>reject(new Error(`Report card scan did not load: ${img.getAttribute('src')}`)),{once:true});}))),
  new Promise((_,reject)=>setTimeout(()=>reject(new Error('Report card scans took too long to load.')),timeoutMs)),
 ]);
 printWindow.addEventListener('afterprint',()=>printWindow.close(),{once:true});
 printWindow.focus();printWindow.print();
}

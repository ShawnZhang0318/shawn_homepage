import { attachScreenPanel } from './screen-panel.js?v=nearby-links';
import { studio, paintStudio, drawText, drawWrapped, line } from './screen-browser.js?v=dark-studio';
import { posts, readingMinutes } from '../posts/content.js';

const WIDTH = 1000, HEIGHT = 482;
const categories = ['ALL', 'SYSTEMS', 'ROBOTICS', 'NOTES'];
const summaries = [
  ['NOTES', 'How this room came together in Blender and on the web. A few things worked straight away. Most took another pass.'],
  ['ROBOTICS', 'A space for notes from RoboMaster: the builds, the people and the competition. This entry is a placeholder for a future draft.'],
  ['ROBOTICS', 'A future write-up about debugging a robot when something stops working. The story and technical details are still to come.'],
  ['SYSTEMS', 'A place to collect small AI tools and experiments worth keeping. This entry is a placeholder; the list is still being put together.'],
  ['NOTES', 'Some thoughts on making a workspace feel comfortable. This is a placeholder for a later entry about the room.'],
];
const entries = posts.map((post, index) => ({...post, number:String(index+1).padStart(2,'0'), category:summaries[index][0], summary:summaries[index][1]}));
const element = (tag, className, text) => {
  const node=document.createElement(tag); node.className=className;
  if (text !== undefined) node.textContent=text;
  return node;
};

export function installPostsMonitor(room, camera) {
  let lcd;
  room.getObjectByName('E05').traverse(part=>{ if(part.material?.name==='E05 / working LCD') lcd=part; });
  if (!lcd) throw new Error('Desktop LCD missing');
  let category='ALL', selected=entries[0], focused=false;
  function entryURL(entry) {
    const url=new URL('../posts/',import.meta.url);
    url.searchParams.set('post',entry.slug);
    const brand=new URLSearchParams(location.search).get('brand');
    if(brand) url.searchParams.set('brand',brand);
    return url.href;
  }
  const visibleEntries=()=>entries.filter(entry=>category==='ALL'||entry.category===category);
  const panel=element('section','screen-studio');
  panel.id='monitor-posts'; panel.hidden=true; panel.tabIndex=-1;
  panel.setAttribute('aria-label','Interactive research journal on the desktop monitor');
  panel.innerHTML='<header class="screen-topbar"><p class="screen-app-name">YITONG ZHANG <span>/ JOURNAL</span></p><div class="journal-tools"><span class="journal-count"></span><nav class="journal-filters" aria-label="Filter journal entries"></nav></div></header><div class="journal-index"><section class="journal-entries" aria-label="Journal entries"><p class="journal-eyebrow">LATEST ENTRIES</p><div class="monitor-list"></div></section><aside class="journal-preview" aria-label="Entry preview"></aside></div>';
  const list=panel.querySelector('.monitor-list');
  const preview=panel.querySelector('.journal-preview');
  const filters=panel.querySelector('.journal-filters');
  const count=panel.querySelector('.journal-count');
  const surface=document.createElement('canvas'); surface.width=WIDTH*2; surface.height=HEIGHT*2;
  const pen=surface.getContext('2d'); pen.scale(2,2);
  let screen;

  function paint() {
    paintStudio(pen,WIDTH,HEIGHT);
    drawText(pen,'YITONG ZHANG / JOURNAL',28,33,12,studio.ink,400,true);
    drawText(pen,`${visibleEntries().length} POSTS`,537,33,11,studio.muted,400,true);
    categories.forEach((name,i)=>drawText(pen,name,640+i*83,33,11,name===category?studio.gold:studio.muted,400,true));
    line(pen,0,56,WIDTH,56);
    drawText(pen,'LATEST ENTRIES',28,94,11,studio.muted,400,true);
    visibleEntries().forEach((entry,i)=>{
      const y=110+i*68;
      if(entry.slug===selected.slug) {pen.fillStyle='rgba(229,169,92,.055)';pen.fillRect(28,y,561,68);}
      drawText(pen,entry.number,36,y+39,12,studio.gold,400,true);
      drawWrapped(pen,entry.title,72,y+41,394,20,25,studio.ink,600,2);
      drawText(pen,entry.date.replaceAll('-','.'),470,y+28,10,studio.muted,400,true);
      drawText(pen,`${readingMinutes(entry)} MIN`,470,y+47,10,studio.muted,400,true);
      line(pen,28,y+68,589,y+68);
    });
    line(pen,613,84,613,454);
    drawText(pen,`ENTRY ${selected.number} / ${selected.category}`,641,94,11,studio.gold,400,true);
    const titleHeight=drawWrapped(pen,selected.title,641,137,331,27,33,studio.ink,650,3);
    drawWrapped(pen,selected.summary,641,137+titleHeight+22,331,15,24,studio.muted,400,6);
    drawText(pen,selected.topic.toUpperCase(),641,377,10,studio.muted,400,true);
    pen.fillStyle=studio.gold;pen.fillRect(641,412,331,42);
    drawText(pen,'READ ENTRY →',659,438,12,studio.background,600,true);
    screen?.invalidate();
  }
  function select(entry) {
    selected=entry;
    for(const row of list.children) row.dataset.selected=String(row.dataset.slug===entry.slug);
    preview.replaceChildren();
    preview.append(element('p','journal-eyebrow',`ENTRY ${entry.number} / ${entry.category}`));
    const title=element('h1','preview-title',entry.title); title.setAttribute('aria-live','polite');
    preview.append(title,element('p','preview-summary',entry.summary),element('p','preview-tag',entry.topic));
    const read=element('a','read-entry','READ ENTRY →'); read.href=entryURL(entry);
    preview.append(read);
    paint();
  }
  function renderIndex() {
    const visible=visibleEntries();
    if(!visible.some(entry=>entry.slug===selected.slug)) selected=visible[0];
    count.textContent=category==='ALL'?`${entries.length} POSTS`:`${visible.length} / ${entries.length} POSTS`;
    for(const button of filters.children) button.setAttribute('aria-pressed',String(button.dataset.category===category));
    list.replaceChildren();
    for(const entry of visible) {
      const row=element('a','monitor-post'); row.href=entryURL(entry); row.dataset.slug=entry.slug;
      row.setAttribute('aria-label',`Read ${entry.title}`);
      row.append(element('span','entry-number',entry.number),element('span','entry-title',entry.title));
      const meta=element('span','entry-meta');
      meta.append(element('span','',entry.date.replaceAll('-','.')),element('span','',`${readingMinutes(entry)} MIN`));
      row.append(meta);
      row.addEventListener('pointerenter',()=>select(entry));
      row.addEventListener('focus',()=>select(entry));
      list.append(row);
    }
    select(selected);
  }
  for(const name of categories) {
    const button=element('button','',name);button.type='button';button.dataset.category=name;
    button.addEventListener('click',()=>{category=name;renderIndex();});filters.append(button);
  }
  panel.addEventListener('wheel',event=>event.stopPropagation(),{passive:true});
  renderIndex();
  screen=attachScreenPanel(lcd,camera,panel,surface,'Journal / dark editorial LCD',WIDTH,HEIGHT);
  return {
    readable:()=>screen.readable(),
    frame(allowNearby=false) {
      // At reading distance this is already a usable webpage. A click goes
      // straight to its link, without first requesting another camera move.
      panel.hidden=!(focused || (allowNearby && screen.readable()));
      screen.frame();
    },
    show() {focused=true;panel.hidden=false;screen.frame();panel.focus({preventScroll:true});},
    hide() {focused=false;panel.hidden=true;},
  };
}

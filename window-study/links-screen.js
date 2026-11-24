import { attachScreenPanel } from './screen-panel.js?v=nearby-links';
import { studio, paintStudio, drawText, profileIcon, githubPath, linkedinPath } from './screen-browser.js?v=dark-studio';

export const profileLinks = [
  { name:'GitHub', caption:'github.com/ShawnZhang0318', description:'Open-source code, ML experiments & robotics repos', href:'https://github.com/ShawnZhang0318' },
  { name:'LinkedIn', caption:'linkedin.com/in/shawn-zhang-40b584356', description:'Academic background, research experience & network', href:'https://www.linkedin.com/in/shawn-zhang-40b584356/' },
];
const WIDTH=900, HEIGHT=620;

function drawLinks() {
  const canvas=document.createElement('canvas'); canvas.width=WIDTH*2; canvas.height=HEIGHT*2;
  const pen=canvas.getContext('2d');pen.scale(2,2);
  paintStudio(pen,WIDTH,HEIGHT);
  pen.fillStyle=studio.gold;pen.beginPath();pen.arc(53,44,3,0,Math.PI*2);pen.fill();
  drawText(pen,'ONLINE · HONG KONG / SHANGHAI',68,48,11,studio.muted,400,true);
  drawText(pen,'Where else to find me',48,112,40,studio.ink,650);
  drawText(pen,'Building AI systems, embodied agents & interactive tools.',48,149,17,studio.muted);
  for(const [i,profile] of profileLinks.entries()) {
    const y=184+i*158;
    pen.beginPath();pen.roundRect(48,y,804,140,8);pen.fillStyle=studio.card;pen.fill();
    pen.strokeStyle='rgba(244,237,226,.14)';pen.lineWidth=1;pen.stroke();
    pen.save();pen.translate(72,y+26);pen.scale(30/24,30/24);pen.fillStyle=studio.ink;
    pen.fill(new Path2D(profile.name==='GitHub'?githubPath:linkedinPath));pen.restore();
    drawText(pen,profile.name,120,y+46,26,studio.ink,600);
    drawText(pen,profile.caption,120,y+74,15,studio.muted);
    drawText(pen,profile.description,72,y+111,15,studio.muted);
    drawText(pen,'↗',803,y+49,29,studio.gold);
  }
  return canvas;
}

export function installLinksScreen(room,camera) {
  let lcd;
  room.getObjectByName('E06').traverse(part=>{if(part.material?.name==='E06 / working LCD') lcd=part;});
  if(!lcd) throw new Error('Laptop LCD missing');
  const panel=document.createElement('section');panel.id='laptop-links';panel.className='screen-studio';
  panel.hidden=true;panel.tabIndex=-1;panel.setAttribute('aria-label','Where else to find me on the laptop');
  panel.innerHTML='<div class="connect-content"><p class="connect-status"><span aria-hidden="true"></span>ONLINE · HONG KONG / SHANGHAI</p><header class="connect-heading"><h1>Where else to find me</h1><p>Building AI systems, embodied agents &amp; interactive tools.</p></header><div class="profile-list"></div></div>';
  for(const profile of profileLinks) {
    const link=document.createElement('a');link.className='profile-link';link.href=profile.href;
    link.target='_blank';link.rel='noopener noreferrer';
    link.setAttribute('aria-label',`${profile.name}: ${profile.caption} (opens in a new tab)`);
    link.innerHTML=profileIcon(profile.name)+'<div class="profile-text"><h2></h2><p class="profile-account"></p></div><span class="profile-arrow" aria-hidden="true">↗</span><p class="profile-description"></p>';
    link.querySelector('h2').textContent=profile.name;
    link.querySelector('.profile-account').textContent=profile.caption;
    link.querySelector('.profile-description').textContent=profile.description;
    panel.querySelector('.profile-list').append(link);
  }
  panel.addEventListener('wheel',event=>event.stopPropagation(),{passive:true});
  const screen=attachScreenPanel(lcd,camera,panel,drawLinks(),'Connect / dark editorial LCD',WIDTH,HEIGHT);
  return {
    target:screen.center,
    readable:()=>screen.readable(),
    near:screen.center.clone().addScaledVector(screen.normal,.42).add({x:0,y:.11,z:0}),
    approach:screen.center.clone().addScaledVector(screen.normal,.8).add({x:0,y:.3,z:0}),
    frame:()=>screen.frame(),
    show() {panel.hidden=false;screen.frame();panel.focus({preventScroll:true});},
    hide() {panel.hidden=true;},
  };
}

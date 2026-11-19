const directions = {
  a: {number:"CONCEPT 01",caption:"Chelsea blue walls, warm light, and an archive of physical stories.",tone:"蓝墙搭配暖色灯光，复古档案氛围",entry:"每件实体档案打开独立内容模块",fit:"项目故事、经历、收藏与工作侧面",tab:"tab-a"},
  b: {number:"CONCEPT 02",caption:"A blue engineering office where research meets personal archives.",tone:"Klein Blue 与白色为主，金属与木材调和",entry:"实体物件 + 笔记本 C 星图应用",fit:"工程工作站、机器人、奖柜与个人档案",tab:"tab-b"},
  c: {number:"CONCEPT 03",caption:"A Chelsea blue office mapped as a living knowledge network.",tone:"蓝白实体空间叠加轻量数字轨道",entry:"空间节点连接不同知识主题",fit:"研究、论文与项目间的长期关系",tab:"tab-c"}
};
const modules = {
  ABOUT:{index:"01",title:"[姓名与个人简介待提供]",copy:"此模块由独立的个人资料文件驱动。",short:"PERSONAL PROFILE"},
  RESEARCH:{index:"02",title:"[研究方向待提供]",copy:"研究领域和方向由 CEO 后续提供。",short:"RESEARCH NOTES"},
  PAPERS:{index:"03",title:"[论文与研究成果待提供]",copy:"论文标题、作者、年份和链接目前均为空占位。",short:"PUBLICATIONS"},
  PROJECTS:{index:"04",title:"[项目内容待提供]",copy:"项目名称、目标、过程与结果均由独立数据模块提供。",short:"PROJECT ARCHIVE"},
  WORK:{index:"05",title:"[工作经历待提供]",copy:"不填入未经 CEO 提供或确认的履历。",short:"WORK EXPERIENCE"},
  BUSINESS_CARD:{index:"06",title:"[名片资料待提供]",copy:"此名片使用独立的数据文件和展示模块。",short:"BUSINESS CARD"},
  SKILLS:{index:"07",title:"[技能信息待提供]",copy:"技能与工具条目由 CEO 后续提供。",short:"SKILLS"},
  CONTACT:{index:"08",title:"[联系方式待提供]",copy:"联系信息由 CEO 后续提供。",short:"CONTACT"},
  HOBBY:{index:"09",title:"Hobby 球星卡收藏",copy:"此处由独立可扩展卡册模块加载；卡片数据尚未提供。",short:"FOOTBALL CARDS"},
  CV:{index:"10",title:"[三语简历待提供]",copy:"同一个档案袋入口，简体中文、英语和繁体中文共用一份待填数据结构。",short:"CV ENVELOPE"},
  AWARDS:{index:"11",title:"[奖项资料待提供]",copy:"奖项日期、机构、说明和图像均等待 CEO 提供。",short:"AWARDS CABINET"}
};
const scene = document.querySelector("#scene");
const tabs = [...document.querySelectorAll("[data-select]")];
function selectDirection(id){
  const direction = directions[id];
  if(!direction) return;
  document.body.dataset.concept = id;
  scene.dataset.active = id;
  scene.setAttribute("aria-labelledby",direction.tab);
  tabs.forEach(tab=>{const active=tab.dataset.select===id;tab.classList.toggle("is-active",active);tab.setAttribute("aria-selected",String(active));});
  document.querySelector("#scene-number").textContent=direction.number;
  document.querySelector("#scene-caption").textContent=direction.caption;
  document.querySelector("#meta-tone").textContent=direction.tone;
  document.querySelector("#meta-entry").textContent=direction.entry;
  document.querySelector("#meta-fit").textContent=direction.fit;
  clearModule();
}
function showModule(id){
  const item=modules[id];
  if(!item)return;
  scene.classList.add("has-selection");
  document.querySelector("#module-index").textContent=item.index;
  document.querySelector("#module-label").textContent=item.short;
  document.querySelector("#module-title").textContent=item.title;
  document.querySelector("#module-copy").textContent=item.copy;
  const title=document.querySelectorAll("[data-screen-title]");
  const copy=document.querySelectorAll("[data-screen-copy]");
  title.forEach(node=>node.textContent=item.short);
  copy.forEach(node=>node.textContent=item.title);
}
function clearModule(){scene.classList.remove("has-selection");}
tabs.forEach(tab=>tab.addEventListener("click",()=>selectDirection(tab.dataset.select)));
document.querySelectorAll("[data-module]").forEach(control=>control.addEventListener("click",()=>showModule(control.dataset.module)));
document.querySelector("#clear-module").addEventListener("click",clearModule);
document.addEventListener("keydown",event=>{if(event.key==="Escape")clearModule();if(["1","2","3"].includes(event.key))selectDirection(["a","b","c"][Number(event.key)-1]);});
selectDirection("b");

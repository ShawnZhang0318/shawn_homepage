const {chromium}=require('../../../../work/browser-review/node_modules/playwright-core');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const dir=__dirname;
async function capture(browser){
  const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});
  const errors=[];
  page.on('pageerror',err=>errors.push(String(err)));
  page.on('console',msg=>{if(msg.type()==='error')errors.push(msg.location().url+' '+msg.text());});
  await page.goto('http://127.0.0.1:8805/?study=cuboid');
  await page.waitForFunction(()=>window.paperReview?.snapshot().state==='rest');
  await page.addStyleTag({content:'.heading,.controls,.view-controls,#window-step{opacity:0;pointer-events:none}'});
  await page.waitForTimeout(400);
  const samples=[];
  async function sample(name){
    const view=await page.evaluate(()=>window.paperReview.snapshot().view);
    samples.push({name,...view,box:await page.evaluate(()=>window.cuboidMeasurement())});
    if(['home','focus'].includes(name))await page.screenshot({path:path.join(dir,name+'.png')});
  }
  await sample('home');
  await page.evaluate(()=>{
    const initial=window.paperReview.snapshot().projection;
    const matrices=JSON.stringify(window.paperReview.waterfrontMatrices());
    if(JSON.parse(matrices).length<12)throw Error('Missing waterfront meshes');
    window.check={frames:0,changed:false,approach:[]};
    window.walking=true;
    function check() {
      const pose=window.paperReview.snapshot();
      window.check.frames++;
      if(window.walking)window.check.approach.push(window.paperReview.towerHeights());
      if(pose.projection.some((n,i)=>n!==initial[i]) || pose.view.lens!==1 ||
          JSON.stringify(window.paperReview.waterfrontMatrices())!==matrices) window.check.changed=true;
      requestAnimationFrame(check);
    }
    check();
    const stream=document.querySelector('canvas').captureStream(30);
    const recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp9',videoBitsPerSecond:8500000});
    const chunks=[];recorder.ondataavailable=e=>chunks.push(e.data);
    window.finishMovie=()=>new Promise(resolve=>{
      recorder.onstop=()=>{
        for(const t of stream.getTracks())t.stop();
        const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);
        reader.readAsDataURL(new Blob(chunks,{type:'video/webm'}));
      };recorder.stop();
    });recorder.start(300);
  });
  await page.waitForTimeout(700);
  const point=await page.evaluate(()=>window.paperReview.focusPoints().find(p=>p.id==='WINDOW'));
  await page.mouse.click(point.x,point.y);
  await page.waitForFunction(()=>window.paperReview.snapshot().view.focus==='WINDOW'&&!window.paperReview.snapshot().view.flying);
  await sample('focus');
  await page.evaluate(()=>{window.walking=false});
  async function look(from,to,name) {
    await page.mouse.move(from,375);
    await page.mouse.down();
    await page.mouse.move(to,375,{steps:32});
    await page.mouse.up();
    await page.waitForTimeout(600);
    await sample(name);
  }
  await look(330,930,'look-left');
  await look(1240,40,'look-right');
  await look(330,930,'look-centre');
  for(const [key,count,name] of [['ArrowLeft',2,'left'],['ArrowRight',4,'right']]){
    for(let i=0;i<count;i++){await page.keyboard.press(key);await page.waitForTimeout(340);}
    await page.waitForTimeout(350);await sample(name);
  }
  await page.keyboard.press('Escape');
  await page.waitForFunction(()=>!window.paperReview.snapshot().view.flying);
  await page.waitForTimeout(500);await sample('return');
  const data=await page.evaluate(()=>window.finishMovie());
  fs.writeFileSync(path.join(__dirname,'../../../../tmp/window-cuboid-control.webm'),Buffer.from(data,'base64'));
  const result=await page.evaluate(()=>window.check);
  const at=name=>samples.find(s=>s.name===name);
  assert.equal(result.changed,false);
  assert.equal(Object.keys(result.approach[0]).length,2);
  for(const name of Object.keys(result.approach[0])) {
    const sizes=result.approach.map(s=>s[name]);
    console.log(name,'start/min/end',sizes[0],Math.min(...sizes),sizes.at(-1));
    assert(sizes.at(-1)>sizes[0]);
    assert(sizes.every((v,i)=>!i || v>=sizes[i-1]-.005));
  }
  assert(at('look-left').yawOffsetDegrees>40 && at('look-right').yawOffsetDegrees< -40);
  assert(at('left').sideOffset<-.39 && at('right').sideOffset>.39);
  for(const sample of samples.slice(2,5))assert.deepEqual(sample.position,at('focus').position);
  for(const key of ['position','quaternion'])assert(at('home')[key].every((v,i)=>Math.abs(v-at('return')[key][i])<1e-8));
  assert(samples.every(s=>JSON.stringify(s.box.matrix)===JSON.stringify(at('home').box.matrix)));
  console.log(samples.map(s=>[s.name,Math.round(s.box.width),Math.round(s.box.height),
    s.box.centre[0].toFixed(1),s.box.tower[0].toFixed(1),s.box.distance.toFixed(2)]));
  assert.deepEqual(errors,[]);
  console.log('Fixed projection and static exterior across frames:',result.frames);
  console.log(samples.map(p=>[p.name,p.yawOffsetDegrees.toFixed(2),p.sideOffset.toFixed(2),p.position.map(v=>+v.toFixed(3))]));
  await page.close();
}
(async()=>{
  const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--no-proxy-server']});
  try {await capture(browser);} finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});

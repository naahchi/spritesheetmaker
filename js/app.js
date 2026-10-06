const state = {
  frameCount: 12,
  frames: [],
  fps: 12,
  columns: 12,
  width: 512,
  height: 512,
  loop: true,
  playing: false,
  current: 0,
  scale: 100,
  sheetBlob: null,
  raf: null,
  lastTime: 0,
  accumulator: 0
};

const $ = id => document.getElementById(id);
const frameGrid = $("frameGrid");
const fileInput = $("fileInput");
const previewCanvas = $("previewCanvas");
const pctx = previewCanvas.getContext("2d");
const sheetCanvas = $("sheetCanvas");
const sctx = sheetCanvas.getContext("2d");

function init(){
  bind();
  setFrameCount(12);
  updateCode();
  drawPreview();
}

function bind(){
  $("loadImagesBtn").onclick = () => fileInput.click();
  fileInput.onchange = e => addFiles([...e.target.files]);
  $("newProjectBtn").onclick = resetProject;
  $("clearBtn").onclick = () => { state.frames=[]; renderGrid(); updateAll(); };
  $("sortBtn").onclick = sortFrames;
  $("playBtn").onclick = play;
  $("pauseBtn").onclick = pause;
  $("resetBtn").onclick = resetAnimation;
  $("generateSheetBtn").onclick = generateSheet;
  $("downloadSheetBtn").onclick = downloadSheet;
  $("copyCodeBtn").onclick = copyCode;
  $("fps").oninput = e => { state.fps = clamp(+e.target.value,1,60); updateCode(); };
  $("columns").oninput = e => { state.columns = clamp(+e.target.value,1,60); updateCode(); };
  $("frameWidth").oninput = e => { state.width = Math.max(1,+e.target.value||1); updateCode(); };
  $("frameHeight").oninput = e => { state.height = Math.max(1,+e.target.value||1); updateCode(); };
  $("customFrames").onchange = e => { if($("[data-count='custom']")) setFrameCount(clamp(+e.target.value||1,1,240)); };
  $("loop").onchange = e => { state.loop=e.target.checked; updateCode(); };
  $("transparent").onchange = e => $("previewStage").classList.toggle("checker", e.target.checked);
  $("scale").oninput = e => { state.scale=+e.target.value; drawPreview(); };

  document.querySelectorAll("#framePresets button").forEach(btn=>{
    btn.onclick=()=> {
      if(btn.dataset.count==="custom") setFrameCount(clamp(+$("customFrames").value||12,1,240));
      else setFrameCount(+btn.dataset.count);
    };
  });

  const dz=$("dropZone");
  ["dragenter","dragover"].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.add("drag")}));
  ["dragleave","drop"].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.remove("drag")}));
  dz.ondrop=e=>addFiles([...e.dataTransfer.files].filter(f=>f.type.startsWith("image/")));
}

function clamp(n,min,max){return Math.max(min,Math.min(max,n));}

function setFrameCount(count){
  state.frameCount=count;
  state.frames.length=count;
  $("customFrames").value=count;
  document.querySelectorAll("#framePresets button").forEach(b=>b.classList.toggle("active",b.dataset.count===""+count));
  renderGrid(); updateAll();
}

function renderGrid(){
  frameGrid.innerHTML="";
  for(let i=0;i<state.frameCount;i++){
    const slot=document.createElement("div");
    slot.className="frame-slot "+(state.frames[i]?"":"empty");
    slot.dataset.index=i;
    const n=document.createElement("span"); n.className="frame-number"; n.textContent=String(i+1).padStart(2,"0"); slot.appendChild(n);
    if(state.frames[i]){
      const img=document.createElement("img"); img.src=state.frames[i].url; img.alt=`Frame ${i+1}`; slot.appendChild(img);
      const rm=document.createElement("button"); rm.className="remove-frame"; rm.textContent="×";
      rm.onclick=e=>{e.stopPropagation(); removeFrame(i)}; slot.appendChild(rm);
    } else {
      slot.insertAdjacentHTML("beforeend","<span>+</span>");
    }
    slot.onclick=()=>uploadToSlot(i);
    frameGrid.appendChild(slot);
  }
  $("frameStatus").textContent=`${state.frames.filter(Boolean).length} / ${state.frameCount} loaded`;
}

function uploadToSlot(index){
  const input=document.createElement("input"); input.type="file"; input.accept="image/*";
  input.onchange=e=>{const f=e.target.files[0]; if(f) putFrame(index,f);};
  input.click();
}

function addFiles(files){
  let cursor=state.frames.findIndex(x=>!x);
  if(cursor<0) return;
  for(const file of files){
    if(cursor>=state.frameCount) break;
    putFrame(cursor,file); cursor=state.frames.findIndex((x,i)=>!x && i>cursor);
    if(cursor<0) break;
  }
  renderGrid(); updateAll();
}

function putFrame(index,file){
  if(!file.type.startsWith("image/")) return;
  if(state.frames[index]?.url) URL.revokeObjectURL(state.frames[index].url);
  const img=new Image();
  const url=URL.createObjectURL(file);
  img.onload=()=>{state.frames[index]={url,img,name:file.name}; renderGrid(); updateAll();};
  img.src=url;
}

function removeFrame(index){
  if(state.frames[index]?.url) URL.revokeObjectURL(state.frames[index].url);
  state.frames.splice(index,1); state.frames.push(null);
  if(state.current>=state.frameCount) state.current=0;
  renderGrid(); updateAll();
}

function sortFrames(){
  const loaded=state.frames.filter(Boolean).sort((a,b)=>a.name.localeCompare(b.name,navigator.language,{numeric:true}));
  state.frames=Array(state.frameCount).fill(null);
  loaded.forEach((f,i)=>state.frames[i]=f);
  renderGrid(); updateAll();
}

function resetProject(){
  state.frames.forEach(f=>f?.url&&URL.revokeObjectURL(f.url));
  state.frames=[]; state.current=0; state.sheetBlob=null;
  $("downloadSheetBtn").disabled=true; $("sheetInfo").textContent="No sprite sheet generated yet.";
  sheetCanvas.width=1; sheetCanvas.height=1; setFrameCount(12); pause(); resetAnimation();
}

function updateAll(){ drawPreview(); updateCode(); }

function drawPreview(){
  previewCanvas.width=state.width; previewCanvas.height=state.height;
  pctx.clearRect(0,0,state.width,state.height);
  const f=state.frames[state.current];
  if(f?.img){
    const scale=Math.min(state.width/f.img.width,state.height/f.img.height);
    const w=f.img.width*scale,h=f.img.height*scale;
    pctx.drawImage(f.img,(state.width-w)/2,(state.height-h)/2,w,h);
  }
  $("previewFrame").textContent=`Frame ${state.frames.length?state.current+1:0} / ${state.frameCount}`;
  previewCanvas.style.width=`${state.scale}%`;
}

function play(){
  if(state.playing) return;
  state.playing=true; state.lastTime=performance.now(); state.accumulator=0;
  state.raf=requestAnimationFrame(tick);
}
function pause(){state.playing=false;if(state.raf)cancelAnimationFrame(state.raf);}
function resetAnimation(){pause();state.current=0;drawPreview();}
function tick(t){
  if(!state.playing)return;
  const dt=t-state.lastTime; state.lastTime=t; state.accumulator+=dt;
  const frameMs=1000/state.fps;
  if(state.accumulator>=frameMs){
    const steps=Math.floor(state.accumulator/frameMs); state.accumulator%=frameMs;
    state.current+=steps;
    if(state.current>=state.frameCount){
      if(state.loop) state.current%=state.frameCount;
      else {state.current=state.frameCount-1; pause();}
    }
    drawPreview();
  }
  if(state.playing)state.raf=requestAnimationFrame(tick);
}

async function generateSheet(){
  const loaded=state.frames.filter(Boolean);
  if(!loaded.length){alert("Please add at least one image.");return;}
  const rows=Math.ceil(state.frameCount/state.columns);
  sheetCanvas.width=state.columns*state.width;
  sheetCanvas.height=rows*state.height;
  sctx.clearRect(0,0,sheetCanvas.width,sheetCanvas.height);
  for(let i=0;i<state.frameCount;i++){
    const f=state.frames[i];
    if(!f) continue;
    const x=(i%state.columns)*state.width, y=Math.floor(i/state.columns)*state.height;
    const scale=Math.min(state.width/f.img.width,state.height/f.img.height);
    const w=f.img.width*scale,h=f.img.height*scale;
    sctx.drawImage(f.img,x+(state.width-w)/2,y+(state.height-h)/2,w,h);
  }
  const blob=await new Promise(resolve=>sheetCanvas.toBlob(resolve,"image/png"));
  state.sheetBlob=blob;
  $("downloadSheetBtn").disabled=false;
  $("sheetInfo").textContent=`${sheetCanvas.width} × ${sheetCanvas.height}px • ${rows} row(s) × ${state.columns} column(s)`;
}

function downloadSheet(){
  if(!state.sheetBlob)return;
  const a=document.createElement("a");a.href=URL.createObjectURL(state.sheetBlob);a.download=`sprite-sheet-${state.frameCount}frames.png`;a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}

function updateCode(){
  const cols=state.columns;
  const rows=Math.ceil(state.frameCount/cols);
  $("codeOutput").textContent=`// Generated by Sprite Animation Maker
const sprite = new Image();
sprite.src = "sprite-sheet-${state.frameCount}frames.png";

const FRAME_WIDTH = ${state.width};
const FRAME_HEIGHT = ${state.height};
const FRAME_COUNT = ${state.frameCount};
const COLUMNS = ${cols};
const ROWS = ${rows};
const FPS = ${state.fps};
const LOOP = ${state.loop};

let frame = 0;
let accumulator = 0;
let lastTime = 0;

function updateSpriteAnimation(time) {
  if (!lastTime) lastTime = time;
  const delta = time - lastTime;
  lastTime = time;

  accumulator += delta;

  const frameDuration = 1000 / FPS;

  while (accumulator >= frameDuration) {
    accumulator -= frameDuration;
    frame++;

    if (frame >= FRAME_COUNT) {
      if (LOOP) frame = 0;
      else frame = FRAME_COUNT - 1;
    }
  }

  requestAnimationFrame(updateSpriteAnimation);
}

function drawSprite(ctx, x, y, scale = 1) {
  const column = frame % COLUMNS;
  const row = Math.floor(frame / COLUMNS);

  ctx.drawImage(
    sprite,
    column * FRAME_WIDTH,
    row * FRAME_HEIGHT,
    FRAME_WIDTH,
    FRAME_HEIGHT,
    x,
    y,
    FRAME_WIDTH * scale,
    FRAME_HEIGHT * scale
  );
}

// Start animation
requestAnimationFrame(updateSpriteAnimation);

// In your game render loop:
// drawSprite(ctx, player.x, player.y, 1);`;
}

async function copyCode(){
  try{
    await navigator.clipboard.writeText($("codeOutput").textContent);
    const b=$("copyCodeBtn"),old=b.textContent;b.textContent="Copied!";
    setTimeout(()=>b.textContent=old,1000);
  }catch(e){alert("Copy failed. Select the code manually.");}
}

init();

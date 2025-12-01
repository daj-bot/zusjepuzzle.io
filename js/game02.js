const canvas = document.getElementById("puzzleCanvas");
const ctx = canvas.getContext("2d");
const overlay = document.getElementById("overlay");
const playBtn = document.getElementById("playBtn");
const scoreText = document.getElementById("scoreText");
const statusText = document.getElementById("statusText");
const timerText = document.getElementById("timerText");

let rows = 5, cols = 5;
let pieceW, pieceH;
let pieces = [], cellPieces = [], baseImg = null, dragging = null;
let level = 1, imageNum = 1;
const levelsCount = 10, imagesPerLevel = 10;
let score = 0;
let timerDuration = 180000; // 3 minutes
let timerEnd = 0, timerInterval = null;

function pad2(n){ return String(n).padStart(2,'0'); }
function imgPath(level,num){ return `img/${pad2(level)}/img${pad2(num)}.png`; }

function resizeCanvas(){
  let targetWidth = window.innerWidth >= 641 ? 800 : window.innerWidth;
  canvas.width = targetWidth;

  // keep proportional height
  if(rows === cols){
    canvas.height = targetWidth; // square puzzle
  } else {
    canvas.height = canvas.width * (rows / cols);
  }

  pieceW = canvas.width / cols;
  pieceH = canvas.height / rows;

  if(baseImg){
    sliceImage(baseImg);
    render();
  }
}

window.addEventListener("resize", resizeCanvas);

function setStatus(text){ statusText.textContent = `Status: ${text}`; }
function updateScore(){ scoreText.textContent = `Score: ${score}`; }

function startTimer(){
  stopTimer();
  timerEnd = performance.now() + timerDuration;
  timerInterval = setInterval(()=>{
    const remaining = timerEnd - performance.now();
    if(remaining <= 0){
      stopTimer();
      setStatus("Time up!");
      loadImage(level,imageNum);
      return;
    }
    const t = Math.floor(remaining/1000);
    const m = String(Math.floor(t/60)).padStart(2,'0');
    const s = String(t%60).padStart(2,'0');
    timerText.textContent = `Time left: ${m}:${s}`;
  },200);
}
function stopTimer(){ if(timerInterval){ clearInterval(timerInterval); timerInterval=null; } }

function loadImage(lvl,num){
  setStatus("Loading…");
  const img = new Image();
  img.src = imgPath(lvl,num);
  img.onload = ()=>{
    baseImg = img;
    sliceImage(img);
    randomizeBoard();
    render();
    setStatus(`Level ${lvl}, Image ${pad2(num)}`);
  };
}

function sliceImage(img){
  pieces = []; cellPieces = new Array(rows*cols).fill(null);
  let id=0;
  for(let r=0;r<rows;r++){
    for(let c=0;c<cols;c++){
      const sx=c*(img.width/cols), sy=r*(img.height/rows);
      const sW=img.width/cols, sH=img.height/rows;
      const pc=document.createElement("canvas");
      pc.width=pieceW; pc.height=pieceH;
      pc.getContext("2d").drawImage(img,sx,sy,sW,sH,0,0,pieceW,pieceH);
      const correctIndex=r*cols+c;
      pieces.push({id,canvas:pc,correctIndex,currentIndex:correctIndex,x:c*pieceW,y:r*pieceH});
      id++;
    }
  }
}

function shuffleArray(arr){
  for(let i=arr.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [arr[i],arr[j]]=[arr[j],arr[i]];
  }
  return arr;
}

function randomizeBoard(){
  const indices=shuffleArray([...pieces.map(p=>p.correctIndex)]);
  pieces.forEach((p,i)=>{
    const ci=indices[i];
    p.currentIndex=ci;
    const pos=cellXYFromIndex(ci);
    p.x=pos.x; p.y=pos.y;
  });
  cellPieces.fill(null);
  for(const p of pieces){ cellPieces[p.currentIndex]=p.id; }
}

function cellIndexFromXY(x,y){
  const c=Math.max(0,Math.min(cols-1,Math.floor(x/pieceW)));
  const r=Math.max(0,Math.min(rows-1,Math.floor(y/pieceH)));
  return r*cols+c;
}
function cellXYFromIndex(idx){
  const r=Math.floor(idx/cols), c=idx%cols;
  return {x:c*pieceW,y:r*pieceH};
}

function render(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  for(const p of pieces){
    if(dragging && dragging.id===p.id) continue;
    ctx.drawImage(p.canvas,p.x,p.y);
  }
  if(dragging){
    ctx.save();
    ctx.shadowColor="#00ff66";
    ctx.shadowBlur=40;
    ctx.drawImage(pieces[dragging.id].canvas,dragging.x-dragging.offsetX,dragging.y-dragging.offsetY);
    ctx.restore();
  }
}
function checkWin(){
  for(const p of pieces){ if(p.currentIndex!==p.correctIndex) return false; }
  stopTimer();
  setStatus("Completed ✓");
  score += 10; updateScore();

  // Show score popup
  const popup = document.getElementById("scorePopup");
  popup.textContent = "+10"; // or "+100" if level bonus
  popup.style.display = "block";

  // Add glow + blink to canvas
  canvas.style.animation = "glow 1s linear infinite, blink 1s linear infinite";

  // Remove after 6 seconds, then advance
  setTimeout(()=>{
    popup.style.display = "none";
    canvas.style.animation = "";
    if(imageNum===imagesPerLevel){ score += 100; updateScore(); }
    advanceImage();
  },6000);

  return true;
}


function advanceImage(){
  imageNum++;
  if(imageNum > imagesPerLevel){
    imageNum = 1;
    level++;
    if(level > levelsCount){
      setStatus("Game complete!");
      overlay.style.display = "flex";
      playBtn.textContent = "PLAY AGAIN";
      return;
    }
  }
  loadImage(level, imageNum);
}

// --- Dragging helpers ---
function canvasToPoint(ev){
  const rect = canvas.getBoundingClientRect();
  const x = (ev.clientX - rect.left) * (canvas.width / rect.width);
  const y = (ev.clientY - rect.top) * (canvas.height / rect.height);
  return {x, y};
}

function pointToPieceId(px, py){
  const idx = cellIndexFromXY(px, py);
  const pid = cellPieces[idx];
  if(pid == null) return null;
  const p = pieces[pid];
  if(px >= p.x && px < p.x + pieceW && py >= p.y && py < p.y + pieceH) return pid;
  return null;
}

function onDown(px, py){
  const pid = pointToPieceId(px, py);
  if(pid == null) return;
  const p = pieces[pid];
  dragging = {
    id: pid,
    x: px,
    y: py,
    offsetX: px - p.x,
    offsetY: py - p.y,
    srcIndex: p.currentIndex
  };
  cellPieces[p.currentIndex] = null;
  canvas.classList.add("dragging");
  render();
}

function onMove(px, py){
  if(!dragging) return;
  dragging.x = px;
  dragging.y = py;
  render();
}

function onUp(px, py){
  if(!dragging) return;
  const p = pieces[dragging.id];
  const targetIdx = cellIndexFromXY(
    px - dragging.offsetX + pieceW/2,
    py - dragging.offsetY + pieceH/2
  );
  const occupant = cellPieces[targetIdx];
  if(occupant == null){
    const pos = cellXYFromIndex(targetIdx);
    p.x = pos.x; p.y = pos.y;
    p.currentIndex = targetIdx;
    cellPieces[targetIdx] = p.id;
  } else {
    const other = pieces[occupant];
    const pPos = cellXYFromIndex(targetIdx);
    const oPos = cellXYFromIndex(dragging.srcIndex);
    p.x = pPos.x; p.y = pPos.y;
    other.x = oPos.x; other.y = oPos.y;
    cellPieces[targetIdx] = p.id;
    cellPieces[dragging.srcIndex] = other.id;
    other.currentIndex = dragging.srcIndex;
    p.currentIndex = targetIdx;
  }
  dragging = null;
  canvas.classList.remove("dragging");
  render();
  checkWin();
}

// --- Unified input handling ---
function handleDown(ev){
  ev.preventDefault();
  let point;
  if(ev.type === "mousedown"){
    point = canvasToPoint(ev);
  } else if(ev.type === "touchstart"){
    if(ev.touches.length > 1) return; // ignore multi-touch
    point = canvasToPoint(ev.touches[0]);
  }
  if(point) onDown(point.x, point.y);
}

function handleMove(ev){
  ev.preventDefault();
  let point;
  if(ev.type === "mousemove"){
    point = canvasToPoint(ev);
  } else if(ev.type === "touchmove"){
    if(ev.touches.length > 1) return;
    point = canvasToPoint(ev.touches[0]);
  }
  if(point) onMove(point.x, point.y);
}

function handleUp(ev){
  ev.preventDefault();
  let point;
  if(ev.type === "mouseup"){
    point = canvasToPoint(ev);
  } else if(ev.type === "touchend"){
    if(ev.changedTouches.length === 0) return;
    point = canvasToPoint(ev.changedTouches[0]);
  }
  if(point) onUp(point.x, point.y);
}

// --- Bind events ---
canvas.addEventListener("click", handleDown);
canvas.addEventListener("mousedown", handleDown);
window.addEventListener("mousemove", handleMove);
window.addEventListener("mouseup", handleUp);

canvas.addEventListener("touchstart", handleDown, { passive: false });
window.addEventListener("touchmove", handleMove, { passive: false });
window.addEventListener("touchend", handleUp, { passive: false });

// --- PLAY button ---
playBtn.addEventListener("click", () => {
  overlay.style.display = "none";
  score = 0;
  updateScore();
  level = 1; imageNum = 1;
  resizeCanvas();
  loadImage(level, imageNum);
  startTimer();
  setStatus("Puzzle started!");
});

// --- Init ---
function init(){
  resizeCanvas();
  loadImage(level, imageNum);
  overlay.style.display = "flex"; // show PLAY overlay initially
}
init();

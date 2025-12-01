// --- Elements ---
const canvas = document.getElementById("puzzleCanvas");
const ctx = canvas.getContext("2d");
const overlay = document.getElementById("overlay");
const playBtn = document.getElementById("playBtn");
const scoreText = document.getElementById("scoreText");
const statusText = document.getElementById("statusText");
const timerText = document.getElementById("timerText");
const scorePopup = document.getElementById("scorePopup");
const countdownOverlay = document.getElementById("countdownOverlay");
const countdownText = document.getElementById("countdownText");
const finishOverlay = document.getElementById("finishOverlay");
const retryBtn = document.getElementById("retryBtn");

// --- Game config/state ---
let rows = 5, cols = 5;
let pieceW, pieceH;
let pieces = [], cellPieces = [], baseImg = null, dragging = null;
let level = 1, imageNum = 1;
const LEVELS_COUNT = 15;     // <--- change only this when you add folders (e.g., 16, 17…)
const imagesPerLevel = 10;
let score = 0;
let timerDuration = 180000;  // 3 minutes
let timerEnd = 0, timerInterval = null;

// Level selector inside canvas
let levelThumbs = [];   // [{img: Image, unlocked: boolean}]
let cubeRects = [];     // [{x,y,w,h}]
let mode = "selector";  // "selector" | "preview" | "puzzle"

// --- Utils ---
function pad2(n){ return String(n).padStart(2,'0'); }
function imgPath(level,num){ return `img/${pad2(level)}/img${pad2(num)}.png`; }

// --- Canvas sizing ---
function resizeCanvas(){
  const targetWidth = window.innerWidth >= 641 ? 800 : window.innerWidth;
  canvas.width = targetWidth;

  if(mode === "selector"){
    const colsSel = 5;
    const rowsSel = Math.ceil(LEVELS_COUNT / colsSel);
    // Height proportional to rows/cols for a clean grid (e.g., 5x3 -> 0.6 of width)
    canvas.height = Math.round(canvas.width * (rowsSel / colsSel));
  } else {
    // Puzzle: square for 5x5, proportional otherwise
    canvas.height = rows === cols ? targetWidth : Math.round(canvas.width * (rows / cols));
  }

  pieceW = canvas.width / cols;
  pieceH = canvas.height / rows;

  if(mode === "selector"){
    drawLevelSelector();
  } else if(baseImg && pieces.length){
    render();
  }
}
window.addEventListener("resize", resizeCanvas);

// --- HUD ---
function setStatus(text){ statusText.textContent = `Status: ${text}`; }
function updateScore(){ scoreText.textContent = `Score: ${score}`; }

// --- Timer ---
function startTimer(){
  stopTimer();
  timerEnd = performance.now() + timerDuration;
  timerInterval = setInterval(()=>{
    const remaining = timerEnd - performance.now();
    if(remaining <= 0){
      stopTimer();
      setStatus("FINISH – TRY AGAIN");
      showFinishOverlay();
      return;
    }
    const t = Math.floor(remaining/1000);
    const m = String(Math.floor(t/60)).padStart(2,'0');
    const s = String(t%60).padStart(2,'0');
    timerText.textContent = `Time left: ${m}:${s}`;
  },200);
}
function stopTimer(){
  if(timerInterval){
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

// --- Finish overlay ---
function showFinishOverlay(){
  finishOverlay.style.display = "flex";
  retryBtn.onclick = ()=>{
    finishOverlay.style.display = "none";
    // restart current level, first image
    mode = "preview";
    loadImage(level, 1);
  };
}

// --- Countdown preview ---
function startCountdown(callback){
  countdownOverlay.style.display = "flex";
  let count = 5;
  countdownText.textContent = count;
  const interval = setInterval(()=>{
    count--;
    if(count > 0){
      countdownText.textContent = count;
    } else {
      clearInterval(interval);
      countdownOverlay.style.display = "none";
      callback();
    }
  },1000);
}

// --- Level selector ---
function loadLevelThumbs(){
  levelThumbs = [];
  for(let i=1;i<=LEVELS_COUNT;i++){
    const img = new Image();
    img.src = `img/${String(i).padStart(2,"0")}/img01.png`;
    levelThumbs.push({img, unlocked: i===1});
  }
}

function drawLevelSelector(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  cubeRects = [];

  const colsSel = 5;
  const rowsSel = Math.ceil(LEVELS_COUNT / colsSel);
  const cubeW = canvas.width/colsSel, cubeH = canvas.height/rowsSel;

  for(let i=0;i<LEVELS_COUNT;i++){
    const r = Math.floor(i/colsSel), c = i%colsSel;
    const x = Math.floor(c*cubeW), y = Math.floor(r*cubeH);
    const w = Math.floor(cubeW), h = Math.floor(cubeH);
    cubeRects.push({x,y,w,h});

    const thumb = levelThumbs[i];
    if(thumb.img.complete){
      ctx.drawImage(thumb.img,x,y,w,h);
    } else {
      thumb.img.onload = ()=>drawLevelSelector();
    }

    if(!thumb.unlocked){
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(x,y,w,h);
    } else {
      ctx.strokeStyle = "#00ff66";
      ctx.lineWidth = 4;
      ctx.strokeRect(x+2,y+2,w-4,h-4);
    }

    // Level number tag
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(x+6,y+6,28,22);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 14px system-ui";
    ctx.fillText(String(i+1).padStart(2,"0"), x+12, y+22);
  }

  setStatus("Select a level");
  timerText.textContent = "Time: 03:00";
}

canvas.addEventListener("click",(ev)=>{
  if(mode !== "selector") return;
  const rect = canvas.getBoundingClientRect();
  const px = (ev.clientX-rect.left)*(canvas.width/rect.width);
  const py = (ev.clientY-rect.top)*(canvas.height/rect.height);
  for(let i=0;i<cubeRects.length;i++){
    const r = cubeRects[i];
    if(px>=r.x && px<r.x+r.w && py>=r.y && py<r.y+r.h){
      if(levelThumbs[i].unlocked){
        startLevel(i+1);
      }
      break;
    }
  }
});

function unlockLevel(levelNumber){
  if(levelThumbs[levelNumber-1]){
    levelThumbs[levelNumber-1].unlocked = true;
    if(mode === "selector") drawLevelSelector();
  }
}

// --- Puzzle creation ---
function loadImage(lvl,num){
  setStatus("Loading…");
  const img = new Image();
  img.src = imgPath(lvl,num);
  img.onload = ()=>{
    baseImg = img;
    ctx.clearRect(0,0,canvas.width,canvas.height);
    // Preview of the image, then countdown to start
    mode = "preview";
    resizeCanvas();
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    startCountdown(()=>{
      mode = "puzzle";
      resizeCanvas();
      sliceImage(img);
      randomizeBoard();
      render();
      setStatus(`Level ${lvl}, Image ${pad2(num)} of ${imagesPerLevel}`);
      startTimer();
    });
  };
}

function sliceImage(img){
  pieces = [];
  cellPieces = new Array(rows*cols).fill(null);
  let id = 0;
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

// --- Rendering ---
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

// --- Win check ---
function checkWin(){
  for(const p of pieces){ if(p.currentIndex!==p.correctIndex) return false; }
  stopTimer();
  setStatus("Completed ✓");
  score += 10; updateScore();

  if(scorePopup){
    scorePopup.textContent = "+10";
    scorePopup.style.display = "block";
  }

  canvas.style.animation = "glow 1s linear infinite, blink 1s linear infinite";

  setTimeout(()=>{
    if(scorePopup) scorePopup.style.display = "none";
    canvas.style.animation = "";

    // Level bonus at last image of level
    if(imageNum === imagesPerLevel){
      score += 100; updateScore();
      // Unlock next level cube in selector
      if(level < LEVELS_COUNT) unlockLevel(level + 1);
      // Return to selector
      mode = "selector";
      resizeCanvas();
      drawLevelSelector();
      overlay.style.display = "flex";
      playBtn.textContent = "PLAY NEXT LEVEL";
      setStatus("Level complete! Select next level.");
      imageNum = 1;
      level = Math.min(level + 1, LEVELS_COUNT);
      return;
    } else {
      // Continue to next image within same level
      imageNum++;
      mode = "preview";
      loadImage(level, imageNum);
    }
  }, 1500);

  return true;
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

// --- Dragging lifecycle ---
function onDown(px, py){
  if(mode !== "puzzle") return;
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
  if(mode !== "puzzle" || !dragging) return;
  dragging.x = px;
  dragging.y = py;
  render();
}

function onUp(px, py){
  if(mode !== "puzzle" || !dragging) return;
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
canvas.addEventListener("mousedown", handleDown);
window.addEventListener("mousemove", handleMove);
window.addEventListener("mouseup", handleUp);

canvas.addEventListener("touchstart", handleDown, { passive: false });
window.addEventListener("touchmove", handleMove, { passive: false });
window.addEventListener("touchend", handleUp, { passive: false });

// --- PLAY button (overlay gating preserved) ---
playBtn.addEventListener("click", () => {
  overlay.style.display = "none";
  const fc = document.getElementById("frame-container");
  if(fc) fc.style.height = "721px";

  // Do NOT auto-start any level. Leave selector visible for user choice.
  if(mode === "selector"){
    setStatus("Select a level");
    drawLevelSelector();
  }
});

// --- Start a level from selector ---
function startLevel(levelNumber){
  level = levelNumber;
  imageNum = 1;
  score = 0; updateScore();
  mode = "preview";
  loadImage(level, imageNum);
  setStatus(`Level ${level} starting…`);
}

// --- Init ---
function init(){
  mode = "selector";
  loadLevelThumbs();      // populate levelThumbs first
  resizeCanvas();         // then draw selector
  overlay.style.display = "flex";
  playBtn.textContent = "PLAY";
  setStatus("Select a level");
  timerText.textContent = "Time: 03:00";
}
init();

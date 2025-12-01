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

// --- Game config/state ---
let rows = 5, cols = 5; // 25 pieces
let pieceW, pieceH;
let pieces = [], cellPieces = [], baseImg = null, dragging = null;
let level = 1, imageNum = 1;
const levelsCount = 10, imagesPerLevel = 10;
let score = 0;
let timerDuration = 180000; // 3 minutes
let timerEnd = 0, timerInterval = null;

// --- Utils ---
function pad2(n){ return String(n).padStart(2,'0'); }
function imgPath(level,num){ return `img/${pad2(level)}/img${pad2(num)}.png`; }

// --- Canvas sizing ---
function resizeCanvas(){
  const targetWidth = window.innerWidth >= 641 ? 800 : window.innerWidth;
  canvas.width = targetWidth;
  canvas.height = rows === cols ? targetWidth : canvas.width * (rows / cols);
  pieceW = canvas.width / cols;
  pieceH = canvas.height / rows;

  if(baseImg && pieces.length){
    // Rescale existing pieces (keep shuffled state)
    pieces.forEach(p => {
      const pos = cellXYFromIndex(p.currentIndex);
      p.x = pos.x;
      p.y = pos.y;

      p.canvas.width = pieceW;
      p.canvas.height = pieceH;
      const ctxPiece = p.canvas.getContext("2d");
      ctxPiece.clearRect(0,0,pieceW,pieceH);

      const sx = (p.correctIndex % cols) * (baseImg.width / cols);
      const sy = Math.floor(p.correctIndex / cols) * (baseImg.height / rows);
      const sW = baseImg.width / cols;
      const sH = baseImg.height / rows;

      ctxPiece.drawImage(baseImg, sx, sy, sW, sH, 0, 0, pieceW, pieceH);
    });
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
      setStatus("Time up!");
      advanceImage();
      return;
    }
    const t = Math.floor(remaining/1000);
    const m = String(Math.floor(t/60)).padStart(2,'0');
    const s = String(t%60).padStart(2,'0');
    timerText.textContent = `Time left: ${m}:${s}`;
  }, 200);
}
function stopTimer(){
  if(timerInterval){
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

// --- Countdown preview ---
function startCountdown(callback){
  if(!countdownOverlay || !countdownText){
    callback(); // Fallback: no overlay present
    return;
  }
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

// --- Start gallery (shown before PLAY) ---
function showStartGallery(){
  ctx.clearRect(0,0,canvas.width,canvas.height);

  // Choose 4–6 images, here we draw 4 in a 2x2 grid
  const galleryImages = shuffleArray([
    imgPath(1,1), imgPath(1,2), imgPath(1,3),
    imgPath(1,4), imgPath(1,5), imgPath(1,6)
  ]);

  const positions = [
    {x:0, y:0},
    {x:canvas.width/2, y:0},
    {x:0, y:canvas.height/2},
    {x:canvas.width/2, y:canvas.height/2}
  ];

  galleryImages.slice(0, positions.length).forEach((src, i) => {
    const img = new Image();
    img.src = src;
    img.onload = ()=>{
      ctx.drawImage(img, positions[i].x, positions[i].y,
        canvas.width/2, canvas.height/2);
    };
  });
}

// --- Image loading + preview-to-play ---
function loadImage(lvl,num){
  setStatus("Loading…");
  const img = new Image();
  img.src = imgPath(lvl,num);
  img.onload = ()=>{
    baseImg = img;

    // Show full image preview
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // Countdown then slice/shuffle/start
    startCountdown(()=>{
      sliceImage(img);
      randomizeBoard();
      render();
      setStatus(`Level ${lvl}, Image ${pad2(num)} of ${imagesPerLevel}`);
      startTimer();
    });
  };
}

// --- Puzzle creation ---
function sliceImage(img){
  pieces = [];
  cellPieces = new Array(rows*cols).fill(null);
  let id = 0;
  for(let r=0; r<rows; r++){
    for(let c=0; c<cols; c++){
      const sx = c * (img.width / cols);
      const sy = r * (img.height / rows);
      const sW = img.width / cols;
      const sH = img.height / rows;

      const pc = document.createElement("canvas");
      pc.width = pieceW; pc.height = pieceH;
      pc.getContext("2d").drawImage(img, sx, sy, sW, sH, 0, 0, pieceW, pieceH);

      const correctIndex = r * cols + c;
      pieces.push({
        id,
        canvas: pc,
        correctIndex,
        currentIndex: correctIndex,
        x: c * pieceW,
        y: r * pieceH
      });
      id++;
    }
  }
}

// --- Shuffle and place ---
function shuffleArray(arr){
  for(let i=arr.length-1; i>0; i--){
    const j = Math.floor(Math.random()*(i+1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function randomizeBoard(){
  const indices = shuffleArray([...pieces.map(p=>p.correctIndex)]);
  pieces.forEach((p, i) => {
    const ci = indices[i];
    p.currentIndex = ci;
    const pos = cellXYFromIndex(ci);
    p.x = pos.x; p.y = pos.y;
  });
  cellPieces.fill(null);
  for(const p of pieces){
    cellPieces[p.currentIndex] = p.id;
  }
}

// --- Cell helpers ---
function cellIndexFromXY(x,y){
  const c = Math.max(0, Math.min(cols-1, Math.floor(x / pieceW)));
  const r = Math.max(0, Math.min(rows-1, Math.floor(y / pieceH)));
  return r * cols + c;
}
function cellXYFromIndex(idx){
  const r = Math.floor(idx / cols), c = idx % cols;
  return { x: c * pieceW, y: r * pieceH };
}

// --- Render ---
function render(){
  ctx.clearRect(0,0,canvas.width,canvas.height);

  // Draw non-dragging pieces first
  for(const p of pieces){
    if(dragging && dragging.id === p.id) continue;
    ctx.drawImage(p.canvas, p.x, p.y);
  }

  // Draw dragging piece with glow
  if(dragging){
    ctx.save();
    ctx.shadowColor = "#00ff66";
    ctx.shadowBlur = 40;
    const d = pieces[dragging.id];
    ctx.drawImage(d.canvas,
      dragging.x - dragging.offsetX,
      dragging.y - dragging.offsetY
    );
    ctx.restore();
  }
}

// --- Win check ---
function checkWin(){
  for(const p of pieces){
    if(p.currentIndex !== p.correctIndex) return false;
  }
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
    if(imageNum === imagesPerLevel){
      score += 100; updateScore();
    }
    advanceImage();
  }, 6000);

  return true;
}

// --- Advance image/level ---
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
  return { x, y };
}

function pointToPieceId(px, py){
  const idx = cellIndexFromXY(px, py);
  const pid = cellPieces[idx];
  if(pid == null) return null;
  const p = pieces[pid];
  if(px >= p.x && px < p.x + pieceW && py >= p.y && py < p.y + pieceH) return pid;
  return null;
}

// --- Dragging actions ---
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

  // Determine target cell using piece center
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
    // Swap with occupant
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

// --- PLAY button ---
playBtn.addEventListener("click", () => {
  overlay.style.display = "none";
  score = 0; updateScore();
  level = 1; imageNum = 1;
  resizeCanvas();
  loadImage(level, imageNum);
  setStatus("Puzzle starting...");
});

// --- Init ---
function init(){
  resizeCanvas();
  showStartGallery();       // show 4 static images behind overlay
  overlay.style.display = "flex"; // show PLAY overlay initially
  setStatus("Ready");
}
init();

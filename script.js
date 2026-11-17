"use strict";

const DIFFICULTIES = {
  easy: { columns: 5, rows: 4 },
  hard: { columns: 8, rows: 5 },
};
const TAB_RATIO = 0.2;

const board = document.querySelector("#board");
const boardGrid = document.querySelector("#board-grid");
const tray = document.querySelector("#piece-tray");
const gameArea = document.querySelector(".game-area");
const placedCount = document.querySelector("#placed-count");
const progressFill = document.querySelector("#progress-fill");
const progressBar = document.querySelector(".progress-track");
const pieceTotal = document.querySelector("#piece-total");
const boardSize = document.querySelector("#board-size");
const timerDisplay = document.querySelector("#timer");
const finalTime = document.querySelector("#final-time");
const gameMessage = document.querySelector("#game-message");
const winBanner = document.querySelector("#win-banner");
const backgroundAudio = document.querySelector("#background-audio");
const dropAudio = document.querySelector("#drop-audio");
const musicButton = document.querySelector("#music-button");
const musicLabel = document.querySelector("#music-label");

const image = new Image();
image.src = "car.jpeg";
backgroundAudio.volume = 0.18;
dropAudio.volume = 0.65;

let difficulty = "easy";
let columns = DIFFICULTIES[difficulty].columns;
let rows = DIFFICULTIES[difficulty].rows;
let pieceCount = columns * rows;
let pieces = [];
let placedPieces = 0;
let elapsedSeconds = 0;
let timerInterval;
let gameFinished = false;

function randomEdge() {
  return Math.random() < 0.5 ? -1 : 1;
}

function shuffle(items) {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
  }
  return items;
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const remainder = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainder}`;
}

function edgeSegment(x, y, dx, dy, length, sign, depth) {
  const nx = dy;
  const ny = -dx;
  const point = (fraction, offset) =>
    `${x + dx * length * fraction + nx * offset},${y + dy * length * fraction + ny * offset}`;

  if (sign === 0) {
    return `L ${point(1, 0)}`;
  }

  const offset = sign * depth;
  return [
    `L ${point(0.3, 0)}`,
    `C ${point(0.34, 0)} ${point(0.36, offset * 0.3)} ${point(0.42, offset * 0.3)}`,
    `C ${point(0.4, offset * 0.75)} ${point(0.43, offset)} ${point(0.5, offset)}`,
    `C ${point(0.57, offset)} ${point(0.6, offset * 0.75)} ${point(0.58, offset * 0.3)}`,
    `C ${point(0.64, offset * 0.3)} ${point(0.66, 0)} ${point(0.7, 0)}`,
    `L ${point(1, 0)}`,
  ].join(" ");
}

function makePiecePath(piece, cellWidth, cellHeight, tab) {
  const x = tab;
  const y = tab;
  return [
    `M ${x},${y}`,
    edgeSegment(x, y, 1, 0, cellWidth, piece.top, tab),
    edgeSegment(x + cellWidth, y, 0, 1, cellHeight, piece.right, tab),
    edgeSegment(x + cellWidth, y + cellHeight, -1, 0, cellWidth, piece.bottom, tab),
    edgeSegment(x, y + cellHeight, 0, -1, cellHeight, piece.left, tab),
    "Z",
  ].join(" ");
}

function createSvgElement(tagName, attributes = {}) {
  const element = document.createElementNS("http://www.w3.org/2000/svg", tagName);
  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, value);
  }
  return element;
}

function makePieceSvg(piece, cellWidth, cellHeight, tab) {
  const width = cellWidth + tab * 2;
  const height = cellHeight + tab * 2;
  const path = makePiecePath(piece, cellWidth, cellHeight, tab);
  const clipId = `clip-piece-${piece.id}`;
  const svg = createSvgElement("svg", {
    class: "piece",
    viewBox: `0 0 ${width} ${height}`,
    width: `${width}`,
    height: `${height}`,
    "aria-label": `ชิ้นส่วนที่ ${piece.id + 1} จาก ${pieceCount}`,
    role: "img",
  });
  const defs = createSvgElement("defs");
  const clipPath = createSvgElement("clipPath", {
    id: clipId,
    clipPathUnits: "userSpaceOnUse",
  });
  clipPath.append(createSvgElement("path", { d: path }));
  defs.append(clipPath);
  svg.append(defs);

  const imageElement = createSvgElement("image", {
    x: `${tab - piece.column * cellWidth}`,
    y: `${tab - piece.row * cellHeight}`,
    width: `${board.clientWidth}`,
    height: `${board.clientHeight}`,
    preserveAspectRatio: "none",
    href: image.src,
    "clip-path": `url(#${clipId})`,
  });
  const outline = createSvgElement("path", {
    d: path,
    fill: "none",
    stroke: "rgba(255,255,255,0.82)",
    "stroke-width": "1.5",
    "vector-effect": "non-scaling-stroke",
    "pointer-events": "none",
  });
  svg.append(imageElement, outline);
  svg.addEventListener("pointerdown", (event) => startDragging(event, piece));
  return svg;
}

function setSvgPosition(svg, position, left, top) {
  svg.style.position = position;
  svg.style.left = `${left}px`;
  svg.style.top = `${top}px`;
}

function resizePieces() {
  if (!pieces.length) return;

  const cellWidth = board.clientWidth / columns;
  const cellHeight = board.clientHeight / rows;
  const tab = Math.min(cellWidth, cellHeight) * TAB_RATIO;
  const trayColumns = getComputedStyle(tray).gridTemplateColumns.split(" ").length;
  const traySlotWidth = tray.clientWidth / trayColumns;

  for (const piece of pieces) {
    const svg = piece.element;
    const width = cellWidth + tab * 2;
    const height = cellHeight + tab * 2;
    piece.width = width;
    piece.height = height;
    const path = makePiecePath(piece, cellWidth, cellHeight, tab);
    const clip = svg.querySelector("clipPath path");
    const imageElement = svg.querySelector("image");
    const outline = svg.querySelector(":scope > path");

    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("width", `${width}`);
    svg.setAttribute("height", `${height}`);
    clip.setAttribute("d", path);
    imageElement.setAttribute("x", `${tab - piece.column * cellWidth}`);
    imageElement.setAttribute("y", `${tab - piece.row * cellHeight}`);
    imageElement.setAttribute("width", `${board.clientWidth}`);
    imageElement.setAttribute("height", `${board.clientHeight}`);
    outline.setAttribute("d", path);

    if (piece.placed) {
      svg.style.width = `${width}px`;
      svg.style.height = `${height}px`;
      setSvgPosition(svg, "absolute", piece.column * cellWidth - tab, piece.row * cellHeight - tab);
    } else if (svg.parentElement === piece.slot) {
      piece.previewScale = Math.min(0.7, (traySlotWidth - 6) / width);
      svg.style.width = `${width * piece.previewScale}px`;
      svg.style.height = `${height * piece.previewScale}px`;
    } else if (svg.parentElement === gameArea) {
      svg.style.width = `${width}px`;
      svg.style.height = `${height}px`;
    }
  }
}

function updateProgress() {
  placedCount.textContent = `${placedPieces}`;
  progressFill.style.width = `${(placedPieces / pieceCount) * 100}%`;
  progressBar.setAttribute("aria-valuenow", `${placedPieces}`);
  progressBar.setAttribute("aria-valuemax", `${pieceCount}`);
}

function startTimer() {
  window.clearInterval(timerInterval);
  elapsedSeconds = 0;
  timerDisplay.textContent = formatTime(elapsedSeconds);
  timerInterval = window.setInterval(() => {
    elapsedSeconds += 1;
    timerDisplay.textContent = formatTime(elapsedSeconds);
  }, 1000);
}

async function toggleBackgroundMusic() {
  if (!backgroundAudio.paused) {
    backgroundAudio.pause();
    musicLabel.textContent = "เปิดเพลง";
    musicButton.setAttribute("aria-pressed", "false");
    return;
  }

  try {
    await backgroundAudio.play();
    musicLabel.textContent = "ปิดเพลง";
    musicButton.setAttribute("aria-pressed", "true");
  } catch {
    gameMessage.textContent = "เปิดเพลงไม่ได้ กรุณาตรวจสอบไฟล์ background-music.mp3";
    musicLabel.textContent = "ลองเปิดเพลงอีกครั้ง";
    musicButton.setAttribute("aria-pressed", "false");
  }
}

function playDropSound() {
  dropAudio.currentTime = 0;
  dropAudio.play().catch(() => {
    gameMessage.textContent = "วางชิ้นส่วนแล้ว แต่เล่นเสียงเอฟเฟกต์ไม่ได้ กรุณาตรวจสอบไฟล์ jigsaw-drop.mp3";
  });
}

function startDragging(event, piece) {
  if (gameFinished || piece.placed || event.button !== 0) return;
  event.preventDefault();

  const svg = piece.element;
  const rect = svg.getBoundingClientRect();
  const offsetX = ((event.clientX - rect.left) / rect.width) * piece.width;
  const offsetY = ((event.clientY - rect.top) / rect.height) * piece.height;

  svg.classList.add("is-dragging");
  svg.style.position = "fixed";
  svg.style.width = `${piece.width}px`;
  svg.style.height = `${piece.height}px`;
  svg.style.left = `${rect.left}px`;
  svg.style.top = `${rect.top}px`;
  svg.style.zIndex = "1000";
  document.body.append(svg);
  svg.setPointerCapture(event.pointerId);

  const movePiece = (moveEvent) => {
    svg.style.left = `${moveEvent.clientX - offsetX}px`;
    svg.style.top = `${moveEvent.clientY - offsetY}px`;
  };

  const releasePiece = (upEvent) => {
    svg.removeEventListener("pointermove", movePiece);
    svg.removeEventListener("pointerup", releasePiece);
    svg.removeEventListener("pointercancel", cancelPiece);
    svg.classList.remove("is-dragging");
    svg.style.zIndex = "";
    if (svg.hasPointerCapture(upEvent.pointerId)) svg.releasePointerCapture(upEvent.pointerId);

    const cellWidth = board.clientWidth / columns;
    const cellHeight = board.clientHeight / rows;
    const tab = Math.min(cellWidth, cellHeight) * TAB_RATIO;
    const boardRect = board.getBoundingClientRect();
    const boardLeft = boardRect.left + board.clientLeft;
    const boardTop = boardRect.top + board.clientTop;
    const dropColumn = Math.floor((upEvent.clientX - boardLeft) / cellWidth);
    const dropRow = Math.floor((upEvent.clientY - boardTop) / cellHeight);
    const isCorrectCell = dropColumn === piece.column && dropRow === piece.row;

    if (isCorrectCell) {
      piece.placed = true;
      piece.element.classList.add("is-placed");
      piece.element.setAttribute("aria-label", `วางชิ้นส่วนที่ ${piece.id + 1} แล้ว`);
      piece.element.style.pointerEvents = "none";
      board.append(piece.element);
      setSvgPosition(piece.element, "absolute", piece.column * cellWidth - tab, piece.row * cellHeight - tab);
      placedPieces += 1;
      updateProgress();
      playDropSound();
      gameMessage.textContent = `วางชิ้นส่วนแล้ว ${placedPieces} จาก ${pieceCount} ชิ้น`;
      if (placedPieces === pieceCount) finishGame();
    } else {
      piece.slot.append(svg);
      svg.style.position = "";
      svg.style.left = "";
      svg.style.top = "";
      svg.style.zIndex = "";
      resizePieces();
      gameMessage.textContent = "ยังไม่ตรงช่อง ชิ้นส่วนกลับไปที่ถาดแล้ว ลองวางในช่องที่ตรงกับภาพจาง ๆ";
    }
  };

  const cancelPiece = (cancelEvent) => {
    svg.removeEventListener("pointermove", movePiece);
    svg.removeEventListener("pointerup", releasePiece);
    svg.removeEventListener("pointercancel", cancelPiece);
    svg.classList.remove("is-dragging");
    if (svg.hasPointerCapture(cancelEvent.pointerId)) svg.releasePointerCapture(cancelEvent.pointerId);
    piece.slot.append(svg);
    svg.style.position = "";
    svg.style.left = "";
    svg.style.top = "";
    svg.style.zIndex = "";
    resizePieces();
  };

  svg.addEventListener("pointermove", movePiece);
  svg.addEventListener("pointerup", releasePiece);
  svg.addEventListener("pointercancel", cancelPiece);
}

function finishGame() {
  gameFinished = true;
  window.clearInterval(timerInterval);
  finalTime.textContent = formatTime(elapsedSeconds);
  winBanner.hidden = false;
  gameMessage.textContent = "ประกอบภาพครบแล้ว ยอดเยี่ยมมาก!";
}

function prepareBoard() {
  boardGrid.replaceChildren();
  boardGrid.style.gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`;
  boardGrid.style.gridTemplateRows = `repeat(${rows}, minmax(0, 1fr))`;
  for (let index = 0; index < pieceCount; index += 1) {
    const slot = document.createElement("div");
    slot.className = "board-slot";
    boardGrid.append(slot);
  }
  board.style.aspectRatio = `${image.naturalWidth} / ${image.naturalHeight}`;
}

function createPieces() {
  const nextPieces = [];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      nextPieces.push({
        id: row * columns + column,
        row,
        column,
        top: row === 0 ? 0 : -nextPieces[(row - 1) * columns + column].bottom,
        right: column === columns - 1 ? 0 : randomEdge(),
        bottom: row === rows - 1 ? 0 : randomEdge(),
        left: column === 0 ? 0 : -nextPieces[row * columns + column - 1].right,
        placed: false,
        slot: null,
        element: null,
      });
    }
  }
  return nextPieces;
}

function resetGame() {
  if (!image.complete || !image.naturalWidth) return;

  window.clearInterval(timerInterval);
  gameFinished = false;
  placedPieces = 0;
  updateProgress();
  timerDisplay.textContent = "00:00";
  winBanner.hidden = true;
  gameMessage.textContent = "ลากชิ้นส่วนไปวางในช่องที่ตรงกับภาพจาง ๆ บนกระดาน";
  board.querySelectorAll(".piece").forEach((piece) => piece.remove());
  gameArea.querySelectorAll(":scope > .piece").forEach((piece) => piece.remove());
  prepareBoard();
  pieces = createPieces();

  const cellWidth = board.clientWidth / columns;
  const cellHeight = board.clientHeight / rows;
  const tab = Math.min(cellWidth, cellHeight) * TAB_RATIO;
  const shuffledPieces = shuffle([...pieces]);
  tray.replaceChildren();

  for (const piece of shuffledPieces) {
    const slot = document.createElement("div");
    slot.className = "piece-slot";
    piece.slot = slot;
    piece.element = makePieceSvg(piece, cellWidth, cellHeight, tab);
    slot.append(piece.element);
    tray.append(slot);
  }
  resizePieces();
  startTimer();
}

function setDifficulty(nextDifficulty) {
  if (!DIFFICULTIES[nextDifficulty]) return;

  difficulty = nextDifficulty;
  columns = DIFFICULTIES[difficulty].columns;
  rows = DIFFICULTIES[difficulty].rows;
  pieceCount = columns * rows;
  pieceTotal.textContent = `${pieceCount}`;
  boardSize.textContent = `${columns} × ${rows} ชิ้น`;
  document.querySelector("#easy-button").setAttribute("aria-pressed", `${difficulty === "easy"}`);
  document.querySelector("#hard-button").setAttribute("aria-pressed", `${difficulty === "hard"}`);
  document.querySelector("#easy-button").classList.toggle("is-active", difficulty === "easy");
  document.querySelector("#hard-button").classList.toggle("is-active", difficulty === "hard");
  resetGame();
}

image.addEventListener("load", resetGame);
image.addEventListener("error", () => {
  gameMessage.textContent = "โหลดภาพ car.jpeg ไม่สำเร็จ กรุณาตรวจสอบว่าไฟล์อยู่ในโฟลเดอร์เดียวกับเกม";
});
window.addEventListener("resize", resizePieces);

document.querySelector("#reset-button").addEventListener("click", resetGame);
document.querySelector("#easy-button").addEventListener("click", () => setDifficulty("easy"));
document.querySelector("#hard-button").addEventListener("click", () => setDifficulty("hard"));
musicButton.addEventListener("click", toggleBackgroundMusic);

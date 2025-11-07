/*
  Tetris responsivo com teclado e toque.
  - Level up: a cada 5 linhas completas.
  - Velocidade aumenta por nível.
  - Botões: esquerda, direita, girar, acelerar (soft drop), queda rápida (hard drop), pausa e música.
  - Música: use o arquivo music.mp3 na mesma pasta.
*/

const COLS = 10;
const ROWS = 20;
const BLOCK = 30; // tamanho lógico (o canvas é escalado por CSS)

const canvas = document.getElementById('stage');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next');
const nctx = nextCanvas.getContext('2d');

// Ajusta o canvas para o tamanho lógico fixo (mantido 300x600 px; CSS escala sem cortar)
canvas.width = COLS * BLOCK; // 300
canvas.height = ROWS * BLOCK; // 600

// Cores das peças
const COLORS = {
  I: '#00e0b8', // ciano
  J: '#5d55ff', // anil
  L: '#ff9f1c', // laranja
  O: '#ffd166', // amarelo
  S: '#06d6a0', // verde
  T: '#c77dff', // roxo
  Z: '#ef476f', // vermelho
};

// Tetrominós (matrizes)
const SHAPES = {
  I: [ [0,0,0,0], [1,1,1,1], [0,0,0,0], [0,0,0,0] ],
  J: [ [1,0,0], [1,1,1], [0,0,0] ],
  L: [ [0,0,1], [1,1,1], [0,0,0] ],
  O: [ [1,1], [1,1] ],
  S: [ [0,1,1], [1,1,0], [0,0,0] ],
  T: [ [0,1,0], [1,1,1], [0,0,0] ],
  Z: [ [1,1,0], [0,1,1], [0,0,0] ],
};

// Estado do jogo
let board = createMatrix(COLS, ROWS);
let score = 0;
let level = 1;
let linesThisLevel = 0; // sobe de nível ao chegar em 5
let dropInterval = speedForLevel(level); // ms
let lastTime = 0;
let dropCounter = 0;
let paused = false;

// Música
const bgm = document.getElementById('bgm');
const btnMusic = document.getElementById('btn-music');
btnMusic.addEventListener('click', () => {
  if (bgm.paused) { bgm.play(); btnMusic.textContent = '⏸️ Pausar'; btnMusic.setAttribute('aria-pressed', 'true'); }
  else { bgm.pause(); btnMusic.textContent = '▶️ Tocar'; btnMusic.setAttribute('aria-pressed', 'false'); }
});

// Peça atual e próxima
let nextPiece = randomPiece();
let current = spawn();

// UI refs
const $level = document.getElementById('level');
const $speed = document.getElementById('speed');
const $score = document.getElementById('score');
const $linesLevel = document.getElementById('lines-level');

drawNext();
updateUI();

// Loop principal
function update(time = 0) {
  if (!paused) {
    const delta = time - lastTime;
    lastTime = time;
    dropCounter += delta;
    if (dropCounter > dropInterval) {
      softDrop();
    }
    draw();
  }
  requestAnimationFrame(update);
}
requestAnimationFrame(update);

// Controles por teclado
window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  switch (e.key) {
    case 'ArrowLeft': move(-1); break;
    case 'ArrowRight': move(1); break;
    case 'ArrowDown': softDrop(); break;
    case ' ': hardDrop(); break;
    case 'ArrowUp':
    case 'x':
    case 'X': rotate(1); break;
    case 'z':
    case 'Z': rotate(-1); break;
    case 'p':
    case 'P': togglePause(); break;
    case 'm':
    case 'M': btnMusic.click(); break;
  }
});

// Botões (toque/click)
const bind = (id, fn) => document.getElementById(id).addEventListener('click', fn);
BindButtons();

function BindButtons(){
  bind('left', () => move(-1));
  bind('right', () => move(1));
  bind('rotate', () => rotate(1));
  bind('soft', () => softDrop());
  bind('hard', () => hardDrop());
  bind('pause', () => togglePause());
}

function togglePause() { paused = !paused; }

function createMatrix(w, h) { return Array.from({ length: h }, () => Array(w).fill(0)); }

function createPiece(type) {
  return {
    type,
    color: COLORS[type],
    matrix: SHAPES[type].map(r => r.slice()),
    pos: { x: 3, y: 0 },
  };
}

function randomPiece() {
  const types = Object.keys(SHAPES);
  const t = types[(Math.random()*types.length)|0];
  return createPiece(t);
}

function spawn() {
  const p = nextPiece;
  nextPiece = randomPiece();
  drawNext();
  p.pos.x = ((COLS / 2) | 0) - ((p.matrix[0].length / 2) | 0);
  p.pos.y = 0;
  if (collide(board, p)) {
    // Game Over: reset board/score mantendo nível 1
    board = createMatrix(COLS, ROWS);
    score = 0; level = 1; linesThisLevel = 0; dropInterval = speedForLevel(level);
    updateUI();
  }
  return p;
}

function rotate(dir) {
  const m = current.matrix;
  // Transpõe
  for (let y = 0; y < m.length; y++) {
    for (let x = 0; x < y; x++) {
      [m[x][y], m[y][x]] = [m[y][x], m[x][y]];
    }
  }
  // Inverte linha/coluna conforme direção
  if (dir > 0) m.forEach(row => row.reverse());
  else m.reverse();

  const posX = current.pos.x;
  let offset = 1;
  // Wall kick simples
  while (collide(board, current)) {
    current.pos.x += offset;
    offset = -(offset + (offset > 0 ? 1 : -1));
    if (offset > m[0].length) { // rotação impossível
      // desfaz rotação
      if (dir > 0) { m.forEach(row => row.reverse()); }
      else { m.reverse(); }
      // desfaz transposição
      for (let y = 0; y < m.length; y++) {
        for (let x = 0; x < y; x++) {
          [m[x][y], m[y][x]] = [m[y][x], m[x][y]];
        }
      }
      current.pos.x = posX;
      return;
    }
  }
}

function move(dir) {
  current.pos.x += dir;
  if (collide(board, current)) current.pos.x -= dir;
}

function softDrop() {
  current.pos.y++;
  if (collide(board, current)) {
    current.pos.y--;
    merge(board, current);
    const cleared = sweep();
    if (cleared > 0) {
      score += cleared * 100 * level;
      linesThisLevel += cleared;
      if (linesThisLevel >= 5) { // sobe de nível após 5 linhas completas
        level++;
        linesThisLevel = 0;
        dropInterval = speedForLevel(level);
      }
      updateUI();
    }
    current = spawn();
  }
  dropCounter = 0;
}

function hardDrop() {
  while (!collide(board, current)) { current.pos.y++; }
  current.pos.y--;
  merge(board, current);
  const cleared = sweep();
  if (cleared > 0) {
    score += cleared * 100 * level;
    linesThisLevel += cleared;
    if (linesThisLevel >= 5) {
      level++;
      linesThisLevel = 0;
      dropInterval = speedForLevel(level);
    }
  }
  updateUI();
  current = spawn();
  dropCounter = 0;
}

function collide(board, piece) {
  const m = piece.matrix;
  const o = piece.pos;
  for (let y = 0; y < m.length; ++y) {
    for (let x = 0; x < m[y].length; ++x) {
      if (m[y][x] !== 0 && (
          board[y + o.y] === undefined ||
          board[y + o.y][x + o.x] === undefined ||
          board[y + o.y][x + o.x] !== 0)) {
        return true;
      }
    }
  }
  return false;
}

function merge(board, piece) {
  piece.matrix.forEach((row, y) => {
    row.forEach((v, x) => {
      if (v !== 0) board[y + piece.pos.y][x + piece.pos.x] = piece.color;
    });
  });
}

function sweep() {
  let lines = 0;
  outer: for (let y = board.length - 1; y >= 0; --y) {
    for (let x = 0; x < board[y].length; ++x) {
      if (board[y][x] === 0) continue outer;
    }
    const row = board.splice(y, 1)[0].fill(0);
    board.unshift(row);
    ++lines; ++y; // reavalia mesma linha
  }
  return lines; // retorna quantas linhas foram feitas de uma vez
}

function drawBlock(x, y, color) {
  const px = x * BLOCK;
  const py = y * BLOCK;
  // Bloco com estilo agradável e borda suave
  ctx.fillStyle = color;
  ctx.fillRect(px + 1, py + 1, BLOCK - 2, BLOCK - 2);
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = '#fff';
  ctx.fillRect(px + 3, py + 3, BLOCK - 6, (BLOCK - 6) / 2);
  ctx.globalAlpha = 1;
}

function draw() {
  // fundo do tabuleiro
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#0b0c1a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // grade
  ctx.globalAlpha = 0.15;
  ctx.strokeStyle = '#ffffff';
  for (let x = 0; x <= COLS; x++) {
    ctx.beginPath();
    ctx.moveTo(x * BLOCK + .5, 0);
    ctx.lineTo(x * BLOCK + .5, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y <= ROWS; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * BLOCK + .5);
    ctx.lineTo(canvas.width, y * BLOCK + .5);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // desenha peças fixas
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const cell = board[y][x];
      if (cell) drawBlock(x, y, cell);
    }
  }
  // desenha peça atual
  current.matrix.forEach((row, y) => {
    row.forEach((v, x) => {
      if (v !== 0) drawBlock(x + current.pos.x, y + current.pos.y, current.color);
    });
  });
}

function drawNext() {
  nctx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const m = nextPiece.matrix;
  const color = nextPiece.color;
  const cell = 24; // tamanho do preview

  // centraliza no canvas de preview
  const w = m[0].length * cell;
  const h = m.length * cell;
  const ox = (nextCanvas.width - w) / 2;
  const oy = (nextCanvas.height - h) / 2;

  // fundo
  nctx.fillStyle = '#0b0c1a';
  nctx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);

  for (let y = 0; y < m.length; y++) {
    for (let x = 0; x < m[y].length; x++) {
      if (m[y][x]) {
        nctx.fillStyle = color;
        nctx.fillRect(ox + x * cell + 1, oy + y * cell + 1, cell - 2, cell - 2);
        nctx.globalAlpha = 0.25;
        nctx.fillStyle = '#fff';
        nctx.fillRect(ox + x * cell + 3, oy + y * cell + 3, cell - 6, (cell - 6) / 2);
        nctx.globalAlpha = 1;
      }
    }
  }
}

function speedForLevel(lv) {
  // começa devagar (nível 1 ~ 900ms) e acelera ~ 10% por nível
  return Math.max(90, Math.floor(900 * Math.pow(0.9, lv - 1)));
}

function updateUI() {
  document.getElementById('year').textContent = new Date().getFullYear();
  $level.textContent = level;
  $speed.textContent = `${(900 / dropInterval).toFixed(1)}x`;
  $score.textContent = score;
  $linesLevel.textContent = `${Math.min(5, linesThisLevel)}/5`;
}

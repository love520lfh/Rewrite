const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const bestScoreEl = document.getElementById('best-score');
const overlayEl = document.getElementById('game-over');
const finalScoreEl = document.getElementById('final-score');
const finalBestScoreEl = document.getElementById('final-best-score');
const restartButton = document.getElementById('restart-button');

const GRID_SIZE = 20;
const CELL_SIZE = canvas.width / GRID_SIZE;
const BASE_SPEED = 8; // ticks per second
const SPEED_INCREMENT = 0.5; // extra ticks per second every speed milestone
const FOODS_PER_SPEEDUP = 5;
const STORAGE_KEY = 'snakeBestScore';

const COLORS = {
  background: '#0b1220',
  grid: 'rgba(148, 163, 184, 0.06)',
  snake: '#4ade80',
  snakeHead: '#22c55e',
  food: '#f87171',
};

const KEY_TO_DIRECTION = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
};

let gameState;
let msPerTick = 1000 / BASE_SPEED;
let lastTickTime = 0;
let animationId = null;
let bestScore = loadBestScore();

init();

/**
 * Sets up listeners and starts the first game instance.
 */
function init() {
  restartButton.addEventListener('click', startNewGame);
  restartButton.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      startNewGame();
    }
  });

  window.addEventListener('keydown', handleKeyDown, { passive: false });
  canvas.addEventListener('pointerdown', () => canvas.focus());

  startNewGame();
}

/**
 * Creates the starting state and kicks off the render/update loop.
 */
function startNewGame() {
  if (animationId !== null) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }

  gameState = createInitialState();
  msPerTick = 1000 / BASE_SPEED;
  lastTickTime = 0;

  hideGameOver();
  updateScoreUI();
  renderGame();

  gameState.running = true;
  animationId = requestAnimationFrame(gameLoop);
  canvas.focus();
}

/**
 * Produces the default game state with a centered snake and random food.
 */
function createInitialState() {
  const startingSnake = createInitialSnake();

  return {
    snake: startingSnake,
    direction: KEY_TO_DIRECTION.ArrowRight,
    nextDirection: KEY_TO_DIRECTION.ArrowRight,
    food: spawnFood(startingSnake),
    score: 0,
    foodsEaten: 0,
    running: true,
  };
}

/**
 * Builds the starting snake body of length 3 pointing to the right.
 */
function createInitialSnake() {
  const originX = Math.floor(GRID_SIZE / 2);
  const originY = Math.floor(GRID_SIZE / 2);

  return [
    { x: originX, y: originY },
    { x: originX - 1, y: originY },
    { x: originX - 2, y: originY },
  ];
}

/**
 * Primary loop driven by requestAnimationFrame.
 */
function gameLoop(timestamp) {
  if (!gameState.running) {
    animationId = null;
    return;
  }

  if (timestamp - lastTickTime >= msPerTick) {
    updateGameState();
    renderGame();
    lastTickTime = timestamp;
  }

  animationId = requestAnimationFrame(gameLoop);
}

/**
 * Handles keyboard input and queues valid direction changes.
 */
function handleKeyDown(event) {
  const nextDirection = KEY_TO_DIRECTION[event.key];
  if (!nextDirection) {
    return;
  }

  event.preventDefault();
  if (!gameState.running) {
    return;
  }

  const currentDirection = gameState.direction;
  const plannedDirection = gameState.nextDirection;

  if (isOppositeDirection(nextDirection, currentDirection) || isOppositeDirection(nextDirection, plannedDirection)) {
    return;
  }

  gameState.nextDirection = nextDirection;
}

/**
 * Moves the snake forward, resolves collisions, and handles score updates.
 */
function updateGameState() {
  const head = gameState.snake[0];
  gameState.direction = gameState.nextDirection;

  const nextHead = {
    x: head.x + gameState.direction.x,
    y: head.y + gameState.direction.y,
  };

  const willGrow = nextHead.x === gameState.food.x && nextHead.y === gameState.food.y;
  const bodyLengthToCheck = willGrow ? gameState.snake.length : gameState.snake.length - 1;

  if (isOutOfBounds(nextHead) || hitsBody(nextHead, bodyLengthToCheck)) {
    endGame();
    return;
  }

  gameState.snake.unshift(nextHead);

  if (willGrow) {
    gameState.score += 1;
    gameState.foodsEaten += 1;
    gameState.food = spawnFood(gameState.snake);
    maybeIncreaseSpeed();
    updateScoreUI();
  } else {
    gameState.snake.pop();
  }
}

/**
 * Renders the board, snake, and food to the canvas.
 */
function renderGame() {
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawGrid();
  drawFood(gameState.food);
  drawSnake(gameState.snake);
}

/**
 * Draws soft grid lines to give the board structure.
 */
function drawGrid() {
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();

  for (let i = 1; i < GRID_SIZE; i += 1) {
    const position = i * CELL_SIZE;
    ctx.moveTo(position, 0);
    ctx.lineTo(position, canvas.height);
    ctx.moveTo(0, position);
    ctx.lineTo(canvas.width, position);
  }

  ctx.stroke();
}

/**
 * Draws the snake body, highlighting the head for clarity.
 */
function drawSnake(snake) {
  snake.forEach((part, index) => {
    ctx.fillStyle = index === 0 ? COLORS.snakeHead : COLORS.snake;
    const padding = 2;
    ctx.fillRect(
      part.x * CELL_SIZE + padding,
      part.y * CELL_SIZE + padding,
      CELL_SIZE - padding * 2,
      CELL_SIZE - padding * 2,
    );
  });
}

/**
 * Draws the food pellet.
 */
function drawFood(food) {
  const padding = 4;
  ctx.fillStyle = COLORS.food;
  ctx.fillRect(
    food.x * CELL_SIZE + padding,
    food.y * CELL_SIZE + padding,
    CELL_SIZE - padding * 2,
    CELL_SIZE - padding * 2,
  );
}

/**
 * Ends the current run and reveals the game-over overlay.
 */
function endGame() {
  gameState.running = false;
  finalScoreEl.textContent = gameState.score;

  if (gameState.score > bestScore) {
    bestScore = gameState.score;
    saveBestScore(bestScore);
  }

  updateScoreUI();
  finalBestScoreEl.textContent = bestScore;
  document.title = `Snake – Game Over (Score: ${gameState.score})`;
  showGameOver();
  restartButton.focus();
}

/**
 * Updates scoreboard values and live document title.
 */
function updateScoreUI() {
  scoreEl.textContent = gameState.score;
  bestScoreEl.textContent = bestScore;
  document.title = `Snake – Score: ${gameState.score}`;
}

function showGameOver() {
  overlayEl.classList.remove('hidden');
  overlayEl.setAttribute('aria-hidden', 'false');
}

function hideGameOver() {
  overlayEl.classList.add('hidden');
  overlayEl.setAttribute('aria-hidden', 'true');
}

function isOppositeDirection(dirA, dirB) {
  return dirA.x === -dirB.x && dirA.y === -dirB.y;
}

function isOutOfBounds(position) {
  return position.x < 0 || position.y < 0 || position.x >= GRID_SIZE || position.y >= GRID_SIZE;
}

function hitsBody(position, length) {
  for (let i = 0; i < length; i += 1) {
    const part = gameState.snake[i];
    if (part.x === position.x && part.y === position.y) {
      return true;
    }
  }
  return false;
}

function spawnFood(snake) {
  const emptyCells = [];

  for (let y = 0; y < GRID_SIZE; y += 1) {
    for (let x = 0; x < GRID_SIZE; x += 1) {
      if (!snake.some((segment) => segment.x === x && segment.y === y)) {
        emptyCells.push({ x, y });
      }
    }
  }

  if (emptyCells.length === 0) {
    return { x: 0, y: 0 };
  }

  const randomIndex = Math.floor(Math.random() * emptyCells.length);
  return emptyCells[randomIndex];
}

function maybeIncreaseSpeed() {
  const completedMilestones = Math.floor(gameState.foodsEaten / FOODS_PER_SPEEDUP);
  const additionalSpeed = completedMilestones * SPEED_INCREMENT;
  const nextTickRate = BASE_SPEED + additionalSpeed;
  msPerTick = 1000 / nextTickRate;
}

function loadBestScore() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? Number.parseInt(stored, 10) || 0 : 0;
  } catch (error) {
    return 0;
  }
}

function saveBestScore(score) {
  try {
    localStorage.setItem(STORAGE_KEY, String(score));
  } catch (error) {
    // ignore persistence errors
  }
}

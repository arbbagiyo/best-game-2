// The overlay screens: title, level select, pause, level complete and game
// complete. Each draw function paints its panel over the world; buttonsFor returns
// the clickable rects for the screen so the loop can hit-test pointer input.

import { FIELD, PALETTE } from './config.js';
import { LEVELS } from './levels.js';

function starPath(context, cx, cy, outer, inner) {
  context.beginPath();
  for (let index = 0; index < 10; index += 1) {
    const radius = index % 2 === 0 ? outer : inner;
    const angle = -Math.PI / 2 + (index * Math.PI) / 5;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
  context.closePath();
}

function drawStars(context, cx, cy, stars, size) {
  for (let index = 0; index < 3; index += 1) {
    const x = cx + (index - 1) * (size * 2.4);
    starPath(context, x, cy, size, size * 0.45);
    context.fillStyle = index < stars ? PALETTE.orb : 'rgba(255,255,255,0.14)';
    context.fill();
    context.strokeStyle = index < stars ? PALETTE.orbCore : 'rgba(255,255,255,0.25)';
    context.lineWidth = 2;
    context.stroke();
  }
}

function formatTime(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function button(renderer, rect, label, primary) {
  const context = renderer.context;
  context.fillStyle = primary ? PALETTE.anchor : PALETTE.panel;
  context.strokeStyle = primary ? PALETTE.anchorHot : PALETTE.panelEdge;
  context.lineWidth = 2;
  context.beginPath();
  context.roundRect(rect.x, rect.y, rect.w, rect.h, 14);
  context.fill();
  context.stroke();
  renderer.text(label, rect.x + rect.w / 2, rect.y + rect.h / 2 + 8, 24, primary ? '#04222b' : PALETTE.text, 'center', 800);
}

function dim(renderer, alpha) {
  const context = renderer.context;
  context.fillStyle = `rgba(2,9,13,${alpha})`;
  context.fillRect(0, 0, FIELD.width, FIELD.height);
}

export function drawTitle(renderer, data) {
  dim(renderer, 0.45);
  renderer.text('TETHERDEEP', FIELD.width / 2, 190, 92, PALETTE.text, 'center', 900);
  renderer.text('SWING THE SUNKEN GROTTOS', FIELD.width / 2, 232, 26, PALETTE.anchor, 'center', 700);
  renderer.text('Eight hand-built caverns. One rope. No way back but through.', FIELD.width / 2, 268, 20, PALETTE.muted, 'center', 400);
  const panelY = 310;
  renderer.panel(FIELD.width / 2 - 330, panelY, 660, 168, 18);
  const lines = [
    ['HOLD CLICK', 'grapple the glowing anchor near your aim'],
    ['RELEASE', 'let go and fly — SPACE leaps off the rope'],
    ['A / D', 'steer and pump the swing · W / S rope length'],
    ['R', 'restart the grotto · P pause · M sound'],
  ];
  lines.forEach(([key, meaning], index) => {
    const y = panelY + 42 + index * 34;
    renderer.text(key, FIELD.width / 2 - 300, y, 20, PALETTE.anchor, 'left', 800);
    renderer.text(meaning, FIELD.width / 2 - 130, y, 20, PALETTE.text, 'left', 400);
  });
  const totalStars = data.progress.stars.reduce((sum, value) => sum + value, 0);
  if (totalStars > 0) {
    renderer.text(`★ ${totalStars} / ${LEVELS.length * 3}  ·  ${data.progress.unlocked} of ${LEVELS.length} grottos open`, FIELD.width / 2, 522, 22, PALETTE.orb, 'center', 700);
  }
  button(renderer, { x: FIELD.width / 2 - 220, y: 552, w: 210, h: 58 }, '▶  START', true);
  button(renderer, { x: FIELD.width / 2 + 10, y: 552, w: 210, h: 58 }, 'GROTTOS', false);
  renderer.text('Click or press ENTER to start', FIELD.width / 2, 656, 19, PALETTE.muted, 'center', 400);
}

export function drawSelect(renderer, data) {
  dim(renderer, 0.55);
  renderer.text('CHOOSE A GROTTO', FIELD.width / 2, 108, 48, PALETTE.text, 'center', 900);
  const cols = 4;
  const cardW = 250;
  const cardH = 190;
  const gapX = 30;
  const gapY = 28;
  const totalW = cols * cardW + (cols - 1) * gapX;
  const startX = (FIELD.width - totalW) / 2;
  const startY = 150;
  LEVELS.forEach((level, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const x = startX + col * (cardW + gapX);
    const y = startY + row * (cardH + gapY);
    const unlocked = index < data.progress.unlocked;
    const stars = data.progress.stars[index] || 0;
    renderer.panel(x, y, cardW, cardH, 16);
    if (!unlocked) {
      renderer.text('🔒', x + cardW / 2, y + 84, 44, PALETTE.muted, 'center', 400);
      renderer.text('LOCKED', x + cardW / 2, y + 130, 20, PALETTE.muted, 'center', 700);
      renderer.text(level.name, x + cardW / 2, y + 162, 19, PALETTE.muted, 'center', 600);
      return;
    }
    renderer.text(String(index + 1), x + cardW / 2, y + 62, 44, PALETTE.anchor, 'center', 900);
    renderer.text(level.name, x + cardW / 2, y + 100, 22, PALETTE.text, 'center', 700);
    renderer.text(level.sub, x + cardW / 2, y + 128, 17, PALETTE.muted, 'center', 400);
    const context = renderer.context;
    const best = data.progress.best[index];
    drawStars(context, x + cardW / 2, y + 158, stars, 13);
    if (best) renderer.text(`best ${formatTime(best)}`, x + cardW / 2, y + 182, 15, PALETTE.muted, 'center', 400);
  });
  button(renderer, { x: FIELD.width / 2 - 105, y: 606, w: 210, h: 54 }, '←  BACK', false);
}

export function drawPaused(renderer, data) {
  dim(renderer, 0.6);
  renderer.panel(FIELD.width / 2 - 240, 210, 480, 300, 20);
  renderer.text('PAUSED', FIELD.width / 2, 278, 46, PALETTE.text, 'center', 900);
  renderer.text(`${data.levelIndex + 1} · ${LEVELS[data.levelIndex].name}`, FIELD.width / 2, 314, 20, PALETTE.muted, 'center', 600);
  button(renderer, { x: FIELD.width / 2 - 170, y: 340, w: 340, h: 52 }, 'RESUME', true);
  button(renderer, { x: FIELD.width / 2 - 170, y: 402, w: 340, h: 52 }, 'RESTART GROTTO', false);
  button(renderer, { x: FIELD.width / 2 - 170, y: 464, w: 340, h: 52 }, data.muted ? 'SOUND: OFF' : 'SOUND: ON', false);
}

export function drawComplete(renderer, data) {
  dim(renderer, 0.55);
  renderer.panel(FIELD.width / 2 - 300, 150, 600, 420, 22);
  renderer.text('GROTTO CLEAR!', FIELD.width / 2, 222, 50, PALETTE.text, 'center', 900);
  drawStars(renderer.context, FIELD.width / 2, 288, data.stats.stars, 30);
  const stats = [
    ['TIME', `${formatTime(data.stats.elapsed)}  (par ${formatTime(data.level.par)})`],
    ['ORBS', `${data.stats.orbs} / ${data.stats.orbTotal}`],
    ['FALLS', String(data.stats.deaths)],
  ];
  stats.forEach(([label, value], index) => {
    const y = 350 + index * 34;
    renderer.text(label, FIELD.width / 2 - 190, y, 22, PALETTE.muted, 'left', 700);
    renderer.text(value, FIELD.width / 2 + 190, y, 22, PALETTE.text, 'right', 700);
  });
  if (data.isLast) {
    button(renderer, { x: FIELD.width / 2 - 220, y: 472, w: 210, h: 56 }, 'FINISH ↺', true);
    button(renderer, { x: FIELD.width / 2 + 10, y: 472, w: 210, h: 56 }, 'GROTTOS', false);
  } else {
    button(renderer, { x: FIELD.width / 2 - 220, y: 472, w: 210, h: 56 }, 'NEXT ▶', true);
    button(renderer, { x: FIELD.width / 2 + 10, y: 472, w: 210, h: 56 }, 'RETRY', false);
  }
  renderer.text('Press R to retry · ENTER for next', FIELD.width / 2, 546, 18, PALETTE.muted, 'center', 400);
}

export function drawGameComplete(renderer, data) {
  dim(renderer, 0.6);
  renderer.panel(FIELD.width / 2 - 330, 140, 660, 440, 22);
  renderer.text('THE DEEP IS CROSSED', FIELD.width / 2, 214, 46, PALETTE.text, 'center', 900);
  renderer.text('Every grotto cleared. The rope holds. The way out glows gold.', FIELD.width / 2, 250, 20, PALETTE.muted, 'center', 400);
  drawStars(renderer.context, FIELD.width / 2, 312, data.averageStars >= 2.5 ? 3 : data.averageStars >= 1.5 ? 2 : 1, 30);
  const stats = [
    ['TOTAL STARS', `${data.totalStars} / ${LEVELS.length * 3}`],
    ['TOTAL TIME', formatTime(data.totalTime)],
    ['TOTAL FALLS', String(data.totalDeaths)],
  ];
  stats.forEach(([label, value], index) => {
    const y = 372 + index * 34;
    renderer.text(label, FIELD.width / 2 - 210, y, 22, PALETTE.muted, 'left', 700);
    renderer.text(value, FIELD.width / 2 + 210, y, 22, PALETTE.text, 'right', 700);
  });
  button(renderer, { x: FIELD.width / 2 - 220, y: 486, w: 210, h: 56 }, 'PLAY AGAIN', true);
  button(renderer, { x: FIELD.width / 2 + 10, y: 486, w: 210, h: 56 }, 'GROTTOS', false);
  renderer.text('Thank you for playing TETHERDEEP', FIELD.width / 2, 556, 18, PALETTE.muted, 'center', 400);
}

/** Clickable rects for the current screen, each with the action id main.js handles. */
export function buttonsFor(screen, data) {
  if (screen === 'title') {
    return [
      { id: 'start', x: FIELD.width / 2 - 220, y: 552, w: 210, h: 58 },
      { id: 'select', x: FIELD.width / 2 + 10, y: 552, w: 210, h: 58 },
    ];
  }
  if (screen === 'select') {
    const cols = 4;
    const cardW = 250;
    const cardH = 190;
    const gapX = 30;
    const gapY = 28;
    const totalW = cols * cardW + (cols - 1) * gapX;
    const startX = (FIELD.width - totalW) / 2;
    const startY = 150;
    const buttons = LEVELS.map((level, index) => ({
      id: `level:${index}`,
      x: startX + (index % cols) * (cardW + gapX),
      y: startY + Math.floor(index / cols) * (cardH + gapY),
      w: cardW,
      h: cardH,
      disabled: index >= data.progress.unlocked,
    }));
    buttons.push({ id: 'back', x: FIELD.width / 2 - 105, y: 606, w: 210, h: 54 });
    return buttons;
  }
  if (screen === 'paused') {
    return [
      { id: 'resume', x: FIELD.width / 2 - 170, y: 340, w: 340, h: 52 },
      { id: 'restart', x: FIELD.width / 2 - 170, y: 402, w: 340, h: 52 },
      { id: 'mute', x: FIELD.width / 2 - 170, y: 464, w: 340, h: 52 },
    ];
  }
  if (screen === 'complete') {
    return [
      { id: data.isLast ? 'finish' : 'next', x: FIELD.width / 2 - 220, y: 472, w: 210, h: 56 },
      { id: data.isLast ? 'select' : 'retry', x: FIELD.width / 2 + 10, y: 472, w: 210, h: 56 },
    ];
  }
  if (screen === 'gamecomplete') {
    return [
      { id: 'again', x: FIELD.width / 2 - 220, y: 486, w: 210, h: 56 },
      { id: 'select', x: FIELD.width / 2 + 10, y: 486, w: 210, h: 56 },
    ];
  }
  return [];
}

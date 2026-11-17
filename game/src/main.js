// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps, and the renderer paints what is there. The game moves between six
// screens: title, level select, play, paused, level complete and game complete.
//
// ?shot=title|play|swing|complete (with &seed=N) stages that scene instead of
// running the loop, paints it twice and sets window.__shotReady for a screenshot.
// The game itself is fully deterministic — the seed only varies nothing — so the
// scenes repeat exactly.

import { FIELD, SAVE_KEY, STEP } from './config.js';
import { LEVELS } from './levels.js';
import { createWorld, EVENT_ATTACH, EVENT_CHECKPOINT, EVENT_DEATH, EVENT_FINISH, EVENT_JUMP, EVENT_LAND, EVENT_ORB, EVENT_RELEASE } from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, ACTION_RESTART, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createParticles } from './particles.js';
import { pickAnchor } from './player.js';
import { createRenderer, HUD_BUTTONS, SCREEN_COMPLETE, SCREEN_GAMECOMPLETE, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_SELECT, SCREEN_TITLE } from './render.js';
import { buttonsFor, drawComplete, drawGameComplete, drawPaused, drawSelect, drawTitle } from './screens.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const INTRO_SECONDS = 3.2;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld();
const renderer = createRenderer(canvas);
const particles = createParticles();

function defaultProgress() {
  return {
    stars: LEVELS.map(() => 0),
    best: LEVELS.map(() => null),
    unlocked: 1,
    totalTime: 0,
    totalDeaths: 0,
    muted: false,
  };
}

function readProgress() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(SAVE_KEY) || 'null');
    if (!saved || !Array.isArray(saved.stars)) return defaultProgress();
    const progress = defaultProgress();
    progress.stars = LEVELS.map((level, index) => saved.stars[index] || 0);
    progress.best = LEVELS.map((level, index) => saved.best?.[index] ?? null);
    progress.unlocked = Math.max(1, Math.min(LEVELS.length, saved.unlocked || 1));
    progress.totalTime = saved.totalTime || 0;
    progress.totalDeaths = saved.totalDeaths || 0;
    progress.muted = Boolean(saved.muted);
    return progress;
  } catch {
    return defaultProgress();
  }
}

function saveProgress(progress) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(progress));
  } catch {
    // Storage can be off (private windows): progress then lasts this visit only.
  }
}

function hit(rect, point) {
  return point.x >= rect.x && point.x <= rect.x + rect.w && point.y >= rect.y && point.y <= rect.y + rect.h;
}

function runShot(name) {
  const scene = stageShot(name, world);
  const progress = readProgress();
  let painted = 0;
  function paint() {
    const extras = { particles, candidate: null, aimWorld: null, muted: false, intro: 0 };
    renderer.resize();
    renderer.drawWorld(world.state, extras);
    if (scene.screen === SCREEN_PLAY) renderer.drawHud(world.state, extras);
    else if (scene.screen === SCREEN_TITLE) drawTitle(renderer, { progress });
    else if (scene.screen === SCREEN_COMPLETE) {
      const state = world.state;
      drawComplete(renderer, {
        level: state.level,
        levelIndex: state.levelIndex,
        isLast: state.levelIndex === LEVELS.length - 1,
        stats: { stars: world.stars(), elapsed: state.finishElapsed, orbs: world.orbsTaken(), orbTotal: state.orbs.length, deaths: state.deaths },
      });
    }
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  const audio = createAudio();
  let progress = readProgress();
  let screen = SCREEN_TITLE;
  let intro = 0;
  let accumulator = 0;
  let last = performance.now();
  let lastStats = null;
  audio.setMuted(progress.muted);

  function announce(message) {
    status.textContent = message;
  }

  function startLevel(index) {
    world.loadLevel(index);
    particles.clear();
    intro = INTRO_SECONDS;
    screen = SCREEN_PLAY;
    announce(`Playing ${LEVELS[index].name}. ${LEVELS[index].hint}`);
  }

  function finishLevel() {
    const state = world.state;
    const stars = world.stars();
    lastStats = { stars, elapsed: state.finishElapsed, orbs: world.orbsTaken(), orbTotal: state.orbs.length, deaths: state.deaths };
    progress.stars[state.levelIndex] = Math.max(progress.stars[state.levelIndex], stars);
    const best = progress.best[state.levelIndex];
    progress.best[state.levelIndex] = best === null ? state.finishElapsed : Math.min(best, state.finishElapsed);
    progress.unlocked = Math.max(progress.unlocked, Math.min(LEVELS.length, state.levelIndex + 2));
    progress.totalTime += state.finishElapsed;
    progress.totalDeaths += state.deaths;
    saveProgress(progress);
    screen = SCREEN_COMPLETE;
    announce(`Grotto clear. ${stars} stars. Time ${Math.round(state.finishElapsed)} seconds.`);
  }

  function applyButton(id) {
    if (id === 'start') {
      const firstUnfinished = progress.stars.findIndex((stars) => stars === 0);
      startLevel(firstUnfinished === -1 ? 0 : firstUnfinished);
    } else if (id === 'select') {
      screen = SCREEN_SELECT;
    } else if (id === 'back') {
      screen = SCREEN_TITLE;
    } else if (id.startsWith('level:')) {
      const index = Number(id.slice('level:'.length));
      if (index < progress.unlocked) startLevel(index);
    } else if (id === 'resume') {
      screen = SCREEN_PLAY;
    } else if (id === 'restart') {
      startLevel(world.state.levelIndex);
    } else if (id === 'mute') {
      progress.muted = !progress.muted;
      audio.setMuted(progress.muted);
      saveProgress(progress);
    } else if (id === 'next') {
      startLevel(Math.min(LEVELS.length - 1, world.state.levelIndex + 1));
    } else if (id === 'retry') {
      startLevel(world.state.levelIndex);
    } else if (id === 'finish') {
      screen = SCREEN_GAMECOMPLETE;
    } else if (id === 'again') {
      startLevel(0);
    }
  }

  function handleClicks() {
    const clicks = input.takeClicks();
    if (clicks.length === 0) return null;
    audio.unlock();
    let attachAt = null;
    for (const click of clicks) {
      if (screen === SCREEN_PLAY) {
        if (hit(HUD_BUTTONS.mute, click)) {
          progress.muted = !progress.muted;
          audio.setMuted(progress.muted);
          saveProgress(progress);
          continue;
        }
        if (hit(HUD_BUTTONS.pause, click)) {
          screen = SCREEN_PAUSED;
          announce('Paused.');
          continue;
        }
        attachAt = { x: click.x + world.state.camera.x, y: click.y + world.state.camera.y };
        continue;
      }
      const data = { progress, levelIndex: world.state.levelIndex, isLast: world.state.levelIndex === LEVELS.length - 1, muted: progress.muted };
      const buttons = buttonsFor(screen, data);
      let handled = false;
      for (const rect of buttons) {
        if (!rect.disabled && hit(rect, click)) {
          audio.click();
          applyButton(rect.id);
          handled = true;
          break;
        }
      }
      if (!handled && screen === SCREEN_TITLE) startLevel(progress.stars.findIndex((stars) => stars === 0) === -1 ? 0 : progress.stars.findIndex((stars) => stars === 0));
      if (!handled && screen === SCREEN_COMPLETE) {
        if (world.state.levelIndex === LEVELS.length - 1) screen = SCREEN_GAMECOMPLETE;
        else startLevel(world.state.levelIndex + 1);
      }
    }
    return attachAt;
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      progress.muted = !progress.muted;
      audio.setMuted(progress.muted);
      saveProgress(progress);
    }
    if (actions & ACTION_RESTART && (screen === SCREEN_PLAY || screen === SCREEN_PAUSED || screen === SCREEN_COMPLETE)) {
      startLevel(world.state.levelIndex);
      return;
    }
    if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
      return;
    }
    if (actions & ACTION_CONFIRM) {
      audio.unlock();
      if (screen === SCREEN_TITLE) {
        const firstUnfinished = progress.stars.findIndex((stars) => stars === 0);
        startLevel(firstUnfinished === -1 ? 0 : firstUnfinished);
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
      } else if (screen === SCREEN_COMPLETE) {
        if (world.state.levelIndex === LEVELS.length - 1) screen = SCREEN_GAMECOMPLETE;
        else startLevel(world.state.levelIndex + 1);
      } else if (screen === SCREEN_GAMECOMPLETE) {
        startLevel(0);
      }
    }
  }

  function react(events, before) {
    const state = world.state;
    const diver = state.diver;
    if (events & EVENT_ORB) {
      audio.orb();
      particles.ring(diver.x, diver.y, { color: '#ffd34d' });
      particles.floatText(diver.x, diver.y - 30, `◆ ${world.orbsTaken()}/${state.orbs.length}`, '#ffd34d', 22);
    }
    if (events & EVENT_DEATH) {
      audio.death();
      particles.burst(before.x, before.y, { count: 26, speed: 320, color: '#ff6b4a', life: 0.8 });
      particles.floatText(before.x, before.y - 30, 'OUCH', '#ff5a5a', 24);
    }
    if (events & EVENT_CHECKPOINT) {
      audio.checkpoint();
      particles.ring(diver.x, diver.y, { color: '#7dff9a' });
      particles.floatText(diver.x, diver.y - 30, 'CHECKPOINT', '#7dff9a', 20);
    }
    if (events & EVENT_ATTACH) {
      audio.attach();
      if (diver.rope) {
        const at = world.anchorPositions()[diver.rope.index];
        particles.burst(at.x, at.y, { count: 10, speed: 140, color: '#35f0d0', life: 0.4, gravity: 0 });
      }
    }
    if (events & EVENT_RELEASE) audio.release();
    if (events & EVENT_JUMP) audio.jump();
    if (events & EVENT_LAND) {
      audio.land();
      particles.burst(diver.x, diver.y + 12, { count: 8, speed: 120, color: '#7fa5ae', life: 0.4, angle: -Math.PI / 2, spread: Math.PI });
    }
    if (events & EVENT_FINISH) {
      audio.win();
      particles.ring(state.level.exit.x + state.level.exit.w / 2, state.level.exit.y + state.level.exit.h / 2, { count: 40, speed: 380, color: '#ffcf5c', life: 0.8 });
      finishLevel();
    }
  }

  function stepWorld(frameInput) {
    const before = { x: world.state.diver.x, y: world.state.diver.y };
    const input = { ...frameInput };
    let events = 0;
    let stepped = false;
    while (accumulator >= STEP && screen === SCREEN_PLAY) {
      events |= world.step(STEP, input);
      accumulator -= STEP;
      stepped = true;
      // Edges belong to the first step of the frame only.
      input.jumpPressed = false;
      input.attachAt = null;
      input.release = false;
    }
    if (stepped) {
      react(events, before);
      particles.update(STEP);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    renderer.resize();
    const dt = Math.min((now - last) / 1000, MAX_FRAME);
    accumulator += dt;
    last = now;
    const attachAt = handleClicks();
    handleActions();
    audio.unlock();

    const pointer = input.pointer();
    const aimWorld = { x: pointer.x + world.state.camera.x, y: pointer.y + world.state.camera.y };
    const candidate = screen === SCREEN_PLAY && !world.state.diver.rope
      ? (pickAnchor(world.state.diver, world.state.level.anchors, world.state.elapsed, aimWorld)?.index ?? null)
      : null;

    if (screen === SCREEN_PLAY) {
      intro = Math.max(0, intro - dt);
      const frameInput = {
        move: input.move(),
        jumpHeld: input.jumpIsHeld(),
        jumpPressed: input.takeJumpPressed(),
        shorten: input.shortenHeld(),
        lengthen: input.lengthenHeld(),
        attachAt,
        release: input.takeReleased(),
        aim: aimWorld,
      };
      stepWorld(frameInput);
    } else {
      accumulator = 0;
      input.takeJumpPressed();
      input.takeReleased();
      if (screen === SCREEN_TITLE || screen === SCREEN_SELECT) {
        // The cave idles behind the menus: lava shimmers, crushers cycle.
        const idle = { move: 0, jumpHeld: false, jumpPressed: false, shorten: false, lengthen: false, attachAt: null, release: false, aim: null };
        world.step(STEP, idle);
        particles.update(STEP);
      }
    }

    const extras = { particles, candidate, aimWorld, muted: progress.muted, intro };
    renderer.drawWorld(world.state, extras);
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) renderer.drawHud(world.state, extras);
    if (screen === SCREEN_TITLE) drawTitle(renderer, { progress });
    else if (screen === SCREEN_SELECT) drawSelect(renderer, { progress });
    else if (screen === SCREEN_PAUSED) drawPaused(renderer, { levelIndex: world.state.levelIndex, muted: progress.muted });
    else if (screen === SCREEN_COMPLETE && lastStats) {
      drawComplete(renderer, {
        level: world.state.level,
        levelIndex: world.state.levelIndex,
        isLast: world.state.levelIndex === LEVELS.length - 1,
        stats: lastStats,
      });
    } else if (screen === SCREEN_GAMECOMPLETE) {
      const totalStars = progress.stars.reduce((sum, value) => sum + value, 0);
      drawGameComplete(renderer, {
        totalStars,
        totalTime: progress.totalTime,
        totalDeaths: progress.totalDeaths,
        averageStars: totalStars / LEVELS.length,
      });
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });
  window.addEventListener('resize', () => renderer.resize());

  announce('Tetherdeep. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();

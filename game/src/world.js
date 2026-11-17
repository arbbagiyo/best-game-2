// The game's rules and state, with no drawing and no browser in it: the level's
// platforms, anchors, orbs, hazards and exit, the timer, deaths, checkpoints and the
// camera. step() advances one fixed step and returns what happened as bit flags, so
// the caller can react (sounds, screens) without the world knowing about them.

import { FIELD, ORB, PLAYER } from './config.js';
import { LEVELS } from './levels.js';
import { createDiver, DIVER_ATTACHED, DIVER_JUMPED, DIVER_LANDED, DIVER_RELEASED, placeDiver, updateDiver } from './player.js';
import { anchorPosition, circleHitsRect, crusherRect, rectsOverlap } from './physics.js';

export const EVENT_ORB = 1;
export const EVENT_DEATH = 2;
export const EVENT_FINISH = 4;
export const EVENT_CHECKPOINT = 8;
export const EVENT_ATTACH = 16;
export const EVENT_RELEASE = 32;
export const EVENT_JUMP = 64;
export const EVENT_LAND = 128;

const SPAWN_GRACE = 0.9;
const CHECKPOINT_RADIUS = 70;

export function starsFor(level, orbsTaken, orbTotal, elapsed) {
  let stars = 1;
  if (orbsTaken >= orbTotal) stars += 1;
  if (elapsed <= level.par) stars += 1;
  return stars;
}

export function createWorld() {
  const diver = createDiver();
  const state = {
    levelIndex: 0,
    level: LEVELS[0],
    diver,
    orbs: [],
    elapsed: 0,
    deaths: 0,
    respawn: { x: 0, y: 0 },
    grace: 0,
    finished: false,
    finishElapsed: 0,
    camera: { x: 0, y: 0 },
    shake: 0,
    checkpointIndex: -1,
  };

  function loadLevel(index) {
    state.levelIndex = index;
    state.level = LEVELS[index];
    state.orbs = state.level.orbs.map((orb) => ({ x: orb.x, y: orb.y, taken: false }));
    state.elapsed = 0;
    state.deaths = 0;
    state.respawn = { x: state.level.start.x, y: state.level.start.y };
    state.grace = 0;
    state.finished = false;
    state.finishElapsed = 0;
    state.shake = 0;
    state.checkpointIndex = -1;
    placeDiver(diver, state.level.start.x, state.level.start.y);
    snapCamera();
  }

  function snapCamera() {
    const level = state.level;
    state.camera.x = clampCamera(diver.x - FIELD.width / 2, level.width, FIELD.width);
    state.camera.y = clampCamera(diver.y - FIELD.height / 2, level.height, FIELD.height);
  }

  function clampCamera(value, levelSize, viewSize) {
    if (levelSize <= viewSize) return (levelSize - viewSize) / 2;
    return Math.max(0, Math.min(levelSize - viewSize, value));
  }

  function respawn() {
    state.deaths += 1;
    state.shake = 14;
    placeDiver(diver, state.respawn.x, state.respawn.y);
    state.grace = SPAWN_GRACE;
  }

  function step(dt, input) {
    let events = 0;
    if (state.finished) return events;
    state.elapsed += dt;
    state.grace = Math.max(0, state.grace - dt);
    state.shake = Math.max(0, state.shake - dt * 30);

    const env = { solids: state.level.platforms, anchors: state.level.anchors, time: state.elapsed };
    const diverEvents = updateDiver(diver, input, dt, env);
    if (diverEvents & DIVER_JUMPED) events |= EVENT_JUMP;
    if (diverEvents & DIVER_LANDED) events |= EVENT_LAND;
    if (diverEvents & DIVER_ATTACHED) events |= EVENT_ATTACH;
    if (diverEvents & DIVER_RELEASED) events |= EVENT_RELEASE;

    // Orbs: a generous pickup circle, kept once taken even through deaths.
    for (const orb of state.orbs) {
      if (orb.taken) continue;
      if (Math.hypot(diver.x - orb.x, diver.y - orb.y) <= ORB.collectRadius) {
        orb.taken = true;
        events |= EVENT_ORB;
      }
    }

    // Checkpoints: drifting near one moves the respawn point forward.
    for (let index = 0; index < state.level.checkpoints.length; index += 1) {
      const point = state.level.checkpoints[index];
      if (index !== state.checkpointIndex && Math.hypot(diver.x - point.x, diver.y - point.y) <= CHECKPOINT_RADIUS) {
        state.checkpointIndex = index;
        state.respawn = { x: point.x, y: point.y };
        events |= EVENT_CHECKPOINT;
      }
    }

    // Hazards, once the spawn grace has run out.
    if (state.grace <= 0) {
      const box = { x: diver.x - PLAYER.radius, y: diver.y - PLAYER.radius, w: PLAYER.radius * 2, h: PLAYER.radius * 2 };
      let dead = false;
      for (const spike of state.level.spikes) {
        if (circleHitsRect(diver.x, diver.y, PLAYER.radius - 2, spike, 6)) dead = true;
      }
      for (const pool of state.level.lava) {
        if (circleHitsRect(diver.x, diver.y, PLAYER.radius - 2, pool, 4)) dead = true;
      }
      for (const crusher of state.level.crushers) {
        if (circleHitsRect(diver.x, diver.y, PLAYER.radius - 2, crusherRect(crusher, state.elapsed), 4)) dead = true;
      }
      if (diver.y - PLAYER.radius > state.level.height + 40) dead = true;
      if (dead) {
        respawn();
        events |= EVENT_DEATH;
      }
    }

    // The exit: touching the gold gate finishes the level.
    const exit = state.level.exit;
    const exitBox = { x: exit.x, y: exit.y, w: exit.w, h: exit.h };
    const diverBox = { x: diver.x - PLAYER.radius, y: diver.y - PLAYER.radius, w: PLAYER.radius * 2, h: PLAYER.radius * 2 };
    if (rectsOverlap(diverBox, exitBox)) {
      state.finished = true;
      state.finishElapsed = state.elapsed;
      events |= EVENT_FINISH;
    }

    // Camera: ease toward the diver, look a little ahead of the motion, stay in the level.
    // While the rope is held, the focus shifts a third of the way toward the anchor so
    // the anchor — the thing the swing hangs from — stays on screen.
    const level = state.level;
    let focusX = diver.x + diver.vx * 0.12;
    let focusY = diver.y + diver.vy * 0.06;
    if (diver.rope) {
      const anchor = anchorPosition(state.level.anchors[diver.rope.index], state.elapsed);
      focusX = diver.x * 0.65 + anchor.x * 0.35;
      focusY = diver.y * 0.65 + anchor.y * 0.35;
    }
    const targetX = clampCamera(focusX - FIELD.width / 2, level.width, FIELD.width);
    const targetY = clampCamera(focusY - FIELD.height / 2, level.height, FIELD.height);
    const ease = Math.min(1, dt * 5);
    state.camera.x += (targetX - state.camera.x) * ease;
    state.camera.y += (targetY - state.camera.y) * ease;

    return events;
  }

  function orbsTaken() {
    let count = 0;
    for (const orb of state.orbs) if (orb.taken) count += 1;
    return count;
  }

  function anchorPositions() {
    return state.level.anchors.map((anchor) => anchorPosition(anchor, state.elapsed));
  }

  loadLevel(0);

  return {
    state,
    loadLevel,
    step,
    orbsTaken,
    anchorPositions,
    stars() {
      return starsFor(state.level, orbsTaken(), state.orbs.length, state.finishElapsed || state.elapsed);
    },
  };
}

// The diver: run, jump, wall-slide, and the grapple swing. updateDiver takes the
// frame's input and the level's solids and anchors, and returns what happened as bit
// flags so the caller can play sounds without this file knowing about audio.

import { PHYSICS, PLAYER, ROPE } from './config.js';
import { anchorPosition, constrainRope, resolveBox } from './physics.js';

export const DIVER_JUMPED = 1;
export const DIVER_LANDED = 2;
export const DIVER_ATTACHED = 4;
export const DIVER_RELEASED = 8;
export const DIVER_WALLSLIDE = 16;

const TRAIL_LENGTH = 28;

export function createDiver() {
  return {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    grounded: false,
    coyote: 0,
    jumpBuffer: 0,
    wallDir: 0,
    wallSliding: false,
    rope: null,
    ropeTaut: false,
    facing: 1,
    squash: 0,
    trail: [],
  };
}

export function placeDiver(diver, x, y) {
  diver.x = x;
  diver.y = y;
  diver.vx = 0;
  diver.vy = 0;
  diver.grounded = false;
  diver.coyote = 0;
  diver.jumpBuffer = 0;
  diver.wallDir = 0;
  diver.wallSliding = false;
  diver.rope = null;
  diver.ropeTaut = false;
  diver.squash = 0;
  diver.trail.length = 0;
}

/** The anchor an attach at `point` would grab: near the point, in reach of the diver. */
export function pickAnchor(diver, anchors, time, point) {
  let best = null;
  let bestPointDist = Infinity;
  for (let index = 0; index < anchors.length; index += 1) {
    const at = anchorPosition(anchors[index], time);
    const reach = Math.hypot(at.x - diver.x, at.y - diver.y);
    if (reach > ROPE.maxRange) continue;
    const pointDist = Math.hypot(at.x - point.x, at.y - point.y);
    if (pointDist < bestPointDist) {
      bestPointDist = pointDist;
      best = { index, x: at.x, y: at.y, reach };
    }
  }
  if (best === null || bestPointDist > 170) return null;
  return best;
}

function boxOf(diver) {
  return { x: diver.x - PLAYER.radius, y: diver.y - PLAYER.radius, w: PLAYER.radius * 2, h: PLAYER.radius * 2 };
}

export function updateDiver(diver, input, dt, env) {
  let events = 0;
  const wasGrounded = diver.grounded;

  if (input.move !== 0) diver.facing = input.move;

  // --- Grapple attach / release (edges from the input layer) ---
  // wasAttached is the rope state at the START of the step: a fresh attach must not
  // be undone by the re-aim branch below in the same step.
  const wasAttached = diver.rope !== null;
  if (input.attachAt && !diver.rope) {
    const anchor = pickAnchor(diver, env.anchors, env.time, input.attachAt);
    if (anchor) {
      diver.rope = { index: anchor.index, length: Math.max(ROPE.minLength, anchor.reach) };
      events |= DIVER_ATTACHED;
    }
  }
  if (wasAttached && (input.release || input.attachAt)) {
    // A fresh click while attached re-aims: release first, the next click grabs anew.
    const speed = Math.hypot(diver.vx, diver.vy);
    if (speed > 1) {
      diver.vx += (diver.vx / speed) * ROPE.releaseBoost;
      diver.vy += (diver.vy / speed) * ROPE.releaseBoost;
    }
    diver.rope = null;
    diver.ropeTaut = false;
    events |= DIVER_RELEASED;
  }

  // --- Rope jump: SPACE while swinging leaps off the line ---
  if (wasAttached && diver.rope && input.jumpPressed) {
    const speed = Math.hypot(diver.vx, diver.vy);
    if (speed > 1) {
      diver.vx += (diver.vx / speed) * ROPE.releaseBoost;
      diver.vy += (diver.vy / speed) * ROPE.releaseBoost;
    }
    diver.vy -= 240;
    diver.rope = null;
    diver.ropeTaut = false;
    events |= DIVER_RELEASED | DIVER_JUMPED;
    input.jumpPressed = false;
  }

  // --- Timers ---
  diver.coyote = diver.grounded ? PLAYER.coyote : Math.max(0, diver.coyote - dt);
  diver.jumpBuffer = input.jumpPressed ? PLAYER.jumpBuffer : Math.max(0, diver.jumpBuffer - dt);
  diver.squash = Math.max(0, diver.squash - dt * 4);

  // --- Horizontal run ---
  // On the ground the diver runs at maxRun; in the air the cap is higher so swing
  // momentum is never clipped. Accel only pushes toward the cap — it never brakes
  // a faster landing, so momentum survives touching down.
  const accel = diver.grounded ? PLAYER.runAccel : PLAYER.airAccel;
  const cap = diver.grounded ? PLAYER.maxRun : PLAYER.maxRun * 1.6;
  if (input.move !== 0) {
    if (Math.sign(diver.vx) !== input.move || Math.abs(diver.vx) < cap) {
      diver.vx += input.move * accel * dt;
    }
  } else if (diver.grounded) {
    const stop = PHYSICS.groundFriction * dt;
    diver.vx = Math.abs(diver.vx) <= stop ? 0 : diver.vx - Math.sign(diver.vx) * stop;
  }

  // --- Jump: buffered, with coyote time and a wall jump ---
  if (diver.jumpBuffer > 0 && (diver.grounded || diver.coyote > 0)) {
    diver.vy = -PLAYER.jumpSpeed;
    diver.grounded = false;
    diver.coyote = 0;
    diver.jumpBuffer = 0;
    events |= DIVER_JUMPED;
  } else if (diver.jumpBuffer > 0 && diver.wallSliding) {
    diver.vx = -diver.wallDir * PLAYER.wallJumpX;
    diver.vy = -PLAYER.wallJumpY;
    diver.jumpBuffer = 0;
    diver.wallSliding = false;
    events |= DIVER_JUMPED;
  }
  // Releasing jump early cuts the rise: short hops and full leaps from one key.
  if (!input.jumpHeld && diver.vy < 0) diver.vy += PHYSICS.gravity * 1.7 * dt;

  // --- Gravity, drag, fall cap ---
  diver.vy += PHYSICS.gravity * dt;
  diver.vx -= diver.vx * PHYSICS.airDrag * dt;
  if (diver.vy > PLAYER.maxFall) diver.vy = PLAYER.maxFall;

  // --- Rope: pump, shorten, lengthen, then the constraint ---
  if (diver.rope) {
    const anchor = anchorPosition(env.anchors[diver.rope.index], env.time);
    if (input.move !== 0) {
      // Push along the tangent, in the direction the player steers.
      const dx = diver.x - anchor.x;
      const dy = diver.y - anchor.y;
      const dist = Math.hypot(dx, dy) || 1;
      const tx = -dy / dist;
      const ty = dx / dist;
      const sign = Math.sign(input.move * tx) || 1;
      diver.vx += tx * sign * ROPE.pumpAccel * dt;
      diver.vy += ty * sign * ROPE.pumpAccel * dt;
    }
    if (input.shorten) diver.rope.length = Math.max(ROPE.minLength, diver.rope.length - ROPE.shortenRate * dt);
    if (input.lengthen) diver.rope.length = Math.min(ROPE.maxRange, diver.rope.length + ROPE.lengthenRate * dt);
  }

  // A hard ceiling on horizontal speed: the pump must not stack velocity past it.
  diver.vx = Math.max(-PLAYER.maxRun * 1.6, Math.min(PLAYER.maxRun * 1.6, diver.vx));

  // --- Integrate and collide, axis by axis ---
  const box = boxOf(diver);
  box.x += diver.vx * dt;
  const hitX = resolveBox(box, env.solids);
  if (hitX.hitWall !== 0) {
    diver.wallDir = hitX.hitWall;
    diver.vx = 0;
  } else {
    diver.wallDir = 0;
  }
  box.y += diver.vy * dt;
  const hitY = resolveBox(box, env.solids);
  if (hitY.hitGround) {
    if (diver.vy > 420) diver.squash = 1;
    diver.vy = 0;
  } else if (hitY.hitCeiling && diver.vy < 0) {
    diver.vy = 0;
  }
  diver.x = box.x + PLAYER.radius;
  diver.y = box.y + PLAYER.radius;
  diver.grounded = hitY.hitGround;

  // --- Wall slide: pressing into a wall while falling slows the fall ---
  diver.wallSliding = false;
  if (!diver.grounded && diver.wallDir !== 0 && input.move === diver.wallDir && diver.vy > 0) {
    if (diver.vy > PLAYER.wallSlideCap) diver.vy = PLAYER.wallSlideCap;
    diver.wallSliding = true;
    events |= DIVER_WALLSLIDE;
  }

  // --- Rope constraint, after the move ---
  if (diver.rope) {
    const anchor = anchorPosition(env.anchors[diver.rope.index], env.time);
    diver.ropeTaut = constrainRope(diver, anchor, diver.rope.length);
    // Keep the diver out of rock after the rope pulls it.
    const fixed = boxOf(diver);
    resolveBox(fixed, env.solids);
    diver.x = fixed.x + PLAYER.radius;
    diver.y = fixed.y + PLAYER.radius;
  } else {
    diver.ropeTaut = false;
  }

  if (!wasGrounded && diver.grounded && (events & DIVER_JUMPED) === 0) events |= DIVER_LANDED;

  // --- Trail for the renderer ---
  diver.trail.push({ x: diver.x, y: diver.y });
  if (diver.trail.length > TRAIL_LENGTH) diver.trail.shift();

  return events;
}

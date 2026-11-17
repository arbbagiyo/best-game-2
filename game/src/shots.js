// The screenshot scenes behind ?shot=title|play|swing|complete. Each one plays the
// real rules forward from a fresh level with a scripted input — attach, pump,
// release, walk — so the frame is what a short game really looks like, and the same
// script always gives the same frame. runScript is exported so the scenes can be
// tuned headlessly in Node before they are ever photographed.

import { STEP } from './config.js';
import { SCREEN_COMPLETE, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

function blankInput() {
  return { move: 0, jumpHeld: false, jumpPressed: false, shorten: false, lengthen: false, attachAt: null, release: false, aim: null };
}

/**
 * Play `segments` against the world. A segment is { steps, input } where input may
 * name `attach` (an anchor index, resolved to its live position) — edges fire on
 * the segment's first step only, exactly as a human press would.
 */
export function runScript(world, segments) {
  let events = 0;
  for (const segment of segments) {
    for (let index = 0; index < segment.steps; index += 1) {
      const input = blankInput();
      Object.assign(input, segment.input);
      if (index > 0) {
        input.attachAt = null;
        input.release = false;
        input.jumpPressed = false;
      }
      if (index === 0 && segment.input.attach !== undefined && segment.input.attach !== null) {
        const positions = world.anchorPositions();
        const at = positions[segment.input.attach];
        input.attachAt = { x: at.x, y: at.y };
      }
      events |= world.step(STEP, input);
      if (world.state.finished) return events;
    }
  }
  return events;
}

const IDLE = { steps: 24, input: {} };

const PLAY_SCRIPT = [
  IDLE,
  { steps: 1, input: { attach: 0 } },
  { steps: 62, input: { move: 1 } },
];

const SWING_SCRIPT = [
  IDLE,
  { steps: 1, input: { attach: 0 } },
  { steps: 48, input: { move: 1 } },
  { steps: 1, input: { release: true, move: 1 } },
  { steps: 22, input: { move: 1 } },
  { steps: 1, input: { attach: 2 } },
  { steps: 46, input: { move: 1 } },
];

const COMPLETE_SCRIPT = [
  IDLE,
  { steps: 1, input: { attach: 0 } },
  { steps: 66, input: { move: 1 } },
  { steps: 1, input: { release: true, move: 1 } },
  { steps: 6, input: { move: 1 } },
  { steps: 1, input: { attach: 1 } },
  { steps: 54, input: { move: 1 } },
  { steps: 1, input: { release: true, move: 1 } },
  { steps: 6, input: { move: 1 } },
  { steps: 1, input: { attach: 2 } },
  { steps: 54, input: { move: 1 } },
  { steps: 1, input: { release: true, move: 1 } },
  { steps: 6, input: { move: 1 } },
  { steps: 1, input: { attach: 3 } },
  { steps: 54, input: { move: 1 } },
  { steps: 1, input: { release: true, move: 1 } },
  { steps: 6, input: { move: 1 } },
  { steps: 1, input: { attach: 4 } },
  { steps: 40, input: { move: 1 } },
  { steps: 1, input: { release: true, move: 1 } },
  { steps: 60, input: {} },
  { steps: 60, input: { move: 1 } },
];

export const SHOT_SCRIPTS = {
  play: PLAY_SCRIPT,
  swing: SWING_SCRIPT,
  complete: COMPLETE_SCRIPT,
};

/**
 * Set `world` to the named scene and return the screen to draw over it. Any
 * unknown name stages the title.
 */
export function stageShot(name, world) {
  if (name === 'play') {
    world.loadLevel(0);
    runScript(world, PLAY_SCRIPT);
    return { screen: SCREEN_PLAY, intro: 0 };
  }
  if (name === 'swing') {
    world.loadLevel(4);
    runScript(world, SWING_SCRIPT);
    return { screen: SCREEN_PLAY, intro: 0 };
  }
  if (name === 'complete') {
    world.loadLevel(0);
    runScript(world, COMPLETE_SCRIPT);
    return { screen: SCREEN_COMPLETE, intro: 0 };
  }
  world.loadLevel(0);
  runScript(world, [{ steps: 150, input: {} }]);
  return { screen: SCREEN_TITLE, intro: 0 };
}

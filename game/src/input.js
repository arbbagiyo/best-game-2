// Keyboard and pointer input. Held keys steer; one-shot presses (confirm, pause,
// restart, mute) queue as bit flags and are taken once by the loop. Pointer presses
// queue as clicks in logical field coordinates; the loop decides whether a click hit
// a button or means "grapple here". Edges are consumed by the first simulation step
// of the frame, so a press is never counted twice.

import { FIELD } from './config.js';

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_RESTART = 4;
export const ACTION_MUTE = 8;

const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const SHORTEN = new Set(['KeyW', 'ArrowUp']);
const LENGTHEN = new Set(['KeyS', 'ArrowDown']);
const JUMP = new Set(['Space']);
const CONFIRM = new Set(['Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const RESTART = new Set(['KeyR']);
const MUTE = new Set(['KeyM']);

export function createInput(canvas) {
  let left = false;
  let right = false;
  let shorten = false;
  let lengthen = false;
  let jumpHeld = false;
  let jumpPressed = false;
  let actions = 0;
  let pointerHeld = false;
  let released = false;
  let pointerX = FIELD.width / 2;
  let pointerY = FIELD.height / 2;
  const clicks = [];

  function toField(clientX, clientY) {
    const scale = Math.min(window.innerWidth / FIELD.width, window.innerHeight / FIELD.height);
    const ox = (window.innerWidth - FIELD.width * scale) / 2;
    const oy = (window.innerHeight - FIELD.height * scale) / 2;
    return { x: (clientX - ox) / scale, y: (clientY - oy) / scale };
  }

  window.addEventListener('keydown', (event) => {
    if (LEFT.has(event.code)) left = true;
    else if (RIGHT.has(event.code)) right = true;
    else if (SHORTEN.has(event.code)) shorten = true;
    else if (LENGTHEN.has(event.code)) lengthen = true;
    else if (JUMP.has(event.code)) {
      jumpHeld = true;
      if (!event.repeat) {
        jumpPressed = true;
        actions |= ACTION_CONFIRM;
      }
    } else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (RESTART.has(event.code)) {
      if (!event.repeat) actions |= ACTION_RESTART;
    } else if (MUTE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (LEFT.has(event.code)) left = false;
    else if (RIGHT.has(event.code)) right = false;
    else if (SHORTEN.has(event.code)) shorten = false;
    else if (LENGTHEN.has(event.code)) lengthen = false;
    else if (JUMP.has(event.code)) jumpHeld = false;
  });
  window.addEventListener('blur', () => {
    left = false;
    right = false;
    shorten = false;
    lengthen = false;
    jumpHeld = false;
    pointerHeld = false;
  });
  canvas.addEventListener('pointermove', (event) => {
    const at = toField(event.clientX, event.clientY);
    pointerX = at.x;
    pointerY = at.y;
  });
  canvas.addEventListener('pointerdown', (event) => {
    const at = toField(event.clientX, event.clientY);
    pointerX = at.x;
    pointerY = at.y;
    if (event.button === 0) {
      pointerHeld = true;
      clicks.push({ x: at.x, y: at.y });
    } else {
      released = true;
    }
    event.preventDefault();
  });
  window.addEventListener('pointerup', (event) => {
    if (event.button === 0 && pointerHeld) {
      pointerHeld = false;
      released = true;
    }
  });
  window.addEventListener('pointercancel', () => {
    if (pointerHeld) {
      pointerHeld = false;
      released = true;
    }
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    /** -1 for left, 1 for right, 0 for neither or both. */
    move() {
      return (right ? 1 : 0) - (left ? 1 : 0);
    },
    shortenHeld() {
      return shorten;
    },
    lengthenHeld() {
      return lengthen;
    },
    jumpIsHeld() {
      return jumpHeld;
    },
    /** The jump edge since the last call; reading it clears it. */
    takeJumpPressed() {
      const taken = jumpPressed;
      jumpPressed = false;
      return taken;
    },
    /** The release edge since the last call; reading it clears it. */
    takeReleased() {
      const taken = released;
      released = false;
      return taken;
    },
    pointerIsHeld() {
      return pointerHeld;
    },
    /** Pointer position in logical field coordinates. */
    pointer() {
      return { x: pointerX, y: pointerY };
    },
    /** Clicks since the last call, in logical field coordinates. */
    takeClicks() {
      return clicks.splice(0, clicks.length);
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}

// Every tuning number and colour in one place. The playfield is a fixed 1280x720 logical
// area; the renderer scales it to the window and the camera scrolls the level beneath it,
// so no rule below depends on the screen size. TETHERDEEP: swing the sunken grottos.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 13,
  runAccel: 2800,
  airAccel: 1900,
  maxRun: 330,
  jumpSpeed: 620,
  coyote: 0.09,
  jumpBuffer: 0.12,
  wallSlideCap: 150,
  wallJumpX: 340,
  wallJumpY: 580,
  maxFall: 920,
};

export const PHYSICS = {
  gravity: 1500,
  groundFriction: 2400,
  airDrag: 0.12,
};

export const ROPE = {
  maxRange: 580,
  minLength: 70,
  shortenRate: 220,
  lengthenRate: 220,
  pumpAccel: 1150,
  releaseBoost: 160,
  aimSnap: 70,
};

export const ORB = { radius: 13, collectRadius: 32 };

/** Where progress is kept between visits (this browser only). */
export const SAVE_KEY = 'tetherdeep.progress.v1';

export const PALETTE = {
  backdrop: '#02090d',
  caveFar: '#06222b',
  caveNear: '#0a2e3a',
  rock: '#0d3542',
  rockRim: '#1f6b7a',
  rockMoss: '#14524a',
  anchor: '#35f0d0',
  anchorHot: '#8affef',
  anchorMove: '#f04fc8',
  rope: '#aef7e6',
  orb: '#ffd34d',
  orbCore: '#fff3c4',
  exit: '#ffcf5c',
  exitRing: '#ffe9a8',
  player: '#eaf7ff',
  playerSuit: '#ff6b4a',
  playerVisor: '#16323e',
  spike: '#c8d8de',
  lava: '#ff5a2a',
  lavaGlow: '#ffb03a',
  crusher: '#274b5a',
  crusherTeeth: '#9fb8c2',
  checkpoint: '#7dff9a',
  text: '#eef7f4',
  muted: '#7fa5ae',
  panel: '#082730',
  panelEdge: '#1f6b7a',
  danger: '#ff5a5a',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

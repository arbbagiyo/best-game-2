// Drawing only: the world's state in, pixels out. The 1280x720 playfield is scaled
// to fit the window and centred; the camera scrolls the level beneath it. The cave is
// layered silhouettes and procedural glow — no image files anywhere.

import { FIELD, FONT, ORB, PALETTE, PLAYER, ROPE } from './config.js';
import { createRandom, range, seedFromText } from './rng.js';
import { anchorPosition, crusherRect } from './physics.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_SELECT = 'select';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_COMPLETE = 'complete';
export const SCREEN_GAMEOVER = 'gameover';
export const SCREEN_GAMECOMPLETE = 'gamecomplete';

/** HUD buttons, in logical field coordinates; main.js hit-tests these same rects. */
export const HUD_BUTTONS = {
  mute: { x: 1170, y: 12, w: 46, h: 46 },
  pause: { x: 1222, y: 12, w: 46, h: 46 },
};

function formatTime(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${rest < 10 ? '0' : ''}${rest}`;
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const fonts = new Map();
  const decorCache = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  function font(size, weight = 400) {
    const key = `${weight}/${size}`;
    if (!fonts.has(key)) fonts.set(key, `${weight} ${size}px ${FONT}`);
    return fonts.get(key);
  }

  function text(value, x, y, size, color, align = 'left', weight = 400) {
    context.font = font(size, weight);
    context.fillStyle = color;
    context.textAlign = align;
    context.textBaseline = 'alphabetic';
    context.fillText(value, x, y);
  }

  function panel(x, y, w, h, radius = 18) {
    context.fillStyle = PALETTE.panel;
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 2;
    context.beginPath();
    context.roundRect(x, y, w, h, radius);
    context.fill();
    context.stroke();
  }

  /** Seeded dressing per level: stalactites, crystals and rock teeth, two depths. */
  function decorFor(level, index) {
    if (decorCache.has(index)) return decorCache.get(index);
    const random = createRandom(seedFromText(level.name));
    const far = [];
    const near = [];
    for (let x = -100; x < level.width + 100; x += 90) {
      if (random() < 0.75) far.push({ x: x + range(random, -30, 30), y: -20, w: range(random, 40, 110), h: range(random, 90, 260), top: true });
      if (random() < 0.6) far.push({ x: x + range(random, -30, 30), y: level.height + 20, w: range(random, 40, 100), h: range(random, 80, 220), top: false });
    }
    for (let x = 0; x < level.width; x += 150) {
      if (random() < 0.8) near.push({ x: x + range(random, -50, 50), y: range(random, 60, level.height - 120), w: range(random, 30, 80), h: range(random, 60, 190), top: random() < 0.5 });
      if (random() < 0.7) near.push({ x: x + range(random, -40, 40), y: range(random, 80, level.height - 80), crystal: true, size: range(random, 3, 7), hue: random() });
    }
    const decor = { far, near };
    decorCache.set(index, decor);
    return decor;
  }

  function drawBackdrop(state, time) {
    const gradient = context.createLinearGradient(0, 0, 0, FIELD.height);
    gradient.addColorStop(0, '#03141c');
    gradient.addColorStop(0.55, PALETTE.caveFar);
    gradient.addColorStop(1, '#04181f');
    context.fillStyle = gradient;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    const decor = decorFor(state.level, state.levelIndex);
    const camera = state.camera;
    context.fillStyle = '#07232d';
    for (const tooth of decor.far) {
      const sx = tooth.x - camera.x * 0.3;
      if (sx < -160 || sx > FIELD.width + 160) continue;
      const sy = tooth.top ? tooth.y - camera.y * 0.3 : tooth.y - camera.y * 0.3;
      drawTooth(sx, sy, tooth.w, tooth.h, tooth.top);
    }
    context.fillStyle = PALETTE.caveNear;
    for (const tooth of decor.near) {
      if (tooth.crystal) continue;
      const sx = tooth.x - camera.x * 0.6;
      if (sx < -140 || sx > FIELD.width + 140) continue;
      const sy = tooth.y - camera.y * 0.6;
      drawTooth(sx, sy, tooth.w, tooth.h, tooth.top);
    }
    for (const spark of decor.near) {
      if (!spark.crystal) continue;
      const sx = spark.x - camera.x * 0.6;
      const sy = spark.y - camera.y * 0.6;
      if (sx < -20 || sx > FIELD.width + 20 || sy < -20 || sy > FIELD.height + 20) continue;
      const twinkle = 0.45 + 0.4 * Math.sin(time * 1.7 + spark.x * 0.05);
      context.globalAlpha = twinkle;
      context.fillStyle = spark.hue < 0.5 ? PALETTE.anchor : PALETTE.anchorMove;
      context.beginPath();
      context.arc(sx, sy, spark.size, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
  }

  function drawTooth(x, y, w, h, top) {
    context.beginPath();
    if (top) {
      context.moveTo(x - w / 2, y);
      context.lineTo(x + w / 2, y);
      context.lineTo(x + w * 0.08, y + h);
      context.closePath();
    } else {
      context.moveTo(x - w / 2, y);
      context.lineTo(x + w / 2, y);
      context.lineTo(x - w * 0.08, y - h);
      context.closePath();
    }
    context.fill();
  }

  function drawPlatforms(state) {
    for (const platform of state.level.platforms) {
      const x = platform.x - state.camera.x;
      const y = platform.y - state.camera.y;
      if (x > FIELD.width || x + platform.w < 0 || y > FIELD.height || y + platform.h < 0) continue;
      context.fillStyle = PALETTE.rock;
      context.fillRect(x, y, platform.w, platform.h);
      context.fillStyle = PALETTE.rockRim;
      context.fillRect(x, y, platform.w, 5);
      context.fillStyle = 'rgba(255,255,255,0.06)';
      context.fillRect(x, y + 5, platform.w, 3);
      if (platform.moss) {
        context.fillStyle = PALETTE.rockMoss;
        for (let mx = x + 8; mx < x + platform.w - 6; mx += 26) {
          context.beginPath();
          context.arc(mx, y + 2, 7, Math.PI, 0);
          context.fill();
        }
      }
      context.fillStyle = 'rgba(0,0,0,0.25)';
      context.fillRect(x, y + platform.h - 6, platform.w, 6);
    }
  }

  function drawLava(state, time) {
    for (const pool of state.level.lava) {
      const x = pool.x - state.camera.x;
      const y = pool.y - state.camera.y;
      if (x > FIELD.width || x + pool.w < 0 || y > FIELD.height || y + pool.h < 0) continue;
      const glow = context.createLinearGradient(0, y - 26, 0, y + pool.h);
      glow.addColorStop(0, 'rgba(255,90,42,0)');
      glow.addColorStop(0.5, 'rgba(255,90,42,0.35)');
      glow.addColorStop(1, 'rgba(255,176,58,0.55)');
      context.fillStyle = glow;
      context.fillRect(x, y - 26, pool.w, pool.h + 26);
      context.fillStyle = PALETTE.lava;
      context.beginPath();
      context.moveTo(x, y + pool.h);
      context.lineTo(x, y + 6);
      for (let wx = 0; wx <= pool.w; wx += 24) {
        context.lineTo(x + wx, y + 6 + Math.sin(time * 2.4 + (pool.x + wx) * 0.03) * 4);
      }
      context.lineTo(x + pool.w, y + pool.h);
      context.closePath();
      context.fill();
      context.fillStyle = PALETTE.lavaGlow;
      for (let wx = 12; wx < pool.w; wx += 48) {
        const bob = Math.sin(time * 3 + wx * 0.11) * 3;
        context.beginPath();
        context.arc(x + wx, y + 14 + bob, 4, 0, Math.PI * 2);
        context.fill();
      }
    }
  }

  function drawSpikes(state) {
    context.fillStyle = PALETTE.spike;
    for (const spike of state.level.spikes) {
      const x = spike.x - state.camera.x;
      const y = spike.y - state.camera.y;
      if (spike.dir === 'up' || spike.dir === 'down') {
        const teeth = Math.max(2, Math.round(spike.w / 22));
        const step = spike.w / teeth;
        for (let index = 0; index < teeth; index += 1) {
          const tx = x + index * step;
          context.beginPath();
          if (spike.dir === 'up') {
            context.moveTo(tx, y + spike.h);
            context.lineTo(tx + step / 2, y);
            context.lineTo(tx + step, y + spike.h);
          } else {
            context.moveTo(tx, y);
            context.lineTo(tx + step / 2, y + spike.h);
            context.lineTo(tx + step, y);
          }
          context.closePath();
          context.fill();
        }
      } else {
        // Wall spikes: teeth stacked along the height, pointing sideways.
        const teeth = Math.max(2, Math.round(spike.h / 22));
        const step = spike.h / teeth;
        for (let index = 0; index < teeth; index += 1) {
          const ty = y + index * step;
          context.beginPath();
          if (spike.dir === 'right') {
            context.moveTo(x, ty);
            context.lineTo(x + spike.w, ty + step / 2);
            context.lineTo(x, ty + step);
          } else {
            context.moveTo(x + spike.w, ty);
            context.lineTo(x, ty + step / 2);
            context.lineTo(x + spike.w, ty + step);
          }
          context.closePath();
          context.fill();
        }
      }
    }
  }

  function drawCrushers(state) {
    for (const crusher of state.level.crushers) {
      const rect = crusherRect(crusher, state.elapsed);
      const x = rect.x - state.camera.x;
      const y = rect.y - state.camera.y;
      context.fillStyle = PALETTE.crusher;
      context.fillRect(x, y, rect.w, rect.h);
      context.fillStyle = PALETTE.crusherTeeth;
      const teeth = Math.max(2, Math.floor(rect.w / 24));
      for (let index = 0; index < teeth; index += 1) {
        const tx = x + (index + 0.5) * (rect.w / teeth);
        context.beginPath();
        context.moveTo(tx - 9, y + rect.h);
        context.lineTo(tx, y + rect.h + 14);
        context.lineTo(tx + 9, y + rect.h);
        context.closePath();
        context.fill();
      }
      context.fillStyle = 'rgba(255,255,255,0.1)';
      context.fillRect(x, y, rect.w, 4);
      context.strokeStyle = 'rgba(160,190,200,0.4)';
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(x + rect.w / 2, y);
      context.lineTo(x + rect.w / 2, y - 60);
      context.stroke();
    }
  }

  function drawAnchors(state, time, candidate) {
    const positions = state.level.anchors.map((anchor) => anchorPosition(anchor, state.elapsed));
    for (let index = 0; index < positions.length; index += 1) {
      const anchor = state.level.anchors[index];
      const at = positions[index];
      const x = at.x - state.camera.x;
      const y = at.y - state.camera.y;
      const moving = Boolean(anchor.period);
      const color = moving ? PALETTE.anchorMove : PALETTE.anchor;
      const pulse = 1 + 0.12 * Math.sin(time * 3 + index * 1.3);
      const size = (moving ? 19 : 17) * pulse;
      const isCandidate = candidate === index;
      // Two halo layers so the anchor glows against the dark rock.
      context.globalAlpha = 0.16 + (isCandidate ? 0.15 : 0);
      context.fillStyle = color;
      context.beginPath();
      context.arc(x, y, size * 3, 0, Math.PI * 2);
      context.fill();
      context.globalAlpha = 0.3 + (isCandidate ? 0.2 : 0);
      context.beginPath();
      context.arc(x, y, size * 1.8, 0, Math.PI * 2);
      context.fill();
      context.globalAlpha = 1;
      // A bright pulsing ring, then the diamond with a white-hot core.
      context.strokeStyle = color;
      context.lineWidth = 2.5;
      context.beginPath();
      context.arc(x, y, size * 1.25, 0, Math.PI * 2);
      context.stroke();
      context.save();
      context.translate(x, y);
      context.rotate(Math.PI / 4);
      context.fillStyle = color;
      context.fillRect(-size / 2, -size / 2, size, size);
      context.fillStyle = '#ffffff';
      context.fillRect(-size / 4, -size / 4, size / 2, size / 2);
      context.restore();
      if (isCandidate) {
        context.strokeStyle = PALETTE.anchorHot;
        context.lineWidth = 3;
        context.beginPath();
        context.arc(x, y, size * 1.9, 0, Math.PI * 2);
        context.stroke();
      }
    }
    return positions;
  }

  function drawOrbs(state, time) {
    for (const orb of state.orbs) {
      if (orb.taken) continue;
      const x = orb.x - state.camera.x;
      const y = orb.y - state.camera.y + Math.sin(time * 2 + orb.x * 0.02) * 4;
      const pulse = 1 + 0.1 * Math.sin(time * 4 + orb.y);
      context.globalAlpha = 0.25;
      context.fillStyle = PALETTE.orb;
      context.beginPath();
      context.arc(x, y, ORB.radius * 2.2 * pulse, 0, Math.PI * 2);
      context.fill();
      context.globalAlpha = 1;
      context.fillStyle = PALETTE.orb;
      context.beginPath();
      context.arc(x, y, ORB.radius * pulse, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.orbCore;
      context.beginPath();
      context.arc(x - 3, y - 3, ORB.radius * 0.45, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawExit(state, time) {
    const exit = state.level.exit;
    const x = exit.x - state.camera.x;
    const y = exit.y - state.camera.y;
    const cx = x + exit.w / 2;
    const cy = y + exit.h / 2;
    const pulse = 1 + 0.06 * Math.sin(time * 2.2);
    context.globalAlpha = 0.3;
    context.fillStyle = PALETTE.exit;
    context.beginPath();
    context.ellipse(cx, cy, exit.w * 0.9 * pulse, exit.h * 0.62 * pulse, 0, 0, Math.PI * 2);
    context.fill();
    context.globalAlpha = 1;
    context.strokeStyle = PALETTE.exitRing;
    context.lineWidth = 5;
    context.beginPath();
    context.ellipse(cx, cy, exit.w * 0.42, exit.h * 0.46, 0, 0, Math.PI * 2);
    context.stroke();
    context.strokeStyle = PALETTE.exit;
    context.lineWidth = 2;
    context.beginPath();
    context.ellipse(cx, cy, exit.w * 0.3, exit.h * 0.34, 0, 0, Math.PI * 2);
    context.stroke();
    text('EXIT', cx, y - 12, 20, PALETTE.exit, 'center', 700);
  }

  function drawCheckpoints(state) {
    for (let index = 0; index < state.level.checkpoints.length; index += 1) {
      const point = state.level.checkpoints[index];
      const x = point.x - state.camera.x;
      const y = point.y - state.camera.y;
      const reached = index === state.checkpointIndex;
      context.strokeStyle = reached ? PALETTE.checkpoint : PALETTE.muted;
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(x, y + 26);
      context.lineTo(x, y - 26);
      context.stroke();
      context.fillStyle = reached ? PALETTE.checkpoint : PALETTE.muted;
      context.beginPath();
      context.moveTo(x, y - 26);
      context.lineTo(x + 24, y - 18);
      context.lineTo(x, y - 10);
      context.closePath();
      context.fill();
    }
  }

  function drawRope(state, positions, aimWorld, candidate) {
    const diver = state.diver;
    if (diver.rope) {
      const anchor = positions[diver.rope.index];
      const ax = anchor.x - state.camera.x;
      const ay = anchor.y - state.camera.y;
      const px = diver.x - state.camera.x;
      const py = diver.y - state.camera.y;
      context.strokeStyle = 'rgba(174,247,230,0.25)';
      context.lineWidth = 7;
      context.beginPath();
      context.moveTo(ax, ay);
      context.lineTo(px, py);
      context.stroke();
      context.strokeStyle = PALETTE.rope;
      context.lineWidth = 2.5;
      context.beginPath();
      context.moveTo(ax, ay);
      context.lineTo(px, py);
      context.stroke();
      return;
    }
    if (candidate !== null && candidate !== undefined && aimWorld) {
      const anchor = positions[candidate];
      const ax = anchor.x - state.camera.x;
      const ay = anchor.y - state.camera.y;
      const px = diver.x - state.camera.x;
      const py = diver.y - state.camera.y;
      context.strokeStyle = 'rgba(174,247,230,0.4)';
      context.lineWidth = 2;
      context.setLineDash([8, 8]);
      context.beginPath();
      context.moveTo(px, py);
      context.lineTo(ax, ay);
      context.stroke();
      context.setLineDash([]);
    }
  }

  function drawDiver(state) {
    const diver = state.diver;
    const trail = diver.trail;
    if (trail.length > 1) {
      for (let index = 1; index < trail.length; index += 1) {
        const alpha = (index / trail.length) * 0.55;
        const width = 3 + (index / trail.length) * 8;
        context.strokeStyle = `rgba(53,240,208,${alpha})`;
        context.fillStyle = `rgba(53,240,208,${alpha})`;
        context.lineWidth = width;
        context.lineCap = 'round';
        context.beginPath();
        context.moveTo(trail[index - 1].x - state.camera.x, trail[index - 1].y - state.camera.y);
        context.lineTo(trail[index].x - state.camera.x, trail[index].y - state.camera.y);
        context.stroke();
        // A dot at each point keeps the arc continuous where the line is thin.
        context.beginPath();
        context.arc(trail[index].x - state.camera.x, trail[index].y - state.camera.y, width / 2, 0, Math.PI * 2);
        context.fill();
      }
    }
    const x = diver.x - state.camera.x;
    const y = diver.y - state.camera.y;
    const squashY = 1 - diver.squash * 0.22;
    const squashX = 1 + diver.squash * 0.22;
    context.save();
    context.translate(x, y);
    context.scale(squashX, squashY);
    // Glow halo so the diver reads against the dark rock.
    context.globalAlpha = 0.25;
    context.fillStyle = PALETTE.anchor;
    context.beginPath();
    context.arc(0, 0, PLAYER.radius * 2, 0, Math.PI * 2);
    context.fill();
    context.globalAlpha = 1;
    // Air tank on the back side.
    context.fillStyle = '#c94a30';
    context.beginPath();
    context.arc(-diver.facing * 9, 3, 5, 0, Math.PI * 2);
    context.fill();
    // Suit: solid orange, shaded darker toward the bottom.
    context.fillStyle = PALETTE.playerSuit;
    context.beginPath();
    context.arc(0, 0, PLAYER.radius, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = 'rgba(0,0,0,0.18)';
    context.beginPath();
    context.arc(0, 5, PLAYER.radius * 0.8, 0, Math.PI);
    context.fill();
    // Diving mask: a dark visor on the facing side, with one specular dot.
    context.fillStyle = PALETTE.playerVisor;
    context.beginPath();
    context.ellipse(diver.facing * 4, -2, 7.5, 5.5, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#ffffff';
    context.beginPath();
    context.arc(diver.facing * 4 - 2, -4, 2, 0, Math.PI * 2);
    context.fill();
    // Helmet lamp: a cyan dot on top.
    context.fillStyle = PALETTE.anchorHot;
    context.beginPath();
    context.arc(0, -PLAYER.radius + 1, 3, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  function drawHud(state, extras) {
    const taken = state.orbs.filter((orb) => orb.taken).length;
    context.fillStyle = 'rgba(2,12,16,0.55)';
    context.fillRect(0, 0, FIELD.width, 62);
    text(`${state.levelIndex + 1} · ${state.level.name}`, 24, 38, 24, PALETTE.text, 'left', 700);
    text(`◆ ${taken}/${state.orbs.length}`, 330, 38, 24, PALETTE.orb, 'left', 700);
    text(formatTime(state.elapsed), 520, 38, 24, PALETTE.text, 'left', 700);
    text(`✕ ${state.deaths}`, 660, 38, 24, PALETTE.muted, 'left', 700);
    if (state.diver.rope) {
      context.fillStyle = PALETTE.anchor;
      context.beginPath();
      context.roundRect(760, 16, 118, 32, 16);
      context.fill();
      text('ROPE HELD', 819, 38, 17, '#04222b', 'center', 800);
    } else if (extras.candidate !== null && extras.candidate !== undefined) {
      context.strokeStyle = PALETTE.anchor;
      context.lineWidth = 2;
      context.beginPath();
      context.roundRect(760, 16, 118, 32, 16);
      context.stroke();
      text('ROPE READY', 819, 38, 17, PALETTE.anchor, 'center', 800);
    }
    drawHudButton(HUD_BUTTONS.mute, extras.muted ? '✕♪' : '♪');
    drawHudButton(HUD_BUTTONS.pause, 'II');
    if (extras.intro > 0) {
      const alpha = Math.min(1, extras.intro / 0.6, (3.2 - extras.intro) / 0.6 + 1);
      context.globalAlpha = Math.max(0, Math.min(1, alpha));
      text(state.level.name.toUpperCase(), FIELD.width / 2, 150, 54, PALETTE.text, 'center', 800);
      text(state.level.sub, FIELD.width / 2, 186, 24, PALETTE.anchor, 'center', 600);
      text(state.level.hint, FIELD.width / 2, 668, 22, PALETTE.text, 'center', 600);
      context.globalAlpha = 1;
    }
  }

  function drawHudButton(rect, glyph) {
    context.fillStyle = 'rgba(8,39,48,0.85)';
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 2;
    context.beginPath();
    context.roundRect(rect.x, rect.y, rect.w, rect.h, 10);
    context.fill();
    context.stroke();
    text(glyph, rect.x + rect.w / 2, rect.y + 30, 22, PALETTE.text, 'center', 700);
  }

  return {
    resize,
    text,
    panel,
    font,
    view,
    context,
    drawWorld(state, extras) {
      const time = state.elapsed;
      const shakeX = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
      const shakeY = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
      const camera = { x: state.camera.x + shakeX, y: state.camera.y + shakeY };
      const shaken = { ...state, camera };
      context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
      context.fillStyle = PALETTE.backdrop;
      context.fillRect(-2000, -2000, 6000, 6000);
      drawBackdrop(shaken, time);
      drawPlatforms(shaken);
      drawLava(shaken, time);
      drawSpikes(shaken);
      drawCrushers(shaken);
      const positions = drawAnchors(shaken, time, extras.candidate);
      drawOrbs(shaken, time);
      drawExit(shaken, time);
      drawCheckpoints(shaken);
      drawRope(shaken, positions, extras.aimWorld, extras.candidate);
      drawDiver(shaken);
      extras.particles.draw(context, camera);
      context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    },
    drawHud(state, extras) {
      context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
      drawHud(state, extras);
    },
  };
}

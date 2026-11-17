// Particles and floating texts: one fixed pool, no allocation while playing. Bursts
// mark every event the player causes — a grab, an orb, a landing, a death — and the
// texts pop the score where it happened.

const MAX_PARTICLES = 420;
const MAX_TEXTS = 12;

export function createParticles() {
  const particles = [];
  for (let index = 0; index < MAX_PARTICLES; index += 1) {
    particles.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 2, color: '#fff', gravity: 0, drag: 0 });
  }
  const texts = [];
  for (let index = 0; index < MAX_TEXTS; index += 1) {
    texts.push({ active: false, x: 0, y: 0, text: '', life: 0, maxLife: 1, color: '#fff', size: 20 });
  }
  let cursor = 0;

  function spawn(x, y, vx, vy, life, size, color, gravity, drag) {
    const particle = particles[cursor];
    cursor = (cursor + 1) % particles.length;
    particle.active = true;
    particle.x = x;
    particle.y = y;
    particle.vx = vx;
    particle.vy = vy;
    particle.life = life;
    particle.maxLife = life;
    particle.size = size;
    particle.color = color;
    particle.gravity = gravity;
    particle.drag = drag;
  }

  return {
    burst(x, y, { count = 14, speed = 220, life = 0.6, size = 3, color = '#aef7e6', gravity = 500, spread = Math.PI * 2, angle = 0 } = {}) {
      for (let index = 0; index < count; index += 1) {
        const direction = angle + (Math.random() - 0.5) * spread;
        const power = speed * (0.3 + Math.random() * 0.7);
        spawn(x, y, Math.cos(direction) * power, Math.sin(direction) * power, life * (0.6 + Math.random() * 0.7), size * (0.6 + Math.random() * 0.8), color, gravity, 1.5);
      }
    },
    ring(x, y, { count = 22, speed = 300, life = 0.45, size = 3, color = '#ffd34d' } = {}) {
      for (let index = 0; index < count; index += 1) {
        const direction = (index / count) * Math.PI * 2;
        spawn(x, y, Math.cos(direction) * speed, Math.sin(direction) * speed, life, size, color, 0, 3);
      }
    },
    floatText(x, y, text, color, size = 22) {
      let slot = texts.find((item) => !item.active) || texts[0];
      slot.active = true;
      slot.x = x;
      slot.y = y;
      slot.text = text;
      slot.life = 0.9;
      slot.maxLife = 0.9;
      slot.color = color;
      slot.size = size;
    },
    update(dt) {
      for (const particle of particles) {
        if (!particle.active) continue;
        particle.life -= dt;
        if (particle.life <= 0) {
          particle.active = false;
          continue;
        }
        particle.vy += particle.gravity * dt;
        const drag = Math.max(0, 1 - particle.drag * dt);
        particle.vx *= drag;
        particle.vy *= drag;
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
      }
      for (const item of texts) {
        if (!item.active) continue;
        item.life -= dt;
        item.y -= 46 * dt;
        if (item.life <= 0) item.active = false;
      }
    },
    draw(context, camera) {
      for (const particle of particles) {
        if (!particle.active) continue;
        const alpha = Math.max(0, particle.life / particle.maxLife);
        context.globalAlpha = alpha;
        context.fillStyle = particle.color;
        context.beginPath();
        context.arc(particle.x - camera.x, particle.y - camera.y, particle.size * (0.5 + alpha * 0.5), 0, Math.PI * 2);
        context.fill();
      }
      context.globalAlpha = 1;
      for (const item of texts) {
        if (!item.active) continue;
        const alpha = Math.max(0, item.life / item.maxLife);
        context.globalAlpha = alpha;
        context.font = `700 ${item.size}px system-ui, sans-serif`;
        context.textAlign = 'center';
        context.fillStyle = item.color;
        context.fillText(item.text, item.x - camera.x, item.y - camera.y);
      }
      context.globalAlpha = 1;
    },
    clear() {
      for (const particle of particles) particle.active = false;
      for (const item of texts) item.active = false;
    },
  };
}

// Pure geometry: no game state, no browser. The diver is an axis-aligned box against
// the rock (robust at 60 steps a second) and a circle against hazards and orbs.

/** Where an anchor is at `time`, following its drift. Static anchors never move. */
export function anchorPosition(anchor, time) {
  if (!anchor.period) return { x: anchor.x, y: anchor.y };
  const swing = Math.sin((time / anchor.period) * Math.PI * 2 + (anchor.phase || 0));
  return { x: anchor.x + (anchor.dx || 0) * swing, y: anchor.y + (anchor.dy || 0) * swing };
}

/** Where a crusher's box is at `time`. */
export function crusherRect(crusher, time) {
  const swing = Math.sin((time / crusher.period) * Math.PI * 2 + (crusher.phase || 0));
  return {
    x: crusher.x + (crusher.dx || 0) * swing,
    y: crusher.y + (crusher.dy || 0) * swing,
    w: crusher.w,
    h: crusher.h,
  };
}

export function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/** True when the circle at (cx, cy) with radius r touches rect, shrunk by `inset`. */
export function circleHitsRect(cx, cy, r, rect, inset) {
  const nearX = Math.max(rect.x + inset, Math.min(cx, rect.x + rect.w - inset));
  const nearY = Math.max(rect.y + inset, Math.min(cy, rect.y + rect.h - inset));
  const dx = cx - nearX;
  const dy = cy - nearY;
  return dx * dx + dy * dy <= r * r;
}

/**
 * Push the box out of every solid rect it overlaps, smallest penetration first.
 * Returns the collision flags: hitGround (landed on a top face), hitCeiling, hitWall
 * (-1 wall on the left, 1 on the right). The box is moved in place.
 */
export function resolveBox(box, solids) {
  let hitGround = false;
  let hitCeiling = false;
  let hitWall = 0;
  for (let pass = 0; pass < 2; pass += 1) {
    for (const solid of solids) {
      if (!rectsOverlap(box, solid)) continue;
      const pushLeft = box.x + box.w - solid.x;
      const pushRight = solid.x + solid.w - box.x;
      const pushUp = box.y + box.h - solid.y;
      const pushDown = solid.y + solid.h - box.y;
      const minX = Math.min(pushLeft, pushRight);
      const minY = Math.min(pushUp, pushDown);
      if (minX < minY) {
        if (pushLeft < pushRight) {
          box.x = solid.x - box.w;
          hitWall = 1;
        } else {
          box.x = solid.x + solid.w;
          hitWall = -1;
        }
      } else if (pushUp < pushDown) {
        box.y = solid.y - box.h;
        hitGround = true;
      } else {
        box.y = solid.y + solid.h;
        hitCeiling = true;
      }
    }
  }
  return { hitGround, hitCeiling, hitWall };
}

/**
 * Hold the diver to its rope: when the line is taut, pull the diver back onto the
 * circle around the anchor and drop the outward part of the velocity, keeping the
 * swing. A slack rope does nothing.
 */
export function constrainRope(diver, anchor, length) {
  const dx = diver.x - anchor.x;
  const dy = diver.y - anchor.y;
  const dist = Math.hypot(dx, dy);
  if (dist <= length || dist === 0) return false;
  const nx = dx / dist;
  const ny = dy / dist;
  diver.x = anchor.x + nx * length;
  diver.y = anchor.y + ny * length;
  const radial = diver.vx * nx + diver.vy * ny;
  if (radial > 0) {
    diver.vx -= radial * nx;
    diver.vy -= radial * ny;
  }
  return true;
}

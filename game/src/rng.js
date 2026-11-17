// A small seeded random stream (xorshift32): the same seed gives the same decoration,
// which is what makes the screenshot scenes repeatable. Nothing gameplay-critical
// depends on it — levels are hand-designed — but the cave dressing must not shimmer
// between the two runs of the entry program.

export function createRandom(seed) {
  let state = (seed | 0) || 0x9e3779b9;
  return function random() {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state |= 0;
    return (state >>> 0) / 4294967296;
  };
}

/** A stable integer seed from a short string, so each level dresses the same every run. */
export function seedFromText(text) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash | 0;
}

/** A value in [min, max) from a random stream. */
export function range(random, min, max) {
  return min + random() * (max - min);
}

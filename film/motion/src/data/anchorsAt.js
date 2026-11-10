// anchorsAt.js — plain-JS lookup shared with the scripts (anchors.ts re-exports it with types).
export function anchorsAt(set, frame0) {
  if (!set) return null;
  const want = frame0 + 1;
  for (const d of [0, 1, -1, 2, -2]) {
    const hit = set.frames[String(want + d)];
    if (hit) return hit;
  }
  return null;
}

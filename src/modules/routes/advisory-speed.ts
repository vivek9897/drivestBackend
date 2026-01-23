// src/modules/routes/advisory-speed.ts
type Pt = { lat: number; lon: number };

function toRad(x: number) {
  return (x * Math.PI) / 180;
}

// Haversine distance in meters
function distM(a: Pt, b: Pt) {
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLon / 2);

  const h = s1 * s1 + Math.cos(lat1) * Math.cos(lat2) * s2 * s2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

// Angle at point b for a-b-c, in radians, using planar approx from segment lengths
function angleRad(a: Pt, b: Pt, c: Pt) {
  const ab = distM(a, b);
  const bc = distM(b, c);
  const ac = distM(a, c);
  if (ab < 0.5 || bc < 0.5) return 0;

  // Law of cosines: cos(theta) = (ab^2 + bc^2 - ac^2) / (2ab*bc)
  const cos = (ab * ab + bc * bc - ac * ac) / (2 * ab * bc);
  const clamped = Math.max(-1, Math.min(1, cos));
  return Math.acos(clamped);
}

// Radius estimate from 3 points (meters). If near-straight, returns Infinity.
function radiusFrom3(a: Pt, b: Pt, c: Pt) {
  const ab = distM(a, b);
  const bc = distM(b, c);
  const ac = distM(a, c);
  const theta = angleRad(a, b, c);
  if (theta < toRad(5)) return Number.POSITIVE_INFINITY;

  // Circumradius R = a / (2 sin A) with A = angle at b, opposite side ac
  const sinA = Math.sin(theta);
  if (sinA < 1e-6) return Number.POSITIVE_INFINITY;

  return ac / (2 * sinA);
}

// Convert radius to advisory speed mph.
// Simple mapping, tuned for driving instruction safety, not physics-perfect.
function mphFromRadius(radiusM: number) {
  if (!isFinite(radiusM)) return null;

  // Buckets. You will tune after you see output.
  if (radiusM < 25) return 10;
  if (radiusM < 40) return 15;
  if (radiusM < 60) return 20;
  if (radiusM < 90) return 25;
  if (radiusM < 140) return 30;
  if (radiusM < 220) return 35;
  if (radiusM < 320) return 40;
  return null;
}

// Use a sliding 3-point window across the polyline.
// Return the lowest advisory mph found (most restrictive bend).
export function computeBendAdvisoryMph(
  geom: Pt[] | null | undefined,
  options?: { sampleStep?: number }
) {
  if (!geom || geom.length < 3) return null;

  const step = Math.max(1, options?.sampleStep ?? 2);
  let best: number | null = null;

  for (let i = 0; i + 2 < geom.length; i += step) {
    const a = geom[i];
    const b = geom[i + 1];
    const c = geom[i + 2];

    const r = radiusFrom3(a, b, c);
    const mph = mphFromRadius(r);
    if (mph == null) continue;

    if (best == null || mph < best) best = mph;
  }

  return best;
}

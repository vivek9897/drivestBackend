import 'reflect-metadata';
import dataSource from '../database/typeorm.config';
import { TestCentre } from '../entities/test-centre.entity';
import { Route, RouteDifficulty } from '../entities/route.entity';
import { Product, ProductPeriod, ProductType } from '../entities/product.entity';
import { OsmSpeedService } from '../modules/routes/osm-speed.service';
import { inferSpeedFromRoadClassMph } from '../modules/routes/speed-fallback';
import { computeBendAdvisoryMph } from '../modules/routes/advisory-speed';
import { enrichColchesterRoutes, computeBbox as seedComputeBbox } from './colchester-routes-seed';
import * as fs from 'fs';
import * as path from 'path';

const coordsFromGeoJson = (geojson: any): number[][] => {
  if (!geojson?.features?.length) return [];
  const feature = geojson.features.find((f: any) => f.geometry?.type === 'LineString');
  const coords = feature?.geometry?.coordinates;
  return Array.isArray(coords) ? coords : [];
};

const coordsFromGpx = (gpx?: string): number[][] => {
  if (!gpx) return [];
  const segRegex = /<trkseg[^>]*>([\s\S]*?)<\/trkseg>/gi;
  let segMatch: RegExpExecArray | null;
  let best: number[][] = [];
  while ((segMatch = segRegex.exec(gpx)) !== null) {
    const seg = segMatch[1];
    const pts: number[][] = [];
    const ptRegex = /<trkpt[^>]*lat="([0-9.+-]+)"[^>]*lon="([0-9.+-]+)"/g;
    let ptMatch: RegExpExecArray | null;
    while ((ptMatch = ptRegex.exec(seg)) !== null) {
      pts.push([Number(ptMatch[2]), Number(ptMatch[1])]);
    }
    if (pts.length > best.length) best = pts;
  }

  if (best.length) return best;

  const fallbackPts: number[][] = [];
  const fallbackRegex = /<trkpt[^>]*lat="([0-9.+-]+)"[^>]*lon="([0-9.+-]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = fallbackRegex.exec(gpx)) !== null) {
    fallbackPts.push([Number(match[2]), Number(match[1])]);
  }
  return fallbackPts;
};

const computeBbox = (coords: number[][]) => {
  return coords.reduce(
    (acc, [lng, lat]) => ({
      minLat: Math.min(acc.minLat, lat),
      maxLat: Math.max(acc.maxLat, lat),
      minLng: Math.min(acc.minLng, lng),
      maxLng: Math.max(acc.maxLng, lng),
    }),
    { minLat: 90, maxLat: -90, minLng: 180, maxLng: -180 },
  );
};

const haversine = (a: number[], b: number[]) => {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const c =
    2 *
    Math.atan2(
      Math.sqrt(sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon),
      Math.sqrt(1 - (sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon)),
    );
  return R * c;
};

const distanceMeters = (coords: number[][]) => {
  if (!coords || coords.length < 2) return 0;
  let dist = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    dist += haversine(coords[i], coords[i + 1]);
  }
  return Math.round(dist);
};

const firstExistingPath = (candidates: string[]) => {
  for (const p of candidates) {
    if (p && fs.existsSync(p)) return p;
  }
  return null;
};

const resolveSeedRoutesDir = () => {
  const cwd = process.cwd();
  const candidates = [
    path.resolve(cwd, 'src/seed/routes'),
    path.resolve(cwd, 'dist/seed/routes'),
    path.resolve(__dirname, 'routes'),
  ];
  return firstExistingPath(candidates);
};

const resolveSeedFile = (relativeFromRoutesDir: string) => {
  const cwd = process.cwd();
  const candidates = [
    path.resolve(cwd, 'src/seed/routes', relativeFromRoutesDir),
    path.resolve(cwd, 'dist/seed/routes', relativeFromRoutesDir),
    path.resolve(__dirname, 'routes', relativeFromRoutesDir),
  ];
  return firstExistingPath(candidates);
};

const pickCoordForInstruction = (coords: number[][], idx: number, total: number) => {
  if (!coords?.length) return null;

  if (coords.length < 30) {
    const t = total <= 1 ? 0 : idx / (total - 1);
    const pos = Math.max(0, Math.min(coords.length - 1, Math.round(t * (coords.length - 1))));
    return coords[pos];
  }

  if (total <= 1) return coords[0];

  if (idx === 0) return coords[Math.min(10, coords.length - 1)];
  if (idx === total - 1) return coords[Math.max(0, coords.length - 11)];

  const t = idx / (total - 1);
  const pos = Math.max(0, Math.min(coords.length - 1, Math.round(t * (coords.length - 1))));
  return coords[pos];
};

const densifyCoords = (coords: number[][], stepM = 10): number[][] => {
  const result: number[][] = [];
  for (let i = 0; i < coords.length - 1; i++) {
    const a = coords[i];
    const b = coords[i + 1];
    const dist = haversine(a, b);
    result.push(a);
    if (dist > stepM) {
      const numSteps = Math.floor(dist / stepM);
      for (let j = 1; j <= numSteps; j++) {
        const frac = j / (numSteps + 1);
        const lng = a[0] + frac * (b[0] - a[0]);
        const lat = a[1] + frac * (b[1] - a[1]);
        result.push([lng, lat]);
      }
    }
  }
  if (coords.length) result.push(coords[coords.length - 1]);
  return result;
};

const applyOsmSpeedsToInstructions = async (
  osmSpeedService: OsmSpeedService,
  coords: number[][],
  instructions: any[],
) => {
  if (!Array.isArray(instructions) || !instructions.length) return;

  for (let i = 0; i < instructions.length; i++) {
    const ins = instructions[i];
    const c = pickCoordForInstruction(coords, i, instructions.length);
    if (!c) continue;

    ins.lat = c[1];
    ins.lon = c[0];
    ins.location = { lat: c[1], lon: c[0] };

    const lng = c[0];
    const lat = c[1];

    let speed: any = { mph: null, snapped: null, matched: null, speed_source: null, speed_limit_confidence: null };

    try {
      speed = await osmSpeedService.getSpeedAtPoint(lng, lat, 150);
      if (speed.mph == null) {
        const snapM = Number(speed.snapped?.dist_m ?? 999);
        if (speed.snapped && snapM <= 15) {
          speed = await osmSpeedService.getSpeedAtPoint(lng, lat, 500);
        }
      }
    } catch (error) {
      // OSM data not available, will fall back to road class inference
      console.warn(`OSM speed lookup failed for instruction ${i}, falling back to road class inference`);
    }

    ins.snapped_to_road = !!speed.snapped;
    ins.snap_distance_m = speed.snapped?.dist_m ?? null;

    if (speed.matched?.highway) {
      ins.road_class = speed.matched.highway;
    }

    applyRoundaboutTags(ins);

    // 1) Use OSM speed if available
    if (speed.mph != null) {
      ins.speed_limit_mph_osm = speed.speed_source.startsWith('osm') ? speed.mph : null;
      ins.speed_mph = speed.mph;
      ins.speed_limit_mph_final = speed.mph;
      ins.speed_source = speed.speed_source;
      ins.speed_limit_confidence = speed.speed_limit_confidence;
    }

    // 2) Fallback: infer from road class if OSM speed missing
    if (speed.mph == null) {
      const inferred = inferSpeedFromRoadClassMph(ins.road_class);
      if (inferred != null) {
        ins.speed_limit_mph_osm = null;
        ins.speed_mph = inferred;
        ins.speed_limit_mph_final = inferred;
        ins.speed_source = 'inferred_roadclass';
        ins.speed_limit_confidence = Math.max(Number(ins.speed_limit_confidence ?? 0), 0.6);
      }
    }

    if (!Array.isArray(ins.hazard_tags)) ins.hazard_tags = [];
    if (!Array.isArray(ins.common_fault_risk)) ins.common_fault_risk = [];

    const advisory = computeAdvisorySpeedMph(coords, i, instructions.length, ins);
    if (advisory != null) {
      ins.advisory_speed_mph = advisory;

      const base = Number(ins.speed_mph ?? ins.speed_limit_mph_final ?? 0);
      if (base && advisory <= base - 10) {
        ins.speed_drop_warning = true;
      }
    }

    let radius = 60;
    let limit = 5;
    if (ins.direction && (ins.direction.includes('t/l') || ins.direction.includes('traffic lights'))) {
      radius = 300;
      limit = 8;
    }
    let controls: any[] = [];
    try {
      controls = await osmSpeedService.findControlsNearPoint(lng, lat, radius, limit);
    } catch (error) {
      console.warn(`OSM controls lookup failed for point (${lng}, ${lat}):`, (error as Error).message);
    }
    ins.nearest_control = controls?.length ? controls[0] : null;
    if (!controls || controls.length === 0) {
        ins.nearest_control = null;
    }
    applyControlTags(ins, controls);

    ins['nearest_control'] = (controls && controls.length) ? controls[0] : null;

    const pos = nearestCoordIndex(coords, c);
    const windowStart = Math.max(0, pos - 25);
    const windowEnd = Math.min(coords.length, pos + 26);
    const windowCoords = coords.slice(windowStart, windowEnd);
    const densified = densifyCoords(windowCoords, 10);
    let bestZebra: any = null;
    let bestDist = Infinity;
    for (const point of densified) {
      const lngP = point[0];
      const latP = point[1];
      let zebras: any[] = [];
      try {
        zebras = await osmSpeedService.findZebraCrossingsNearPoint(lngP, latP, 60, 8);
      } catch (error) {
        console.warn(`OSM zebra crossing lookup failed for point (${lngP}, ${latP}):`, (error as Error).message);
      }
      if (zebras.length) {
        const nearest = zebras[0];
        if (nearest.dist_m < bestDist) {
          bestDist = nearest.dist_m;
          bestZebra = nearest;
        }
      }
    }
    ins.nearest_zebra_crossing = bestDist <= 40 ? bestZebra : null;

    // Force instruction-level zebra fields from the best zebra we found
    if (ins.nearest_zebra_crossing) {
      const d = Number(ins.nearest_zebra_crossing?.dist_m ?? null)
      ins.zebra_crossing_dist_m = Number.isFinite(d) ? d : null

      if (ins.zebra_crossing_dist_m !== null) {
        if (ins.zebra_crossing_dist_m <= 15) ins.zebra_crossing_confidence = 0.9
        else if (ins.zebra_crossing_dist_m <= 30) ins.zebra_crossing_confidence = 0.7
        else if (ins.zebra_crossing_dist_m <= 60) ins.zebra_crossing_confidence = 0.5
        else ins.zebra_crossing_confidence = 0.3
      } else {
        ins.zebra_crossing_confidence = null
      }
    } else {
      ins.zebra_crossing_dist_m = null
      ins.zebra_crossing_confidence = null
    }

    applyZebraTags(ins);

    ins.step_reliability_score = computeReliability(ins);
    ins.step_reliability_label = reliabilityLabel(ins.step_reliability_score);
  }
};

const computeAdvisorySpeedMph = (coords: number[][], idx: number, total: number, ins: any): number | null => {
  if (!coords?.length) return null;

  const c = pickCoordForInstruction(coords, idx, total);
  if (!c) return null;

  const pos = nearestCoordIndex(coords, c);
  if (pos < 2 || pos > coords.length - 3) return null;

  const a = coords[pos - 2];
  const b = coords[pos];
  const d = coords[pos + 2];

  const ang = turnAngleDeg(a, b, d);
  const abs = Math.abs(ang);

  const text = String(ins?.direction ?? '').toLowerCase();
  const type = String(ins?.action_type ?? '').toLowerCase();

  const isRoundabout = text.includes('roundabout') || type.includes('roundabout');

  if (isRoundabout) {
    const dir = String(ins?.direction ?? '').toLowerCase();

    let exitN: number | null = null;

    // Only treat numeric ordinals as true exits.
    const m = dir.match(/(\d+)\s*(st|nd|rd|th)\s*exit/i);
    if (m) {
      exitN = Number(m[1]);
    } else {
      // Semantic fallback when text has no ordinal.
      if (dir.includes('roundabout left')) exitN = 1;
      else if (dir.includes('roundabout ahead') || dir.includes('roundabout straight')) exitN = 2;
      else if (dir.includes('roundabout right')) exitN = 3;
    }

    if (exitN != null) {
      if (exitN >= 4) return 12;
      if (exitN === 3) return 14;
      return 15;
    }

    // If we still don't know exit number, keep existing default advisory.
    return 15;
  }

  let angleAdvisory: number | null = null;
  if (abs >= 80) angleAdvisory = 10;
  else if (abs >= 60) angleAdvisory = 15;
  else if (abs >= 40) angleAdvisory = 20;
  else if (abs >= 25) angleAdvisory = 25;

  const sliceStart = Math.max(0, pos - 6);
  const sliceEnd = Math.min(coords.length, pos + 7);
  const slice = coords.slice(sliceStart, sliceEnd);

  const geom = slice.map((p) => ({ lon: p[0], lat: p[1] }));
  const bendAdvisory = computeBendAdvisoryMph(geom, { sampleStep: 1 });

  if (bendAdvisory == null) return angleAdvisory;
  if (angleAdvisory == null) return bendAdvisory;

  return Math.min(angleAdvisory, bendAdvisory);
};

const applyRoundaboutTags = (ins: any) => {
  const dirRaw = String(ins?.direction ?? '');
  const typeRaw = String(ins?.action_type ?? '');
  const s = (dirRaw + ' ' + typeRaw).toLowerCase();

  if (!s.includes('roundabout')) return;

  if (!Array.isArray(ins.hazard_tags)) ins.hazard_tags = [];
  if (!Array.isArray(ins.common_fault_risk)) ins.common_fault_risk = [];

  if (!ins.hazard_tags.includes('roundabout')) ins.hazard_tags.push('roundabout');

  ins.junction_type = 'roundabout';
  ins.decision_point = true;
  ins.hazard_score = Math.max(Number(ins.hazard_score ?? 0), 3);

  // Exit logic: numeric ordinal first, else semantic left/ahead/right.
  let exitN: number | null = null;
  let inferred = false;
  let confidence = 0;

  const m = s.match(/(\d+)\s*(st|nd|rd|th)\s*exit/i);
  if (m) {
    exitN = Number(m[1]);
    inferred = false;
    confidence = 0.95;
  } else {
    if (s.includes('roundabout left')) {
      exitN = 1;
      inferred = true;
      confidence = 0.75;
    } else if (s.includes('roundabout ahead') || s.includes('roundabout straight')) {
      exitN = 2;
      inferred = true;
      confidence = 0.7;
    } else if (s.includes('roundabout right')) {
      exitN = 3;
      inferred = true;
      confidence = 0.75;
    }
  }

  if (exitN != null) {
    ins.roundabout_exit = exitN;
    ins.roundabout_exit_number_inferred = inferred;
    ins.roundabout_exit_confidence = confidence;

    if (!ins.common_fault_risk.includes('lane_discipline')) ins.common_fault_risk.push('lane_discipline');
    if (!ins.common_fault_risk.includes('signals')) ins.common_fault_risk.push('signals');
  } else {
    // Do not overwrite if another part set it earlier
    if (ins.roundabout_exit === undefined) ins.roundabout_exit = null;
    if (ins.roundabout_exit_number_inferred === undefined) ins.roundabout_exit_number_inferred = false;
    if (ins.roundabout_exit_confidence === undefined) ins.roundabout_exit_confidence = 0;
  }
};

const applyControlTags = (ins: any, hits: Array<{ type: string; dist_m: number }>) => {
  if (!hits?.length) return;

  const nearest = hits[0];
  const t = nearest.type;

  if (!Array.isArray(ins.hazard_tags)) ins.hazard_tags = [];
  if (!Array.isArray(ins.common_fault_risk)) ins.common_fault_risk = [];

  if (t === 'traffic_signals') {
    const d = Number(nearest.dist_m ?? 999);
    ins.traffic_lights_source = 'osm';

    if (!ins.hazard_tags.includes('traffic_lights')) ins.hazard_tags.push('traffic_lights');

    ins.junction_type = 'traffic_lights';
    ins.decision_point = d <= 30;
    ins.hazard_score = Math.max(Number(ins.hazard_score ?? 0), d <= 15 ? 3 : 2);

    if (!ins.common_fault_risk.includes('signal_observation')) ins.common_fault_risk.push('signal_observation');
    if (d <= 20 && !ins.common_fault_risk.includes('stop_line')) ins.common_fault_risk.push('stop_line');

    ins.stop_line_expected = d <= 20;

    return;
  }

  if (t === 'stop') {
    const d = Number(nearest.dist_m ?? 999);

    if (!ins.hazard_tags.includes('stop')) ins.hazard_tags.push('stop');

    ins.junction_type = 'stop';
    ins.decision_point = d <= 30;
    ins.hazard_score = Math.max(Number(ins.hazard_score ?? 0), 3);

    if (!ins.common_fault_risk.includes('stop_line')) ins.common_fault_risk.push('stop_line');

    ins.stop_line_expected = true;
    ins.must_stop = d <= 30;

    return;
  }

  if (t === 'give_way') {
    if (!ins.hazard_tags.includes('give_way')) ins.hazard_tags.push('give_way');
    ins.junction_type = ins.junction_type ?? 'give_way';
    ins.decision_point = true;
    ins.hazard_score = Math.max(Number(ins.hazard_score ?? 0), 2);
    if (!ins.common_fault_risk.includes('give_way')) ins.common_fault_risk.push('give_way');
  }
};

function applyZebraTags(ins: any) {
  if (ins.nearest_zebra_crossing) {
    const d = Number(ins.nearest_zebra_crossing?.dist_m ?? 999);

    ins.zebra_crossing_dist_m = d;

    if (d <= 15) ins.zebra_crossing_confidence = 0.9;
    else if (d <= 30) ins.zebra_crossing_confidence = 0.7;
    else if (d <= 60) ins.zebra_crossing_confidence = 0.5;
    else ins.zebra_crossing_confidence = 0.3;

    if (!Array.isArray(ins.hazard_tags)) ins.hazard_tags = []
    if (!Array.isArray(ins.common_fault_risk)) ins.common_fault_risk = []

    if (d <= 30) {
      if (!ins.hazard_tags.includes('zebra_crossing')) ins.hazard_tags.push('zebra_crossing')
      ins.zebra_crossing_source = 'osm'
      ins.zebra_crossing_decision_point = true
      ins.stop_line_expected = true
      ins.hazard_score = Math.max(Number(ins.hazard_score ?? 0), 2)
      if (!ins.common_fault_risk.includes('scan_for_pedestrians')) ins.common_fault_risk.push('scan_for_pedestrians')
      if (!ins.common_fault_risk.includes('yield_to_pedestrians')) ins.common_fault_risk.push('yield_to_pedestrians')
    }
  } else {
    ins.zebra_crossing_dist_m = null;
    ins.zebra_crossing_confidence = null;
  }
}

const computeReliability = (ins: any): number => {
  const src = String(ins?.speed_source ?? '');
  const snap = ins?.snapped_to_road === true;
  const snapM = Number(ins?.snap_distance_m ?? 999);

  let s = 0.65;

  if (src === 'osm' || src === 'osm_nsl') s = 0.9;
  if (src === 'osm_nearby') s = 0.82;
  if (src === 'inferred_roadclass') s = 0.72;

  if (snap) {
    if (snapM <= 5) s += 0.05;
    else if (snapM <= 15) s += 0.02;
    else if (snapM >= 40) s -= 0.05;
  } else {
    s -= 0.1;
  }

  if (ins?.hazard_tags?.includes('traffic_lights')) s -= 0.02;
  if (ins?.hazard_tags?.includes('stop')) s -= 0.03;

  const advisory = Number(ins?.advisory_speed_mph ?? 0);
  const base = Number(ins?.speed_limit_mph_final ?? ins?.speed_mph ?? 0);

  if (advisory > 0 && base > 0) {
    const drop = base - advisory;

    if (drop >= 20) s -= 0.08;
    else if (drop >= 15) s -= 0.05;
    else if (drop >= 10) s -= 0.03;
  }

  if (s < 0) s = 0;
  if (s > 1) s = 1;
  return Number(s.toFixed(3));
};

const reliabilityLabel = (v: number) => {
  if (v >= 0.85) return 'high';
  if (v >= 0.7) return 'medium';
  return 'low';
};

const nearestCoordIndex = (coords: number[][], target: number[]) => {
  let bestI = 0;
  let bestD = Infinity;
  for (let i = 0; i < coords.length; i++) {
    const dx = coords[i][0] - target[0];
    const dy = coords[i][1] - target[1];
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      bestI = i;
    }
  }
  return bestI;
};

const turnAngleDeg = (a: number[], b: number[], c: number[]) => {
  const v1x = a[0] - b[0];
  const v1y = a[1] - b[1];
  const v2x = c[0] - b[0];
  const v2y = c[1] - b[1];

  const dot = v1x * v2x + v1y * v2y;
  const m1 = Math.sqrt(v1x * v1x + v1y * v1y);
  const m2 = Math.sqrt(v2x * v2x + v2y * v2y);

  if (!m1 || !m2) return 0;

  let cos = dot / (m1 * m2);
  if (cos > 1) cos = 1;
  if (cos < -1) cos = -1;

  const ang = Math.acos(cos) * (180 / Math.PI);
  return 180 - ang;
};

async function run() {
  await dataSource.initialize();

  // Load sample OSM data for testing
  console.log('Loading sample OSM data...');
  const osmDataPath = path.resolve(__dirname, 'osm-sample-data.sql');
  if (fs.existsSync(osmDataPath)) {
    const osmSql = fs.readFileSync(osmDataPath, 'utf8');
    await dataSource.query(osmSql);
    console.log('Sample OSM data loaded successfully');
  } else {
    console.warn('OSM sample data file not found, OSM lookups will use fallbacks');
  }

  const osmSpeedService = new OsmSpeedService(dataSource);

  const centreRepo = dataSource.getRepository(TestCentre);
  const routeRepo = dataSource.getRepository(Route);
  const productRepo = dataSource.getRepository(Product);

  await routeRepo.query(
    'TRUNCATE practice_sessions, route_stats, tracks, cashback_claims, routes RESTART IDENTITY CASCADE',
  );
  await centreRepo.query('TRUNCATE test_centres RESTART IDENTITY CASCADE');
  await productRepo.query('TRUNCATE purchases, entitlements, products RESTART IDENTITY CASCADE');

  const centres: Partial<TestCentre>[] = [
    {
      name: 'Colchester Test Centre',
      address: 'DVSA Test Centre -> Monkwick -> Fingringhoe -> Rowhedge -> Finish',
      postcode: 'CO3 0LT',
      city: 'Colchester',
      country: 'UK',
      lat: 51.889,
      lng: 0.9373,
    },
  ];

  const savedCentres: TestCentre[] = [];
  for (const centre of centres) {
    const insertResult = await centreRepo.query(
      `INSERT INTO test_centres (name, address, postcode, city, country, lat, lng, geo)
       VALUES ($1, $2, $3, $4, $5, $6, $7, ST_SetSRID(ST_MakePoint($7, $6), 4326))
       RETURNING *`,
      [centre.name, centre.address, centre.postcode, centre.city, centre.country, centre.lat, centre.lng],
    );
    savedCentres.push(insertResult[0] as TestCentre);
  }

  const colchesterRouteCoords: number[][] = [];

  const defaultPayloadFile = resolveSeedFile('colchester_payload.json');
  const zebraPayloadFile = resolveSeedFile('zebra_payload.json');
  const payloadJson: any[] | null =
    defaultPayloadFile && fs.existsSync(defaultPayloadFile) ? JSON.parse(fs.readFileSync(defaultPayloadFile, 'utf8')) : null;

  // Load Colchester routes from hardcoded coordinates
  const enrichedColchesterRoutes = enrichColchesterRoutes();
  
  for (const seedRoute of enrichedColchesterRoutes) {
    try {
      const coords = seedRoute.coordinates;
      const bboxObj = seedComputeBbox(coords);
      // Convert bbox object to array format [minLng, minLat, maxLng, maxLat]
      const bboxLocal = [bboxObj.minLng, bboxObj.minLat, bboxObj.maxLng, bboxObj.maxLat];
      const polyline = JSON.stringify(coords);

      const geojsonToStore = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: { name: seedRoute.name },
            geometry: { type: 'LineString', coordinates: coords },
          },
        ],
      };

      const dist = seedRoute.distance || 12000;
      const duration = seedRoute.duration || 2400;

      const routePayload = payloadJson
        ? payloadJson.find((r: any) => {
            const routeNum = seedRoute.name.match(/(\d+)/)?.[1];
            return routeNum && r.route === Number(routeNum);
          }) ?? null
        : null;

      if (routePayload && coords.length) {
        const instructions = Array.isArray(routePayload) ? routePayload : routePayload.instructions;
        await applyOsmSpeedsToInstructions(osmSpeedService, coords, instructions);
      }

      const p = routePayload || {};
      const ins = Array.isArray(p.instructions) ? p.instructions : [];
      const finalPayload = { ...p, instructions: ins };

      await routeRepo.save({
        centreId: savedCentres[0].id,
        name: seedRoute.name,
        distanceM: dist,
        durationEstS: duration,
        difficulty: seedRoute.difficulty,
        polyline,
        geojson: geojsonToStore,
        gpx: null, // No GPX for coordinate-based routes
        bbox: bboxLocal,
        coordinates: coords,
        payload: finalPayload,
        version: 1,
        isActive: true,
      } as Route);

      console.log(`Created route ${seedRoute.name} with ${coords.length} coordinate points`);
    } catch (err) {
      console.warn(`Failed to create route ${seedRoute.name}:`, err);
    }
  }

  // Optional: Still load any GPX files from the routes directory (for backward compatibility)
  const routesDir = resolveSeedRoutesDir();
  if (routesDir && fs.existsSync(routesDir)) {
    const files = fs.readdirSync(routesDir);
    const gpxFiles = files.filter((f) => f.toLowerCase().endsWith('.gpx'));

    for (const gpxFile of gpxFiles) {
      try {
        const gpxPath = path.join(routesDir, gpxFile);
        const gpxContent = fs.readFileSync(gpxPath, 'utf8');
        const base = gpxFile.replace(/\.gpx$/i, '');
        const routeNumberMatch = base.match(/(\d+)/);
        const routeNumber = routeNumberMatch ? routeNumberMatch[1] : null;

        const routeName = routeNumber ? `Colchester Test Route ${routeNumber}` : base;

        const isZebraSmoke = base.toLowerCase().includes('zebra');

        const useZebraPayload = base.toLowerCase().includes('zebra smoke test');
        const payloadFile = useZebraPayload ? zebraPayloadFile : defaultPayloadFile;

        const geojsonPath = path.join(routesDir, `${base}.geojson`);
        let geojsonContent: any = null;
        if (fs.existsSync(geojsonPath)) {
          geojsonContent = JSON.parse(fs.readFileSync(geojsonPath, 'utf8'));
        }

        let coords: number[][] = [];
        if (geojsonContent) coords = coordsFromGeoJson(geojsonContent);
        if (!coords.length) coords = coordsFromGpx(gpxContent);
        if (!coords.length) coords = colchesterRouteCoords;

        const bboxObj = computeBbox(coords);
        // Convert bbox object to array format [minLng, minLat, maxLng, maxLat]
        const bboxLocal = [bboxObj.minLng, bboxObj.minLat, bboxObj.maxLng, bboxObj.maxLat];
        const polyline = JSON.stringify(coords);

        const geojsonToStore =
          geojsonContent ||
          (coords.length
            ? {
                type: 'FeatureCollection',
                features: [
                  {
                    type: 'Feature',
                    properties: { name: routeName, description: base },
                    geometry: { type: 'LineString', coordinates: coords },
                  },
                ],
              }
            : null);

        const dist = distanceMeters(coords);
        const duration = Math.round(dist / (30 * (1000 / 3600)));

        const routePayload = isZebraSmoke
          ? (payloadFile && fs.existsSync(payloadFile) ? JSON.parse(fs.readFileSync(payloadFile, 'utf8')) : null)
          : (payloadJson && routeNumber ? payloadJson.find((r: any) => r.route === Number(routeNumber)) ?? null : null);

        if (isZebraSmoke && !routePayload) {
          throw new Error('Smoke test requires colchester_payload.json');
        }

        if (routePayload && coords.length) {
          const instructions = Array.isArray(routePayload) ? routePayload : routePayload.instructions;
          await applyOsmSpeedsToInstructions(osmSpeedService, coords, instructions);
        }

        const p = routePayload || {};
        const ins = Array.isArray(p.instructions) ? p.instructions : [];
        const finalPayload = { ...p, instructions: ins };

        await routeRepo.save({
          centreId: savedCentres[0].id,
          name: routeName,
          distanceM: dist || 12000,
          durationEstS: duration || 2400,
          difficulty: RouteDifficulty.MEDIUM,
          polyline,
          geojson: geojsonToStore,
          gpx: gpxContent,
          bbox: bboxLocal,
          payload: finalPayload,
          version: 1,
          isActive: true,
        } as Route);

        console.log(`Loaded GPX route from ${gpxFile} with ${coords.length} points`);
      } catch (err) {
        console.warn(`Failed to load route from ${gpxFile}:`, err);
      }
    }
  } else {
    console.warn('Seed routes directory not found');
  }

  const centreProduct: Partial<Product> = {
    type: ProductType.CENTRE_PACK,
    pricePence: 1000,
    period: ProductPeriod.NONE,
    iosProductId: 'centre_colchester_ios',
    androidProductId: 'centre_colchester_android',
    active: true,
    metadata: { centreId: savedCentres[0].id, scope: 'CENTRE' },
  };

  const weeklySubscription: Partial<Product> = {
    type: ProductType.SUBSCRIPTION,
    pricePence: 1000,
    period: ProductPeriod.WEEK,
    iosProductId: 'centre_colchester_week_ios',
    androidProductId: 'centre_colchester_week_android',
    active: true,
    metadata: { centreId: savedCentres[0].id, scope: 'CENTRE' },
  };

  const monthlySubscription: Partial<Product> = {
    type: ProductType.SUBSCRIPTION,
    pricePence: 2900,
    period: ProductPeriod.MONTH,
    iosProductId: 'centre_colchester_month_ios',
    androidProductId: 'centre_colchester_month_android',
    active: true,
    metadata: { centreId: savedCentres[0].id, scope: 'CENTRE' },
  };

  const quarterSubscription: Partial<Product> = {
    type: ProductType.SUBSCRIPTION,
    pricePence: 4900,
    period: ProductPeriod.QUARTER,
    iosProductId: 'centre_colchester_quarter_ios',
    androidProductId: 'centre_colchester_quarter_android',
    active: true,
    metadata: { centreId: savedCentres[0].id, scope: 'CENTRE' },
  };

  await productRepo.save([centreProduct, weeklySubscription, monthlySubscription, quarterSubscription] as Product[]);

  console.log('Seed complete');
  await dataSource.destroy();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

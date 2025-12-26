import 'reflect-metadata';
import dataSource from '../database/typeorm.config';
import { TestCentre } from '../entities/test-centre.entity';
import { Route, RouteDifficulty } from '../entities/route.entity';
import { Product, ProductPeriod, ProductType } from '../entities/product.entity';
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
  // Prefer the longest <trkseg> in the GPX to avoid mixing multiple tracks
  const segRegex = /<trkseg[^>]*>([\s\S]*?)<\/trkseg>/gi;
  let segMatch: RegExpExecArray | null;
  let best: number[][] = [];
  while ((segMatch = segRegex.exec(gpx)) !== null) {
    const seg = segMatch[1];
    const pts: number[][] = [];
    const ptRegex = /<trkpt[^>]*lat="([0-9.+-]+)"[^>]*lon="([0-9.+-]+)"/g;
    let ptMatch: RegExpExecArray | null;
    while ((ptMatch = ptRegex.exec(seg)) !== null) {
      pts.push([Number(ptMatch[2]), Number(ptMatch[1])]); // [lng, lat]
    }
    if (pts.length > best.length) best = pts;
  }

  if (best.length) return best;

  // Fallback: all points in file
  const fallbackPts: number[][] = [];
  const fallbackRegex = /<trkpt[^>]*lat="([0-9.+-]+)"[^>]*lon="([0-9.+-]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = fallbackRegex.exec(gpx)) !== null) {
    fallbackPts.push([Number(match[2]), Number(match[1])]); // [lng, lat]
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

async function run() {
  await dataSource.initialize();
  const centreRepo = dataSource.getRepository(TestCentre);
  const routeRepo = dataSource.getRepository(Route);
  const productRepo = dataSource.getRepository(Product);

  // Clean tables in FK-safe order
  await routeRepo.query('TRUNCATE practice_sessions, route_stats, tracks, cashback_claims, routes RESTART IDENTITY CASCADE');
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
    // Insert with raw geo expression then reload the row
    const insertResult = await centreRepo.query(
      `INSERT INTO test_centres (name, address, postcode, city, country, lat, lng, geo)
       VALUES ($1, $2, $3, $4, $5, $6, $7, ST_SetSRID(ST_MakePoint($7, $6), 4326))
       RETURNING *`,
      [centre.name, centre.address, centre.postcode, centre.city, centre.country, centre.lat, centre.lng],
    );
    savedCentres.push(insertResult[0] as TestCentre);
  }

  const colchesterRouteCoords: number[][] = [];

  // Optional: load additional routes from files in src/seed/routes
  const routesDir = path.join(__dirname, 'routes');
  if (fs.existsSync(routesDir)) {
    const files = fs.readdirSync(routesDir);
    const gpxFiles = files.filter((f) => f.toLowerCase().endsWith('.gpx'));
    for (const gpxFile of gpxFiles) {
      try {
        const gpxPath = path.join(routesDir, gpxFile);
        const gpxContent = fs.readFileSync(gpxPath, 'utf8');
        const base = gpxFile.replace(/\\.gpx$/i, '');
        const routeNumberMatch = base.match(/(\\d+)/);
        const routeNumber = routeNumberMatch ? routeNumberMatch[1] : null;
        const routeName = routeNumber
          ? `Colchester Test Route ${routeNumber}`
          : 'Colchester Test Route';
        const geojsonPath = path.join(routesDir, `${base}.geojson`);
        let geojsonContent: any = null;
        if (fs.existsSync(geojsonPath)) {
          geojsonContent = JSON.parse(fs.readFileSync(geojsonPath, 'utf8'));
        }
        let coords: number[][] = [];
        if (geojsonContent) coords = coordsFromGeoJson(geojsonContent);
        if (!coords.length) coords = coordsFromGpx(gpxContent);
        if (!coords.length) coords = colchesterRouteCoords;

        const bboxLocal = computeBbox(coords);
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
        const duration = Math.round(dist / (30 * (1000 / 3600))); // 30 km/h estimate

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
          version: 1,
          isActive: true,
        } as Route);
        console.log(`Loaded GPX route from ${gpxFile} with ${coords.length} points`);
      } catch (err) {
        console.warn(`Failed to load route from ${gpxFile}:`, err);
      }
    }
  }

  // Products: centre pack + centre-scoped subscriptions
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

  await productRepo.save(
    [centreProduct, weeklySubscription, monthlySubscription, quarterSubscription] as Product[],
  );
  console.log('Seed complete');
  await dataSource.destroy();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

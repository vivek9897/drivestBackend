import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { User } from '../../entities/user.entity';
import { TestCentre } from '../../entities/test-centre.entity';
import { Route, RouteDifficulty } from '../../entities/route.entity';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User) private usersRepo: Repository<User>,
    @InjectRepository(TestCentre) private centreRepo: Repository<TestCentre>,
    @InjectRepository(Route) private routeRepo: Repository<Route>,
  ) {}

  async getStats() {
    const users = await this.usersRepo.count();
    return { users };
  }

  async createRouteFromGpx(
    centreId: string | null,
    gpx: string,
    meta?: { centreName?: string; postcode?: string; routeName?: string },
  ) {
    const coords = this.coordsFromGpx(gpx);
    if (!coords.length) throw new BadRequestException('No coordinates found in GPX');

    const centre = centreId
      ? await this.centreRepo.findOne({ where: { id: centreId } })
      : await this.findOrCreateCentreFromGpx(coords, meta);
    if (!centre) throw new NotFoundException('Centre not found');

    const bbox = this.computeBbox(coords);
    const distanceM = this.distanceMeters(coords);
    const durationEstS = Math.round(distanceM / (30 * (1000 / 3600)));

    const gpxHash = this.hashGpx(gpx);
    const existingSame = await this.routeRepo.findOne({ where: { centreId: centre.id, gpxHash } as any });
    if (existingSame) return existingSame;

    const existingCount = await this.routeRepo.count({ where: { centreId: centre.id } });
    const nextNum = existingCount + 1;
    const baseName = centre.name;
    const routeName = meta?.routeName?.trim()
      ? meta.routeName.trim()
      : `${baseName} ${nextNum}`;

    const geojson = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { name: routeName, description: `Uploaded ${new Date().toISOString()}` },
          geometry: { type: 'LineString', coordinates: coords },
        },
      ],
    };

    const route = this.routeRepo.create({
      centreId: centre.id,
      name: routeName,
      distanceM: distanceM || 12000,
      durationEstS: durationEstS || 2400,
      difficulty: RouteDifficulty.MEDIUM,
      polyline: JSON.stringify(coords),
      geojson,
      gpx,
      gpxHash,
      bbox,
      version: 1,
      isActive: true,
    });
    return this.routeRepo.save(route);
  }

  private coordsFromGpx(gpx: string): number[][] {
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
    const all: number[][] = [];
    const fallbackRegex = /<trkpt[^>]*lat="([0-9.+-]+)"[^>]*lon="([0-9.+-]+)"/g;
    let match: RegExpExecArray | null;
    while ((match = fallbackRegex.exec(gpx)) !== null) {
      all.push([Number(match[2]), Number(match[1])]);
    }
    return all;
  }

  private async findOrCreateCentreFromGpx(
    coords: number[][],
    meta?: { centreName?: string; postcode?: string },
  ) {
    const centreName = meta?.centreName?.trim() || 'Unknown Test Centre';
    const existing = await this.centreRepo.findOne({
      where: { name: ILike(centreName) },
    });
    if (existing) return existing;

    const [lng, lat] = coords[0];
    const insertResult = await this.centreRepo.query(
      `INSERT INTO test_centres (name, address, postcode, city, country, lat, lng, geo)
       VALUES ($1, $2, $3, $4, $5, $6, $7, ST_SetSRID(ST_MakePoint($7, $6), 4326))
       RETURNING *`,
      [
        centreName,
        'Uploaded GPX route',
        meta?.postcode?.trim() || 'UNKNOWN',
        centreName,
        'UK',
        lat,
        lng,
      ],
    );
    return insertResult[0] as TestCentre;
  }

  // centre name and postcode are required via admin UI when creating a new centre

  private computeBbox(coords: number[][]) {
    const box = coords.reduce(
      (acc, [lng, lat]) => ({
        minLat: Math.min(acc.minLat, lat),
        maxLat: Math.max(acc.maxLat, lat),
        minLng: Math.min(acc.minLng, lng),
        maxLng: Math.max(acc.maxLng, lng),
      }),
      { minLat: 90, maxLat: -90, minLng: 180, maxLng: -180 },
    );
    return { minLat: box.minLat, maxLat: box.maxLat, minLng: box.minLng, maxLng: box.maxLng };
  }

  private distanceMeters(coords: number[][]) {
    if (coords.length < 2) return 0;
    let d = 0;
    for (let i = 0; i < coords.length - 1; i++) {
      d += this.haversine(coords[i], coords[i + 1]);
    }
    return Math.round(d);
  }

  private haversine(a: number[], b: number[]) {
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
  }

  private hashGpx(gpx: string) {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(gpx).digest('hex');
  }
}

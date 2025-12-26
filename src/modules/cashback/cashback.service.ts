import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CashbackClaim,
  CashbackStatus,
} from '../../entities/cashback-claim.entity';
import { SubmitCashbackDto } from './dto/submit-cashback.dto';
import { Track, TrackType } from '../../entities/track.entity';
import { Route } from '../../entities/route.entity';

@Injectable()
export class CashbackService {
  constructor(
    @InjectRepository(CashbackClaim)
    private cashbackRepo: Repository<CashbackClaim>,
    @InjectRepository(Track)
    private trackRepo: Repository<Track>,
    @InjectRepository(Route)
    private routeRepo: Repository<Route>,
  ) {}

  async start(userId: string) {
    const existing = await this.cashbackRepo.findOne({ where: { userId } });
    if (existing) {
      throw new ConflictException('Cashback already claimed');
    }
    const claim = this.cashbackRepo.create({ userId });
    return this.cashbackRepo.save(claim);
  }

  async submit(userId: string, dto: SubmitCashbackDto) {
    const claim = await this.cashbackRepo.findOne({ where: { userId } });
    if (!claim) throw new NotFoundException('No cashback claim');
    if (claim.status !== CashbackStatus.PENDING) {
      throw new ConflictException('Cashback already processed');
    }

    // If GPX present, parse and upsert route geometry
    if (dto.gpx && (dto.centreId || dto.routeId)) {
      await this.upsertRouteFromGpx(userId, dto);
    }

    const suspicious = this.isSuspicious(dto.trackSummary);
    claim.suspicious = suspicious;
    claim.status = suspicious ? CashbackStatus.PENDING : CashbackStatus.APPROVED;
    claim.approvedAt = suspicious ? null : new Date();
    if (dto.testDateTime) {
      const parsed = new Date(dto.testDateTime);
      if (!isNaN(parsed.getTime())) {
        claim.testScheduledAt = parsed;
      }
    }
    await this.cashbackRepo.save(claim);

    await this.trackRepo.save({
      userId,
      routeId: dto.routeId ?? null,
      type: TrackType.CASHBACK,
      pointsS3Key: dto.pointsS3Key ?? null,
      summary: dto.trackSummary,
    });

    return claim;
  }

  async status(userId: string) {
    const claim = await this.cashbackRepo.findOne({ where: { userId } });
    return claim ?? { status: 'NONE' };
  }

  private isSuspicious(summary: any): boolean {
    if (!summary) return true;
    const durationS = summary.durationS ?? 0;
    const distanceM = summary.distanceM ?? 0;
    if (durationS < 300 || distanceM < 1000) return true;
    const avgSpeed = summary.avgSpeedKph ?? (distanceM / 1000) / (durationS / 3600);
    if (avgSpeed <= 0 || avgSpeed > 120) return true;
    if (summary.points && Array.isArray(summary.points)) {
      for (let i = 1; i < summary.points.length; i++) {
        const prev = summary.points[i - 1];
        const curr = summary.points[i];
        const timeDelta = (curr.t ?? 0) - (prev.t ?? 0);
        if (timeDelta > 0) {
          const distance = this.haversine(prev.lat, prev.lng, curr.lat, curr.lng);
          const speed = distance / (timeDelta / 3600);
          if (speed > 150) return true;
        }
      }
    }
    return false;
  }

  private haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const toRad = (v: number) => (v * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const R = 6371; // km
    return R * c;
  }

  private async upsertRouteFromGpx(userId: string, dto: SubmitCashbackDto) {
    const coords = this.coordsFromGpx(dto.gpx!);
    if (!coords.length) return;
    const bbox = this.computeBbox(coords);
    const distanceM = this.distanceMeters(coords);
    const durationEstS = Math.max(300, Math.round(distanceM / (30 * (1000 / 3600))));

    let centreId = dto.centreId || null;
    if (!centreId && dto.routeId) {
      const existingRoute = await this.routeRepo.findOne({ where: { id: dto.routeId } });
      centreId = existingRoute?.centreId || null;
    }

    // Find similar route for this centre
    let targetRoute: Route | null = null;
    if (centreId) {
      const routes = await this.routeRepo.find({ where: { centreId } });
      for (const r of routes) {
        const existingCoords = this.coordsFromPolyline(r.polyline);
        if (existingCoords.length && this.isSimilarRoute(coords, existingCoords)) {
          targetRoute = r;
          break;
        }
      }
    }

    const geojsonToStore = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { name: 'User submitted', description: `Cashback upload ${new Date().toISOString()}` },
          geometry: { type: 'LineString', coordinates: coords },
        },
      ],
    };

    if (targetRoute) {
      targetRoute.geojson = geojsonToStore;
      targetRoute.gpx = dto.gpx ?? null;
      targetRoute.polyline = JSON.stringify(coords);
      targetRoute.bbox = bbox;
      targetRoute.distanceM = distanceM;
      targetRoute.durationEstS = durationEstS;
      await this.routeRepo.save(targetRoute);
    } else if (centreId) {
      await this.routeRepo.save({
        centreId,
        name: `User Route ${new Date().toISOString()}`,
        distanceM,
        durationEstS,
        difficulty: 'MEDIUM',
        polyline: JSON.stringify(coords),
        geojson: geojsonToStore,
        gpx: dto.gpx,
        bbox,
        version: 1,
        isActive: true,
      } as Route);
    }
  }

  private coordsFromPolyline(polyline: string | null): number[][] {
    if (!polyline) return [];
    try {
      const coords = JSON.parse(polyline);
      return Array.isArray(coords) ? coords : [];
    } catch {
      return [];
    }
  }

  private coordsFromGpx(gpx: string): number[][] {
    const segRegex = /<trkseg[^>]*>([\s\S]*?)<\/trkseg>/gi;
    const ptRegex = /<trkpt[^>]*lat="([0-9.+-]+)"[^>]*lon="([0-9.+-]+)"/g;
    let best: number[][] = [];
    let segMatch: RegExpExecArray | null;
    while ((segMatch = segRegex.exec(gpx)) !== null) {
      const seg = segMatch[1];
      const pts: number[][] = [];
      let ptMatch: RegExpExecArray | null;
      while ((ptMatch = ptRegex.exec(seg)) !== null) {
        pts.push([Number(ptMatch[2]), Number(ptMatch[1])]);
      }
      if (pts.length > best.length) best = pts;
    }
    if (best.length) return best;
    const all: number[][] = [];
    let match: RegExpExecArray | null;
    while ((match = ptRegex.exec(gpx)) !== null) {
      all.push([Number(match[2]), Number(match[1])]);
    }
    return all;
  }

  private computeBbox(coords: number[][]) {
    return coords.reduce(
      (acc, [lng, lat]) => ({
        minLat: Math.min(acc.minLat, lat),
        maxLat: Math.max(acc.maxLat, lat),
        minLng: Math.min(acc.minLng, lng),
        maxLng: Math.max(acc.maxLng, lng),
      }),
      { minLat: 90, maxLat: -90, minLng: 180, maxLng: -180 },
    );
  }

  private distanceMeters(coords: number[][]) {
    if (coords.length < 2) return 0;
    let d = 0;
    for (let i = 0; i < coords.length - 1; i++) {
      d += this.haversine(coords[i][1], coords[i][0], coords[i + 1][1], coords[i + 1][0]) * 1000;
    }
    return Math.round(d);
  }

  private isSimilarRoute(newCoords: number[][], existing: number[][]): boolean {
    if (!existing.length) return false;
    const sample = [newCoords[0], newCoords[Math.floor(newCoords.length / 2)], newCoords[newCoords.length - 1]];
    let total = 0;
    for (const p of sample) {
      let best = Infinity;
      for (const e of existing) {
        const d = this.haversine(p[1], p[0], e[1], e[0]) * 1000;
        if (d < best) best = d;
        if (best < 50) break;
      }
      total += best;
    }
    const avg = total / sample.length;
    return avg < 150; // within 150m average to consider similar
  }
}

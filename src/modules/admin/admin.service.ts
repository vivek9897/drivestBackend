import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { User } from '../../entities/user.entity';
import { TestCentre } from '../../entities/test-centre.entity';
import { Route, RouteDifficulty } from '../../entities/route.entity';

interface RouteCoordinate {
  lat: number;
  lon: number;
}

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

  /**
   * Simplified Route LED approach:
   * - Extract coordinates from GPX
   * - Require centreId (no auto-creation)
   * - Store only: coordinates, distance, duration
   * - Skip: gpxHash, geojson, duplicate checking, gpx storage
   */
  async createRouteFromGpx(
    centreId: string,
    gpx: string,
    meta?: { routeName?: string },
  ) {
    if (!centreId) {
      throw new BadRequestException('centreId is required. Centre must be created first via admin UI.');
    }

    // Verify centre exists
    const centre = await this.centreRepo.findOne({ where: { id: centreId } });
    if (!centre) throw new NotFoundException('Test centre not found');

    // Extract coordinates from GPX
    const coords = this.coordsFromGpx(gpx);
    if (!coords.length) throw new BadRequestException('No valid coordinates found in GPX file');

    // Calculate metrics
    const distanceM = this.calculateDistance(coords);
    const durationEstS = Math.round((distanceM / 1000) * 5 * 60); // Assume 12 km/h average

    // Generate route name
    const existingCount = await this.routeRepo.count({ where: { centreId } });
    const routeName = meta?.routeName?.trim() || `${centre.name} Route ${existingCount + 1}`;

    // Create route with simplified fields (Route LED approach)
    const route = this.routeRepo.create({
      centreId,
      name: routeName,
      distanceM: distanceM || 5000,
      durationEstS: durationEstS || 1800,
      difficulty: RouteDifficulty.MEDIUM,
      // IMPORTANT: New Route LED approach - store coordinates, not polyline/geojson/gpx
      coordinates: coords.map(([lon, lat]) => ({ lat, lon })),
      polyline: null, // Can be removed in future migration
      geojson: null,  // Can be removed in future migration
      gpx: null,      // Can be removed in future migration
      gpxHash: null,  // Can be removed in future migration
      version: 1,
      isActive: true,
    });

    return this.routeRepo.save(route);
  }

  /**
   * Extract coordinates from GPX
   * Returns array of [longitude, latitude] pairs (GeoJSON convention)
   */
  private coordsFromGpx(gpx: string): Array<[number, number]> {
    // Try to find best track segment
    const segRegex = /<trkseg[^>]*>([\s\S]*?)<\/trkseg>/gi;
    let segMatch: RegExpExecArray | null;
    let bestSegment: Array<[number, number]> = [];

    while ((segMatch = segRegex.exec(gpx)) !== null) {
      const segment = segMatch[1];
      const points: Array<[number, number]> = [];
      const ptRegex = /<trkpt[^>]*lat="([0-9.+-]+)"[^>]*lon="([0-9.+-]+)"/g;
      let ptMatch: RegExpExecArray | null;

      while ((ptMatch = ptRegex.exec(segment)) !== null) {
        const lat = Number(ptMatch[1]);
        const lon = Number(ptMatch[2]);
        // Validate coordinates
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
        if (Math.abs(lat) > 90 || Math.abs(lon) > 180) continue;
        points.push([lon, lat]);
      }

      if (points.length > bestSegment.length) {
        bestSegment = points;
      }
    }

    if (bestSegment.length) return bestSegment;

    // Fallback: parse all trkpt elements
    const allPoints: Array<[number, number]> = [];
    const fallbackRegex = /<trkpt[^>]*lat="([0-9.+-]+)"[^>]*lon="([0-9.+-]+)"/g;
    let match: RegExpExecArray | null;

    while ((match = fallbackRegex.exec(gpx)) !== null) {
      const lat = Number(match[1]);
      const lon = Number(match[2]);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      if (Math.abs(lat) > 90 || Math.abs(lon) > 180) continue;
      allPoints.push([lon, lat]);
    }

    return allPoints;
  }

  /**
   * Calculate distance using Haversine formula
   */
  private calculateDistance(coords: Array<[number, number]>): number {
    if (coords.length < 2) return 0;

    let totalDistance = 0;
    for (let i = 0; i < coords.length - 1; i++) {
      totalDistance += this.haversine(coords[i], coords[i + 1]);
    }

    return Math.round(totalDistance);
  }

  /**
   * Haversine formula to calculate distance between two points
   * Input: [longitude, latitude]
   */
  private haversine(from: [number, number], to: [number, number]): number {
    const toRad = (degrees: number) => (degrees * Math.PI) / 180;
    const earthRadius = 6371000; // meters

    const [lon1, lat1] = from;
    const [lon2, lat2] = to;

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return earthRadius * c;
  }
}

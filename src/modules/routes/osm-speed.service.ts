import { Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";

export type OsmSnap = {
  osm_id: number;
  highway: string | null;
  name: string | null;
  dist_m: number;
  maxspeed_raw: string | null;
};

export type SpeedSource =
  | "osm"
  | "osm_nearby"
  | "osm_nsl"
  | "inferred_roadclass"
  | "none";

export type OsmSpeedResult = {
  mph: number | null;
  speed_source: SpeedSource;
  speed_limit_confidence: number;
  maxspeed_raw: string | null;

  snapped: OsmSnap | null;
  matched: OsmSnap | null;
};

export type OsmControlType = "traffic_signals" | "stop" | "give_way";

export type OsmControlHit = {
  type: OsmControlType;
  dist_m: number;
  osm_id: number;
};

@Injectable()
export class OsmSpeedService {
  constructor(private readonly dataSource: DataSource) {}

  private roadClassFallbackMph(highway: string | null): number | null {
    if (!highway) return null;

    const h = String(highway).toLowerCase();

    if (h === "motorway") return 70;
    if (h === "motorway_link") return 50;

    if (h === "trunk") return 60;
    if (h === "trunk_link") return 50;

    if (h === "primary") return 50;
    if (h === "primary_link") return 40;

    if (h === "secondary") return 40;
    if (h === "secondary_link") return 30;

    if (h === "tertiary") return 30;
    if (h === "tertiary_link") return 30;

    if (h === "residential") return 30;
    if (h === "unclassified") return 30;

    if (h === "service") return 20;
    if (h === "living_street") return 20;

    if (h === "track") return 15;

    return null;
  }

  async snapToRoad(lon: number, lat: number, radiusM = 120): Promise<OsmSnap | null> {
    const sql = `
      SELECT
        l.osm_id AS osm_id,
        l.highway AS highway,
        l.name AS name,
        (l.tags -> 'maxspeed') AS maxspeed,
        ST_Distance(l.way, p.geom) AS dist_m
      FROM planet_osm_line l
      CROSS JOIN (
        SELECT ST_Transform(
          ST_SetSRID(ST_MakePoint($1, $2), 4326),
          3857
        ) AS geom
      ) p
      WHERE l.highway IS NOT NULL
        AND ST_DWithin(l.way, p.geom, $3)
      ORDER BY l.way <-> p.geom
      LIMIT 1;
    `;

    const rows = await this.dataSource.query(sql, [lon, lat, radiusM]);
    if (!rows?.length) return null;

    const r = rows[0];
    return {
      osm_id: Number(r.osm_id),
      highway: r.highway ?? null,
      name: r.name ?? null,
      maxspeed_raw: r.maxspeed ?? null,
      dist_m: Math.round(Number(r.dist_m) || 0),
    };
  }

  async nearestSpeedTaggedRoad(lon: number, lat: number, radiusM = 120): Promise<OsmSnap | null> {
    const sql = `
      SELECT
        l.osm_id AS osm_id,
        l.highway AS highway,
        l.name AS name,
        (l.tags -> 'maxspeed') AS maxspeed,
        ST_Distance(l.way, p.geom) AS dist_m
      FROM planet_osm_line l
      CROSS JOIN (
        SELECT ST_Transform(
          ST_SetSRID(ST_MakePoint($1, $2), 4326),
          3857
        ) AS geom
      ) p
      WHERE l.highway IS NOT NULL
        AND (
          (l.tags ? 'maxspeed')
          OR (l.tags ? 'maxspeed:forward')
          OR (l.tags ? 'maxspeed:backward')
          OR (l.tags ? 'maxspeed:type')
          OR (l.tags ? 'maxspeed:conditional')
        )
        AND ST_DWithin(l.way, p.geom, $3)
      ORDER BY l.way <-> p.geom
      LIMIT 1;
    `;

    const rows = await this.dataSource.query(sql, [lon, lat, radiusM]);
    if (!rows?.length) return null;

    const r = rows[0];
    return {
      osm_id: Number(r.osm_id),
      highway: r.highway ?? null,
      name: r.name ?? null,
      maxspeed_raw: r.maxspeed ?? null,
      dist_m: Math.round(Number(r.dist_m) || 0),
    };
  }

  async getSpeedAtPoint(lon: number, lat: number, radiusM = 120): Promise<OsmSpeedResult> {
    const snap = await this.snapToRoad(lon, lat, radiusM);

    const snapSql = `
      SELECT
        (l.tags -> 'maxspeed') AS maxspeed,
        (l.tags -> 'maxspeed:forward') AS maxspeed_forward,
        (l.tags -> 'maxspeed:backward') AS maxspeed_backward,
        (l.tags -> 'maxspeed:type') AS maxspeed_type,
        (l.tags -> 'maxspeed:conditional') AS maxspeed_conditional
      FROM planet_osm_line l
      WHERE l.osm_id = $1
      LIMIT 1;
    `;

    if (snap?.osm_id) {
      const rows = await this.dataSource.query(snapSql, [snap.osm_id]);
      const t = rows?.[0] ?? null;

      const candidates: Array<{ raw: any; source: SpeedSource }> = [
        { raw: t?.maxspeed, source: "osm" },
        { raw: t?.maxspeed_forward, source: "osm" },
        { raw: t?.maxspeed_backward, source: "osm" },
        { raw: t?.maxspeed_type, source: "osm" },
        { raw: t?.maxspeed_conditional, source: "osm" },
      ];

      for (const c of candidates) {
        const parsed = parseOsmMaxspeedToMph(c.raw);
        if (parsed != null) {
          const isNsl = String(c.raw ?? "").toLowerCase().startsWith("gb:");
          const src: SpeedSource = isNsl ? "osm_nsl" : c.source;

          const base = src === "osm_nsl" ? 0.92 : 0.95;
          const conf = clamp01(base - (snap.dist_m / 300));

          return {
            mph: parsed,
            speed_source: src,
            speed_limit_confidence: conf,
            maxspeed_raw: String(c.raw),
            snapped: snap,
            matched: snap,
          };
        }
      }
    }

    const matched = await this.nearestSpeedTaggedRoad(lon, lat, radiusM);
    if (matched?.maxspeed_raw) {
      const mph = parseOsmMaxspeedToMph(matched.maxspeed_raw);
      if (mph != null) {
        const base = 0.85;
        const conf = clamp01(base - (matched.dist_m / 400));

        return {
          mph,
          speed_source: "osm_nearby",
          speed_limit_confidence: conf,
          maxspeed_raw: matched.maxspeed_raw,
          snapped: snap,
          matched,
        };
      }
    }

    const inferred = this.roadClassFallbackMph(snap?.highway ?? null);
    if (inferred != null) {
      return {
        mph: inferred,
        speed_source: "inferred_roadclass",
        speed_limit_confidence: 0.6,
        maxspeed_raw: null,
        snapped: snap,
        matched: snap,
      };
    }

    return {
      mph: null,
      speed_source: "none",
      speed_limit_confidence: 0,
      maxspeed_raw: null,
      snapped: snap,
      matched: null,
    };
  }

  async findControlsNearPoint(lon: number, lat: number, radiusM = 25, limit = 3): Promise<OsmControlHit[]> {
    const sql = `
      SELECT
        p.osm_id AS osm_id,
        p.highway AS highway,
        ST_Distance(p.way, q.geom) AS dist_m
      FROM planet_osm_point p
      CROSS JOIN (
        SELECT ST_Transform(
          ST_SetSRID(ST_MakePoint($1, $2), 4326),
          3857
        ) AS geom
      ) q
      WHERE p.highway IN ('traffic_signals','stop','give_way')
        AND ST_DWithin(p.way, q.geom, $3)
      ORDER BY p.way <-> q.geom
      LIMIT $4;
    `;

    const rows = await this.dataSource.query(sql, [lon, lat, radiusM, limit]);
    if (!rows?.length) return [];

    return rows.map((r: any) => ({
      type: r.highway as OsmControlType,
      dist_m: Math.round(Number(r.dist_m) || 0),
      osm_id: Number(r.osm_id),
    }));
  }
}

export function parseOsmMaxspeedToMph(raw: any): number | null {
  if (raw == null) return null;

  const s = String(raw).trim().toLowerCase();
  if (!s) return null;

  if (s.includes("signals")) return null;
  if (s.includes("variable")) return null;
  if (s.includes("none")) return null;

  if (s.startsWith("gb:nsl_single")) return 60;
  if (s.startsWith("gb:nsl_dual")) return 70;
  if (s.startsWith("gb:motorway")) return 70;

  const mphMatch = s.match(/^(\d{1,3})\s*(mph)?$/);
  if (mphMatch) {
    const v = Number(mphMatch[1]);
    return Number.isFinite(v) ? v : null;
  }

  const kmhMatch = s.match(/^(\d{1,3})\s*(km\/h|kmh|kph)$/);
  if (kmhMatch) {
    const v = Number(kmhMatch[1]);
    return Number.isFinite(v) ? Math.round(v * 0.621371) : null;
  }

  const firstNum = s.match(/(\d{1,3})/);
  if (firstNum) {
    const v = Number(firstNum[1]);
    if (!Number.isFinite(v)) return null;

    if (v <= 70) return v;
    return Math.round(v * 0.621371);
  }

  return null;
}

function clamp01(x: number) {
  if (!Number.isFinite(x)) return 0;
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

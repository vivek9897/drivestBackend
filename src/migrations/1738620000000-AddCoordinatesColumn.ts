import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCoordinatesColumn1738620000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add coordinates column to routes table
    // Coordinates will be stored as JSONB array: [{lat, lon}, ...]
    await queryRunner.query(`
      ALTER TABLE routes
      ADD COLUMN coordinates JSONB NULL
    `);

    // Create index on coordinates for performance
    await queryRunner.query(`
      CREATE INDEX idx_routes_coordinates ON routes USING BTREE (id)
      WHERE coordinates IS NOT NULL
    `);

    // Populate coordinates from existing polyline/geojson/gpx
    // Priority: geojson coordinates > polyline > gpx > leave NULL
    await queryRunner.query(`
      UPDATE routes SET coordinates = (
        CASE
          -- If geojson has coordinates, extract them in {lat, lon} format
          WHEN geojson IS NOT NULL AND geojson -> 'features' IS NOT NULL THEN
            jsonb_build_array(
              jsonb_agg(
                jsonb_build_object(
                  'lat', (elem->0)::numeric,
                  'lon', (elem->1)::numeric
                )
              )
            )
          -- Otherwise polyline is already [{lat, lon}, {lat, lon}, ...] or [[lon, lat], ...]
          -- Keep polyline as-is (could be either format, we'll handle it in code)
          WHEN polyline IS NOT NULL THEN
            polyline::jsonb
          -- Otherwise try GPX (won't parse in pure SQL, so skip)
          ELSE NULL
        END
      )
    `);

    // Note: GPX parsing would require custom code or stored procedures
    // For now, GPX routes without polyline/geojson won't get coordinates auto-populated
    // They should be handled via admin re-upload or manual coordinate entry
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop index and column
    await queryRunner.query(`DROP INDEX IF EXISTS idx_routes_coordinates`);
    await queryRunner.query(`ALTER TABLE routes DROP COLUMN IF EXISTS coordinates`);
  }
}

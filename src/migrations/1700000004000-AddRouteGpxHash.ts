import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRouteGpxHash1700000004000 implements MigrationInterface {
  name = 'AddRouteGpxHash1700000004000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "routes" ADD "gpxHash" character varying(64)`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_routes_gpx_hash" ON "routes" ("gpxHash")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_routes_gpx_hash"`);
    await queryRunner.query(`ALTER TABLE "routes" DROP COLUMN "gpxHash"`);
  }
}

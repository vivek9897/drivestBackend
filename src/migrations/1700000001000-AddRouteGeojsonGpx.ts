import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRouteGeojsonGpx1700000001000 implements MigrationInterface {
  name = 'AddRouteGeojsonGpx1700000001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "routes" ADD COLUMN "geojson" jsonb`);
    await queryRunner.query(`ALTER TABLE "routes" ADD COLUMN "gpx" text`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "routes" DROP COLUMN "gpx"`);
    await queryRunner.query(`ALTER TABLE "routes" DROP COLUMN "geojson"`);
  }
}

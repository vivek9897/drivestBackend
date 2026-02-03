import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCoordinatesColumn1738620000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "routes" ADD COLUMN IF NOT EXISTS "coordinates" jsonb`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "routes" DROP COLUMN IF EXISTS "coordinates"`
    );
  }
}


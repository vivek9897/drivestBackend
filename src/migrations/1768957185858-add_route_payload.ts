import { MigrationInterface, QueryRunner } from "typeorm";

export class AddRoutePayload1768957185858 implements MigrationInterface {
  name = "AddRoutePayload1768957185858";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "routes" ADD COLUMN IF NOT EXISTS "payload" jsonb`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "routes" DROP COLUMN IF EXISTS "payload"`);
  }
}

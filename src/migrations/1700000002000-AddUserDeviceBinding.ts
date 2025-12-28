import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserDeviceBinding1700000002000 implements MigrationInterface {
  name = 'AddUserDeviceBinding1700000002000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "users" ADD "activeDeviceId" character varying');
    await queryRunner.query('ALTER TABLE "users" ADD "activeDeviceAt" TIMESTAMP WITH TIME ZONE');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "users" DROP COLUMN "activeDeviceAt"');
    await queryRunner.query('ALTER TABLE "users" DROP COLUMN "activeDeviceId"');
  }
}

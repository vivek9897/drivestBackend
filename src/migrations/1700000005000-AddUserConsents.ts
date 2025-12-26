import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserConsents1700000005000 implements MigrationInterface {
  name = 'AddUserConsents1700000005000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "baseAcceptedAt" TIMESTAMPTZ`);
    await queryRunner.query(`ALTER TABLE "users" ADD "ageConfirmedAt" TIMESTAMPTZ`);
    await queryRunner.query(`ALTER TABLE "users" ADD "analyticsChoice" character varying`);
    await queryRunner.query(`ALTER TABLE "users" ADD "analyticsAt" TIMESTAMPTZ`);
    await queryRunner.query(`ALTER TABLE "users" ADD "notificationsChoice" character varying`);
    await queryRunner.query(`ALTER TABLE "users" ADD "notificationsAt" TIMESTAMPTZ`);
    await queryRunner.query(`ALTER TABLE "users" ADD "locationChoice" character varying`);
    await queryRunner.query(`ALTER TABLE "users" ADD "locationAt" TIMESTAMPTZ`);
    await queryRunner.query(`ALTER TABLE "users" ADD "safetyAcceptedAt" TIMESTAMPTZ`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "safetyAcceptedAt"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "locationAt"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "locationChoice"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "notificationsAt"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "notificationsChoice"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "analyticsAt"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "analyticsChoice"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "ageConfirmedAt"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "baseAcceptedAt"`);
  }
}

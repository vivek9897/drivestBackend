import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPushAndReminder1700000006000 implements MigrationInterface {
  name = 'AddPushAndReminder1700000006000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "expoPushToken" character varying`);
    await queryRunner.query(`ALTER TABLE "cashback_claims" ADD "reminderSentAt" TIMESTAMPTZ`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "cashback_claims" DROP COLUMN "reminderSentAt"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "expoPushToken"`);
  }
}

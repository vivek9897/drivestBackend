import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCashbackSchedule1700000002000 implements MigrationInterface {
  name = 'AddCashbackSchedule1700000002000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "cashback_claims" ADD "testScheduledAt" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "cashback_claims" DROP COLUMN "testScheduledAt"`);
  }
}

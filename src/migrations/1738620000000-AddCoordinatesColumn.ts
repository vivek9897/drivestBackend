import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCoordinatesColumn1738620000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // This migration is skipped - coordinates column already exists in the schema
    // The column is defined in the Route entity and will be created by TypeORM
    // No action needed
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // This migration is skipped, so no rollback action needed
  }
}


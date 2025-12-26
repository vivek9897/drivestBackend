import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitSchema1700000000000 implements MigrationInterface {
  name = 'InitSchema1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS postgis');

    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "email" character varying UNIQUE,
        "phone" character varying,
        "name" character varying NOT NULL,
        "passwordHash" character varying NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP WITH TIME ZONE
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "test_centres" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" character varying NOT NULL,
        "address" character varying NOT NULL,
        "postcode" character varying NOT NULL,
        "city" character varying NOT NULL,
        "country" character varying NOT NULL,
        "lat" double precision NOT NULL,
        "lng" double precision NOT NULL,
        "geo" geography(Point,4326) NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query('CREATE INDEX "IDX_centre_geo" ON "test_centres" USING GIST ("geo")');

    await queryRunner.query(`
      CREATE TABLE "routes" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "centreId" uuid NOT NULL,
        "name" character varying NOT NULL,
        "distanceM" integer NOT NULL,
        "durationEstS" integer NOT NULL,
        "difficulty" character varying NOT NULL,
        "polyline" text NOT NULL,
        "bbox" jsonb,
        "version" integer NOT NULL,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "FK_route_centre" FOREIGN KEY ("centreId") REFERENCES "test_centres"("id") ON DELETE CASCADE
      );
    `);
    await queryRunner.query('CREATE INDEX "IDX_route_centre" ON "routes"("centreId")');

    await queryRunner.query(`
      CREATE TABLE "products" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "type" character varying NOT NULL,
        "pricePence" integer NOT NULL,
        "period" character varying NOT NULL,
        "iosProductId" character varying NOT NULL,
        "androidProductId" character varying NOT NULL,
        "active" boolean NOT NULL DEFAULT true,
        "metadata" jsonb
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "purchases" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL,
        "productId" uuid NOT NULL,
        "provider" character varying NOT NULL,
        "status" character varying NOT NULL,
        "transactionId" character varying UNIQUE NOT NULL,
        "purchasedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "rawEvent" jsonb,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "FK_purchase_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_purchase_product" FOREIGN KEY ("productId") REFERENCES "products"("id")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "entitlements" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL,
        "scope" character varying NOT NULL,
        "centreId" uuid,
        "startsAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "endsAt" TIMESTAMP WITH TIME ZONE,
        "isActive" boolean NOT NULL DEFAULT true,
        "sourcePurchaseId" uuid,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "FK_entitlement_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_entitlement_purchase" FOREIGN KEY ("sourcePurchaseId") REFERENCES "purchases"("id")
      );
    `);
    await queryRunner.query('CREATE INDEX "IDX_entitlement_user_centre_ends" ON "entitlements"("userId", "centreId", "endsAt")');

    await queryRunner.query(`
      CREATE TABLE "practice_sessions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL,
        "routeId" uuid NOT NULL,
        "startedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "endedAt" TIMESTAMP WITH TIME ZONE,
        "completed" boolean NOT NULL DEFAULT false,
        "distanceM" integer,
        "durationS" integer,
        "xpEarned" integer,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "FK_session_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_session_route" FOREIGN KEY ("routeId") REFERENCES "routes"("id") ON DELETE CASCADE
      );
    `);
    await queryRunner.query('CREATE INDEX "IDX_session_user_route" ON "practice_sessions"("userId", "routeId")');

    await queryRunner.query(`
      CREATE TABLE "route_stats" (
        "userId" uuid NOT NULL,
        "routeId" uuid NOT NULL,
        "timesCompleted" integer NOT NULL DEFAULT 0,
        "bestTimeS" integer,
        "lastCompletedAt" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_route_stats" PRIMARY KEY ("userId", "routeId"),
        CONSTRAINT "FK_stats_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_stats_route" FOREIGN KEY ("routeId") REFERENCES "routes"("id") ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "cashback_claims" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" uuid UNIQUE NOT NULL,
        "status" character varying NOT NULL DEFAULT 'PENDING',
        "amountPence" integer NOT NULL DEFAULT 200,
        "suspicious" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "approvedAt" TIMESTAMP WITH TIME ZONE,
        "paidAt" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "FK_cashback_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "tracks" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL,
        "routeId" uuid,
        "type" character varying NOT NULL,
        "pointsS3Key" character varying,
        "summary" jsonb,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "FK_track_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_track_route" FOREIGN KEY ("routeId") REFERENCES "routes"("id") ON DELETE SET NULL
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "audit_logs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" uuid,
        "action" character varying NOT NULL,
        "metadata" jsonb,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "FK_audit_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "audit_logs"');
    await queryRunner.query('DROP TABLE IF EXISTS "tracks"');
    await queryRunner.query('DROP TABLE IF EXISTS "cashback_claims"');
    await queryRunner.query('DROP TABLE IF EXISTS "route_stats"');
    await queryRunner.query('DROP TABLE IF EXISTS "practice_sessions"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_entitlement_user_centre_ends"');
    await queryRunner.query('DROP TABLE IF EXISTS "entitlements"');
    await queryRunner.query('DROP TABLE IF EXISTS "purchases"');
    await queryRunner.query('DROP TABLE IF EXISTS "products"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_route_centre"');
    await queryRunner.query('DROP TABLE IF EXISTS "routes"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_centre_geo"');
    await queryRunner.query('DROP TABLE IF EXISTS "test_centres"');
    await queryRunner.query('DROP TABLE IF EXISTS "users"');
  }
}

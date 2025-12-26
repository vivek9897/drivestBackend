import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as request from 'supertest';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../modules/auth/auth.module';
import { UsersModule } from '../modules/users/users.module';
import { CentresModule } from '../modules/centres/centres.module';
import { RoutesModule } from '../modules/routes/routes.module';
import { EntitlementsModule } from '../modules/entitlements/entitlements.module';
import { CashbackModule } from '../modules/cashback/cashback.module';
import { WebhooksModule } from '../modules/webhooks/webhooks.module';
import { HealthModule } from '../modules/health/health.module';
import { User } from '../entities/user.entity';
import { TestCentre } from '../entities/test-centre.entity';
import { Route, RouteDifficulty } from '../entities/route.entity';
import { Product, ProductPeriod, ProductType } from '../entities/product.entity';
import { Purchase } from '../entities/purchase.entity';
import { Entitlement } from '../entities/entitlement.entity';
import { PracticeSession } from '../entities/practice-session.entity';
import { RouteStat } from '../entities/route-stat.entity';
import { CashbackClaim } from '../entities/cashback-claim.entity';
import { Track } from '../entities/track.entity';
import { AuditLog } from '../entities/audit-log.entity';
import { TransformInterceptor } from '../common/transform.interceptor';
import { HttpExceptionFilter } from '../common/http-exception.filter';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { createHmac } from 'crypto';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'testsecret';
process.env.JWT_EXPIRES_IN = '1d';
process.env.REVENUECAT_WEBHOOK_SECRET = 'revsecret';
jest.setTimeout(20000);

describe('Route Master API (e2e)', () => {
  let app: INestApplication;
  let module: TestingModule;
  let userRepo: Repository<User>;
  let centreRepo: Repository<TestCentre>;
  let routeRepo: Repository<Route>;
  let productRepo: Repository<Product>;
  let purchaseRepo: Repository<Purchase>;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          dropSchema: true,
          entities: [
            User,
            TestCentre,
            Route,
            Product,
            Purchase,
            Entitlement,
            PracticeSession,
            RouteStat,
            CashbackClaim,
            Track,
            AuditLog,
          ],
          synchronize: true,
        }),
        AuthModule,
        UsersModule,
        CentresModule,
        RoutesModule,
        EntitlementsModule,
        CashbackModule,
        WebhooksModule,
        HealthModule,
      ],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalInterceptors(new TransformInterceptor());
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();

    userRepo = module.get<Repository<User>>(getRepositoryToken(User));
    centreRepo = module.get<Repository<TestCentre>>(getRepositoryToken(TestCentre));
    routeRepo = module.get<Repository<Route>>(getRepositoryToken(Route));
    productRepo = module.get<Repository<Product>>(getRepositoryToken(Product));
    purchaseRepo = module.get<Repository<Purchase>>(getRepositoryToken(Purchase));
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('registers and logs in', async () => {
    const register = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'test@example.com', password: 'password', name: 'Test User' })
      .expect(201);
    expect(register.body.data.accessToken).toBeDefined();

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'test@example.com', password: 'password' })
      .expect(200);
    expect(login.body.data.accessToken).toBeDefined();
  });

  it('blocks download without entitlement', async () => {
    const register = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'ent@example.com', password: 'password', name: 'Ent User' });
    const token = register.body.data.accessToken;

    const centre = await centreRepo.save({
      name: 'Centre',
      address: 'addr',
      postcode: 'pc',
      city: 'city',
      country: 'UK',
      lat: 0,
      lng: 0,
      geo: 'POINT(0 0)' as any,
    });
    const route = await routeRepo.save({
      centreId: centre.id,
      name: 'R1',
      distanceM: 1000,
      durationEstS: 600,
      difficulty: RouteDifficulty.EASY,
      polyline: 'abc',
      bbox: {},
      version: 1,
      isActive: true,
    });

    await request(app.getHttpServer())
      .get(`/routes/${route.id}/download`)
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('enforces cashback once per lifetime', async () => {
    const register = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'cash@example.com', password: 'password', name: 'Cash User' });
    const token = register.body.data.accessToken;

    await request(app.getHttpServer())
      .post('/cashback/start')
      .set('Authorization', `Bearer ${token}`)
      .expect(201);

    await request(app.getHttpServer())
      .post('/cashback/start')
      .set('Authorization', `Bearer ${token}`)
      .expect(409);
  });

  it('treats revenuecat webhook idempotently', async () => {
    const user = await userRepo.save({
      email: 'rev@example.com',
      phone: null,
      name: 'Rev User',
      passwordHash: 'hash',
    });

    await productRepo.save({
      type: ProductType.SUBSCRIPTION,
      pricePence: 999,
      period: ProductPeriod.MONTH,
      iosProductId: 'prod_sub',
      androidProductId: 'prod_sub',
      active: true,
    });

    const body = {
      event_id: 'evt1',
      product_id: 'prod_sub',
      transaction_id: 'tx123',
      app_user_id: user.id,
      type: 'PURCHASED',
      purchased_at: new Date().toISOString(),
      expiration_at: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
    };
    const signature = createHmac('sha256', process.env.REVENUECAT_WEBHOOK_SECRET!)
      .update(JSON.stringify(body))
      .digest('hex');

    await request(app.getHttpServer())
      .post('/webhooks/revenuecat')
      .set('x-revenuecat-signature', signature)
      .send(body)
      .expect(201);

    await request(app.getHttpServer())
      .post('/webhooks/revenuecat')
      .set('x-revenuecat-signature', signature)
      .send(body)
      .expect(201);

    const purchases = await purchaseRepo.find({ where: { transactionId: 'tx123' } });
    expect(purchases).toHaveLength(1);
  });
});

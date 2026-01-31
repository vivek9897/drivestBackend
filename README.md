# Route Master Backend

Node.js 20 + NestJS API for the Route Master mobile app. Implements driving test centres, routes, entitlement gating, cashback, and RevenueCat webhooks.

## Stack
- NestJS (TypeScript)
- PostgreSQL 15 + PostGIS, TypeORM migrations
- Redis (optional, included in docker compose)
- JWT auth (bcrypt password hashing)
- Swagger auto-generated at `/docs`

## Quickstart
1. Copy env and adjust secrets:
   ```bash
   cp .env.example .env
   ```
2. Start infrastructure + API (hot reload):
   ```bash
   docker compose up --build
   ```
3. Install deps (if running locally):
   ```bash
   npm install
   ```
4. Run migrations:
   ```bash
   npm run migration:run
   ```
5. Seed demo data (10 centres, 3 routes each, products):
   ```bash
   npm run seed
   ```
6. Run tests:
   ```bash
   npm test
   ```
7. Start dev server outside docker (optional):
   ```bash
   npm run start:dev
   ```

## Important Commands
- `npm run migration:generate` – generate new migration
- `npm run migration:run` – run migrations (uses `DATABASE_URL`)
- `npm run seed` – seed demo data

## Business Logic Notes
- Route access requires either an active subscription (GLOBAL entitlement) or a purchased centre pack entitlement.
- Subscriptions expire immediately at `endsAt`.
- Practice finish increments `RouteStat.timesCompleted` and keeps best time.
- Cashback can be started once per user; submission auto-approves unless basic fraud checks flag it as suspicious (then stays `PENDING`).
- Account delete anonymizes user data and soft deletes.
- RevenueCat webhook is HMAC-validated (`x-revenuecat-signature`) and idempotent by `transactionId`.

## API Overview
- `GET /health`
- Auth: `POST /auth/register`, `POST /auth/login`, `GET /me`, `PATCH /me`, `DELETE /me`
- Centres: `GET /centres?query=&near=lat,lng&radiusKm=&page=&limit=`, `GET /centres/:id`, `GET /centres/:id/routes`
- Routes (auth + entitlement): `GET /routes/:id`, `GET /routes/:id/download`, `POST /routes/:id/practice/start`, `POST /routes/:id/practice/finish`
- Entitlements: `GET /entitlements`
- Cashback: `POST /cashback/start`, `POST /cashback/submit`, `GET /cashback/status`
- Webhooks: `POST /webhooks/revenuecat`

## Curl Examples
```bash
# Register
curl -X POST http://localhost:3000/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"me@example.com","password":"password","name":"Me"}'

# Login
TOKEN=$(curl -s -X POST http://localhost:3000/auth/login -H 'Content-Type: application/json' -d '{"email":"me@example.com","password":"password"}' | jq -r '.data.accessToken')

# List centres near a point
curl "http://localhost:3000/centres?near=51.5,-0.1&radiusKm=20" -H "Authorization: Bearer $TOKEN"

# Start cashback
curl -X POST http://localhost:3000/cashback/start -H "Authorization: Bearer $TOKEN"
```

## Assumptions
- RevenueCat webhook payload contains `product_id`, `transaction_id`, `app_user_id`, `purchased_at`, and `expiration_at` fields; signature is HMAC-SHA256 over the JSON body.
- For tests, SQLite is used with simplified geo storage; production uses PostGIS via migrations.
- Redis is available if you want to add caching/rate limits later (container included but not required).
- When running the API outside docker against the dockerized Postgres, change `DATABASE_URL` host to `localhost`.\n

## CI/CD Deployment

The backend includes automated CI/CD deployment to Google Cloud Platform using GitHub Actions.

### Setup
1. Follow the detailed setup guide in [`CI-CD-SETUP.md`](./CI-CD-SETUP.md)
2. Create GCP service account with appropriate permissions
3. Add `GCP_SA_KEY` secret to GitHub repository
4. Ensure your GCP VM has Node.js, PM2, and PostgreSQL client installed

### How It Works
- **Trigger**: Push to `main` branch affecting `backend/` directory
- **Process**: Build → Test → Deploy to GCP VM
- **Deployment**: Automatic dependency installation, database migration, and service restart

### Monitoring
```bash
# Check deployment status
pm2 status
pm2 logs routemaster-backend

# Test deployment
curl https://your-vm-ip/docs
```

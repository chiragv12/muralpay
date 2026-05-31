# muralpay

Mural Pay sandbox marketplace backend (NestJS) with PostgreSQL via Prisma.

### Prerequisites

- Node.js (see note below for Prisma)
- PostgreSQL 16+ locally or Docker (`docker compose up -d`)

Prisma is pinned to **v5** so installs work on Node **21**. Newer Prisma releases require Node **20.19+**, **22.12+**, or **24+**.

### Setup

```bash
cp .env.example .env
# set MURAL_* from Mural staging; adjust DATABASE_URL if needed

docker compose up -d

npm install
npm run prisma:migrate:deploy
npm run prisma:seed

npm run start:dev
```

- API explorer: `http://localhost:3000/docs`
- Regenerate OpenAPI spec: `npm run openapi` (writes [`openapi.json`](openapi.json))

### REST endpoints

| Method | Path | Description |
| ------ | ---- | ----------- |
| `GET` | `/` | Service metadata (`service` name and path to Swagger UI). |
| `GET` | `/products` | List active catalog products (seeded SKUs) with prices. |
| `POST` | `/orders` | Create a checkout order from line items (`productId` + `quantity`); returns totals and status `PENDING_PAYMENT`. |
| `GET` | `/orders/:id` | Order detail plus **USDC** payment instructions (merchant wallet, chain, amount) from Mural staging `GET /api/accounts`. |
| `POST` | `/webhooks/mural` | Mural webhook ingress: **`account_credited`** → PAID; **`payout_request`** → withdrawal status updates. |
| `GET` | `/merchant/orders` | Merchant view: orders with payment + optional withdrawal summary. |
| `GET` | `/merchant/orders/:id` | Merchant view: single order with payment confirmation. |
| `GET` | `/merchant/withdrawals` | List COP withdrawals (auto-created after payment). |
| `GET` | `/merchant/withdrawals/:id` | Single withdrawal status (`PENDING` → `SUBMITTED` → `COMPLETED`). |

**Webhooks**

1. Create a webhook in Mural staging subscribed to **`MURAL_ACCOUNT_BALANCE_ACTIVITY`** and **`PAYOUT_REQUEST`**, URL `https://<your-host>/webhooks/mural`.
2. Copy the **PEM public key** into **`MURAL_WEBHOOK_PUBLIC_KEY`** in `.env`.
3. For local dev with a tunnel: **`MURAL_WEBHOOK_SKIP_VERIFY=true`** (temporary only).

**`GET /orders/:id` notes**

- Use the **root-level `id`** from `POST /orders`, not a line item id.
- Requires valid Mural staging credentials; failures return **502** with `muralMessage`.

### End-to-end test flow

1. `GET /products` → pick a `productId`
2. `POST /orders` → save order `id`
3. `GET /orders/:id` → send exact **USDC** amount to `payToWalletAddress` (Amoy testnet)
4. Mural fires **`account_credited`** → order **PAID** → **COP payout** created automatically
5. `GET /merchant/orders/:id` and `GET /merchant/withdrawals` to confirm payment + withdrawal status

### Deploy (Docker)

```bash
docker build -t muralpay-api .
docker run -p 3000:3000 --env-file .env muralpay-api
```

On first deploy, run migrations against your hosted Postgres (`npm run prisma:migrate:deploy` in release phase or a one-off job).

Suggested free stack: **Render** or **Railway** (web service) + **Neon** or **Supabase** (Postgres).

### Current status

| Area | Status |
| ---- | ------ |
| Catalog + checkout (`GET /products`, `POST /orders`, `GET /orders/:id`) | Working |
| USDC payment detection via `account_credited` webhook | Working (amount match heuristic) |
| Auto COP withdrawal on PAID | Implemented (inline sandbox COP bank details) |
| Merchant order + withdrawal read APIs | Working |
| Webhook signature verification | Working when `MURAL_WEBHOOK_PUBLIC_KEY` set |
| OpenAPI JSON + Swagger | Generated |

**Known limitations**

- Payment matching uses **exact USDC amount** only; two pending orders with the same total may match the wrong one (oldest wins).
- COP recipient bank details are **hard-coded sandbox placeholders**, not a saved Counterparty/Payout Method.
- `paidAt` reflects `order.updatedAt`, not a dedicated payment timestamp.

### Future work

- Unique payable amounts (e.g. add random cent suffix) or explicit payment reference metadata.
- Persist Counterparty + COP Payout Method via Mural API; configure via env instead of inline details.
- Idempotency keys / webhook event dedup table (`eventId`).
- Dedicated `paidAt` column; audit log for status transitions.
- Auth on merchant routes (API key header).
- Integration tests with mocked Mural + webhook fixtures.
- CI deploy pipeline with migration step.

### Database scripts

| Script | Purpose |
| ------ | ------- |
| `npm run prisma:migrate:dev` | Create/apply migrations (dev) |
| `npm run prisma:migrate:deploy` | Apply migrations (CI/prod) |
| `npm run prisma:seed` | Upsert demo catalog products |
| `npm run prisma:studio` | Open Prisma Studio |

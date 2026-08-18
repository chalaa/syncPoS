# syncPoS

Machinery retail POS and management system built with Next.js, TypeScript, PostgreSQL, Drizzle ORM, and IndexedDB/Dexie for offline sales.

## Getting Started

Install dependencies:

```bash
pnpm install
```

Create local environment config:

```bash
cp .env.example .env
```

Start the local PostgreSQL database:

```bash
pnpm db:up
```

If Docker requires sudo on your machine:

```bash
sudo docker compose up -d postgres
```

Run database migrations:

```bash
pnpm db:migrate
```

Seed foundation data:

```bash
pnpm db:seed
```

Start the app:

```bash
pnpm dev
```

Open http://localhost:3000.

## Database

Local PostgreSQL settings:

```text
Database: syncpos
User: syncpos
Password: syncpos
Host port: 5433
Container port: 5432
URL: postgres://syncpos:syncpos@localhost:5433/syncpos
```

Useful commands:

```bash
pnpm db:up        # start PostgreSQL
pnpm db:down      # stop PostgreSQL
pnpm db:logs      # follow PostgreSQL logs
pnpm db:generate  # generate Drizzle migrations
pnpm db:migrate   # apply Drizzle migrations
pnpm db:seed      # seed company, users, roles, locations and device
pnpm db:studio    # open Drizzle Studio
```

## Project Plan

See [docs/implementation-plan.md](docs/implementation-plan.md) for the phased build plan.

## Stack

- Next.js + TypeScript
- PostgreSQL
- Drizzle ORM
- IndexedDB/Dexie
- Zod

## Validation

```bash
pnpm lint
pnpm build
```

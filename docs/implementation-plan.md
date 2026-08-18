# syncPoS Implementation Plan

This project should be built in controlled phases. The goal is to protect the inventory ledger, serial-number custody, payments, and offline sync before adding wider business features.

## Phase 0 - Project Foundation

Outcome: a clean Next.js application foundation.

- Create the Next.js app with TypeScript, App Router, Tailwind, ESLint, and `src/`.
- Install PostgreSQL/Drizzle dependencies.
- Add `.env.example`, Drizzle config, database client, and first schema draft.
- Add Dexie local database placeholders for offline POS.
- Review and approve the full database blueprint in `docs/database-design.md` before applying the first real migration.
- Apply the soft-delete policy from the database design: master/configuration records use `deleted_at`, while posted sales, stock movements, journal entries, sync records, and audit logs use reversal/status workflows instead of deletion.
- Confirm `pnpm lint` and `pnpm build` pass.

## Phase 1 - Architecture Proof

Outcome: prove the riskiest part before building every module.

- Register one display-shop device with a generated device ID.
- Store a small product catalog and stock projection locally in IndexedDB.
- Create an offline sale locally with sale lines, payment, stock deduction, and outbox event in one local transaction.
- Restart the browser and confirm the pending sale survives.
- Sync the same event repeatedly and confirm the central system applies it once.
- Simulate serial-number conflict and show a conflict state.
- Test receipt printing on the actual shop computer.

Exit gate: no full module development until offline sale durability, sync idempotency, restart recovery, and printing are proven on target hardware.

## Phase 2 - Core Master Data

Outcome: trusted setup data.

- Company settings: currency, timezone, fiscal/document rules.
- Locations: warehouses, display shops, stock areas, active/inactive status.
- Users, roles, permissions, location assignments, approval limits.
- Products: SKU, barcode, category, brand, model, unit, tracking mode.
- Serial assets: serial, engine, chassis, current custody state.
- Partners: customers, suppliers, contacts, credit terms.
- Import templates with validation and audit history.

## Phase 3 - Inventory Ledger

Outcome: every quantity is traceable.

- Stock movement header and line posting.
- Derived stock balance projection.
- Receipts, sales issues, returns, transfers, adjustments, counts.
- Serial custody rules.
- Negative-stock blocking.
- Stock card and as-of-date inventory reports.

## Phase 4 - Purchasing

Outcome: stock enters the business through controlled documents.

- Purchase requisition.
- Approval workflow.
- Purchase order and purchase order lines.
- Partial receipt and quality/serial capture.
- Landed-cost allocation.
- Supplier bill matching.
- Supplier returns.

## Phase 5 - Sales and Offline POS

Outcome: display shops can sell safely online or offline.

- Counter sale screen with barcode/product search.
- Serial selection for tracked machinery.
- Local available-to-sell validation.
- Cash and bank-transfer payment capture.
- Local receipt queue.
- Outbox/inbox synchronization.
- Conflict resolution for stale stock, duplicate serials, revoked permission, and closed period.
- Returns/refunds linked to original sale.

## Phase 6 - Transfers

Outcome: company stock can move between controlled locations.

- Transfer request.
- Manager approval.
- Source picking and dispatch.
- In-transit stock.
- Destination receipt and discrepancy handling.
- Partial dispatch and partial receipt.

## Phase 7 - Expenses and Accounting

Outcome: financial reporting becomes reliable.

- Employee expenses, attachments, policy checks, approval, reimbursement.
- Chart of accounts.
- Journal entries and journal lines.
- Period locks.
- AR/AP balances.
- Payment reconciliation.
- P&L reports from posted central entries only.

## Phase 8 - Analytics and Controls

Outcome: management can trust reports.

- Inventory dashboard.
- Sales and margin dashboard.
- Purchasing dashboard.
- Expense dashboard.
- Partner performance and aging.
- Sync-health dashboard.
- Audit log search.
- Export with filters, generation time, and user.

## Recommended Build Order

1. Foundation
2. Offline sync proof
3. Master data
4. Inventory ledger
5. Purchasing
6. Sales/POS
7. Transfers
8. Expenses/accounting
9. Analytics

For the detailed testable implementation sequence, use `docs/build-steps.md`.

## Do Not Build Yet

- Full workshop/service-center module.
- Advanced forecasting.
- E-commerce.
- Mobile app.
- Complex accounting/tax automation before local statutory requirements are confirmed.

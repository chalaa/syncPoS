# syncPoS Build Steps 2 - Offline POS and Sync

This plan starts only after the online/core business workflow in `docs/build-steps.md` is stable.

Do not implement offline first. Offline POS should reuse the same business rules already proven by the online sales, inventory, payment, and reporting flows.

## Rule Before Starting Offline

Offline work can start only after:

- online sales can create orders, deliveries, invoices, and payments
- purchase-to-payment flow works
- stock movements and balances reconcile
- product serial/lot tracking is stable
- payment methods and payment documents are stable
- reporting can reconcile stock, sales, payments, and expenses
- one online pilot flow has passed route and data tests

For every offline step:

1. central schema/API contract
2. local IndexedDB schema
3. local service logic
4. sync event contract
5. UI workflow
6. conflict/retry behavior
7. `pnpm exec tsc --noEmit`
8. `pnpm lint`

Do not run `pnpm build` during agent sessions.

## Step O1 - Device Registration and Assignment

Goal: control which shop computer can use offline POS.

Implement:

- device registration screen
- device activation/deactivation
- device assigned company/location
- device assigned user or role policy
- device status: active, inactive, revoked, replaced
- device last sync metadata

Test:

- inactive device cannot use offline APIs
- revoked device cannot sync
- device only sees assigned location data
- device replacement keeps audit trail

Exit criteria:

- every offline client is identified and controlled

## Step O2 - Offline Snapshot API

Goal: provide the browser with the minimum data needed to sell offline.

Implement:

- snapshot endpoint
- product payload
- category/brand/unit payload
- price list payload
- tax payload
- customer payload
- stock balance payload
- serial/lot availability payload
- payment method payload
- location and company settings payload
- cursor support for incremental snapshot

Test:

- inactive device cannot pull snapshot
- device receives only assigned location stock
- restricted user does not receive cost fields
- deleted/inactive products are excluded
- cursor returns only changed records

Exit criteria:

- offline POS can download controlled master and stock data

## Step O3 - IndexedDB Schema Foundation

Goal: store offline POS data reliably in the browser.

Implement Dexie stores:

- local_products
- local_categories
- local_brands
- local_units
- local_taxes
- local_customers
- local_stock_balances
- local_serials
- local_payment_methods
- local_sales
- local_sale_lines
- local_payments
- local_sync_outbox
- local_sync_inbox
- local_settings
- local_schema_meta

Test:

- snapshot saves locally
- browser refresh keeps data
- app restart keeps data
- money is stored as integer minor units
- quantities are stored as strings
- schema version can upgrade safely

Exit criteria:

- local database can survive normal browser restarts

## Step O4 - Offline POS Shell

Goal: create the offline-capable POS screen without final posting.

Implement:

- POS route
- product search
- barcode entry
- customer selector
- cart state
- quantity editing
- tax display
- total calculation
- payment panel placeholder
- offline/online status indicator

Test:

- POS screen opens from assigned device
- products load from IndexedDB
- barcode finds product
- cart survives tab switching and page refresh
- totals match online tax calculation rules

Exit criteria:

- cashier can prepare a local cart from offline data

## Step O5 - Local Stock and Serial Validation

Goal: prevent obvious offline stock mistakes before sync.

Implement:

- local available stock check
- serial selection for serial-tracked products
- lot selection for lot-tracked products
- local reservation inside draft sale
- duplicate serial protection inside IndexedDB
- blocked sale state when stock is unavailable

Test:

- cannot sell more than local available stock
- serial cannot be selected twice locally
- lot quantity cannot exceed local lot balance
- draft sale releases local reservation when cancelled

Exit criteria:

- local POS prevents common stock errors before central sync

## Step O6 - Offline Payment Capture

Goal: capture local payments safely.

Implement:

- cash payment
- bank transfer/payment reference
- mobile money reference
- multiple payment lines if needed
- paid/unpaid policy
- local payment validation

Test:

- payment total must match sale policy
- inactive payment method cannot be used
- reference required for non-cash methods if configured
- payment lines survive browser refresh

Exit criteria:

- local sale can carry valid payment data

## Step O7 - Offline Sale Creation

Goal: complete a counter sale without internet.

Implement:

- local sale number/provisional receipt
- local sale header
- local sale lines
- local payments
- local stock reservation/final local deduction projection
- outbox event creation in the same IndexedDB transaction
- printable local receipt view

Test:

- sale works while network is disabled
- pending sale survives browser restart
- outbox event is created exactly once
- local receipt can be reopened
- local stock projection changes after sale

Exit criteria:

- shop can create safe offline sales

## Step O8 - Sync Schema Migration

Goal: prepare central PostgreSQL to receive offline events.

Implement:

- sync_inbox
- sync_outbox
- sync_conflicts
- sync_idempotency/result fields
- device_number_blocks
- sync sequence fields
- sync source document links

Test:

- duplicate event_id is blocked or returns same result
- duplicate device sequence is blocked
- sequence gap is detected
- rejected event stores reason
- conflict case is created when needed

Exit criteria:

- central sync tables are ready

## Step O9 - Sale Sync Ingestion

Goal: upload offline sales to central PostgreSQL safely.

Implement one central transaction:

- insert or detect sync_inbox
- validate device, user, location, and sequence
- validate sale payload
- validate product/customer/payment method IDs
- lock stock balance and serial rows
- create central sale/order/invoice/payment documents based on online model
- post stock movement
- update stock balances
- append sync_outbox
- store deterministic sync result

Test:

- same event replay does not duplicate sale
- stale stock creates conflict
- duplicate serial creates conflict
- revoked device is rejected
- accepted sale updates central stock
- accepted sale creates central payment
- sync response updates local event status

Exit criteria:

- offline sales can safely become central sales

## Step O10 - Sync Client and Retry

Goal: make the browser sync outbox reliable.

Implement:

- sync queue processor
- retry with backoff
- online/offline detection
- sync status per event
- last successful sync metadata
- manual retry button
- conflict display

Test:

- network failure keeps event pending
- retry does not duplicate accepted sale
- conflict remains visible until resolved
- revoked device stops sync
- sync status survives refresh

Exit criteria:

- local outbox can recover from normal network interruptions

## Step O11 - Conflict Resolution

Goal: handle cases where offline data is no longer valid centrally.

Implement:

- conflict list
- conflict detail
- stale stock resolution
- duplicate serial resolution
- invalid payment method resolution
- cancelled/rejected sale workflow
- manager override placeholder if policy allows it

Test:

- stale stock conflict shows product and requested quantity
- duplicate serial conflict shows serial number
- rejected sale does not disappear silently
- resolved conflict updates local status

Exit criteria:

- offline sync failures are visible and actionable

## Step O12 - Offline Returns Foundation

Goal: prepare returns after offline sales are stable.

Implement:

- local return draft
- original sale lookup from local history
- serial return validation
- refund/payment reversal payload
- return outbox event

Test:

- return references original sale
- refund cannot exceed original paid amount
- returned serial cannot be returned twice locally
- central sync creates return documents

Exit criteria:

- offline returns can follow the same central return rules

## Step O13 - Offline Reporting and Reconciliation

Goal: let shop users see local and sync status clearly.

Implement:

- local daily sales summary
- pending sync count
- failed/conflict count
- local payment totals
- last sync status
- central reconciliation report by device/day

Test:

- local daily totals match local sales
- accepted central totals match synced events
- pending/conflict events are excluded from central totals until accepted
- report links to source local/central documents

Exit criteria:

- offline sales can be reconciled by device and date

## Step O14 - Offline Hardening and Pilot

Goal: prepare offline use in one display shop.

Implement:

- storage pressure warning
- long offline duration warning
- device replacement procedure
- 30-day offline volume simulation
- browser data backup/export guidance
- receipt printer test
- barcode scanner test
- power-loss test

Test:

- pending sale survives browser restart
- pending sale survives network outage
- repeated retry does not duplicate sale
- storage warning appears before failure
- device replacement does not lose central audit trail

Exit criteria:

- one shop can safely pilot offline POS

## Suggested Immediate Offline Step

Start offline work only after `docs/build-steps.md` Step 25 is accepted.

Then begin with Step O1: device registration and assignment.

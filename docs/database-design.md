# syncPoS Database Design

This design follows the detailed database specification in `Machinery_Retail_Detailed_Database_Design.docx` and adds a project-wide soft-delete policy. The central database is PostgreSQL. The offline display-shop POS uses IndexedDB as a controlled local projection and sales queue, never as a second source of truth.

## Core Decisions

- PostgreSQL is authoritative for all business records.
- IndexedDB stores only location-scoped offline sales data for the designated display-shop computer.
- All business tables use UUID primary keys.
- Human-readable document numbers are separate from UUID identifiers.
- Money is stored as `bigint` minor units, for example cents/santim, with ISO currency codes.
- Quantities use `numeric(20,6)`.
- Exchange rates use `numeric(20,8)`.
- Timestamps use `timestamptz` in UTC and are displayed in `Africa/Addis_Ababa`.
- Completed sales, posted stock movements, and posted journal entries are not edited or hard deleted.
- Corrections use returns, reversals, cancellations, or adjustments.
- Foreign keys use `RESTRICT` by default for posted/audited records.
- `CASCADE` is allowed only for true unposted header-line ownership.
- Every central mutation must run inside one PostgreSQL transaction.
- Mutations that affect clients must write the business change and `sync_outbox` event atomically.

## Soft Delete Policy

We will use soft delete for master/configuration records and draft operational records, but not as a substitute for financial or inventory reversals.

### Standard Soft-Delete Fields

Tables that support soft delete should include:

| Field | Type | Meaning |
| --- | --- | --- |
| deleted_at | timestamptz nullable | Null means active/not deleted |
| deleted_by | uuid nullable | FK `users.id` where possible |
| delete_reason | text nullable | Required for sensitive records |

Most list screens should filter with:

```sql
WHERE deleted_at IS NULL
```

### Tables That Should Use Soft Delete

- companies
- locations
- devices
- users
- employees
- roles
- permissions
- product_categories
- brands
- units_of_measure
- products
- attributes
- compatibility rules
- price lists and price list items
- partners
- addresses
- contacts
- payment terms
- expense categories
- accounts before use
- document sequence configuration
- notification templates

### Tables That Should Not Be Soft Deleted After Posting

These are audit/ledger records. They should be append-only or reversed:

- posted `stock_movements`
- posted `stock_movement_lines`
- completed/synced `sales`
- posted `journal_entries`
- posted `journal_lines`
- `sync_inbox`
- `sync_outbox`
- `audit_logs`
- payment records after verification/posting
- posted goods receipts
- posted supplier bills
- posted expense claims

For these records, use status fields like:

- `cancelled`
- `reversed`
- `voided`
- `rejected`
- `conflicted`

### Unique Index Rule With Soft Delete

Business codes should usually be unique only among non-deleted rows.

Examples:

```sql
CREATE UNIQUE INDEX products_sku_active_uidx
ON products(company_id, sku)
WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX partners_code_active_uidx
ON partners(company_id, code)
WHERE deleted_at IS NULL;
```

For globally sensitive identifiers such as serial numbers, engine numbers, chassis numbers, tax IDs, and sync event IDs, be stricter. In most cases they should remain unique even after soft delete unless the business explicitly approves reuse.

## Schema Map

| Domain | Tables |
| --- | --- |
| Foundation | companies, currencies, locations, devices, users, roles, permissions, employees |
| Catalog | product_categories, brands, units_of_measure, products, attributes, product_compatibilities, price_lists, product_serials |
| Partners | partners, partner_addresses, partner_contacts, payment_terms |
| Purchasing | purchase_orders, purchase_order_lines, goods_receipts, goods_receipt_lines, landed_costs, landed_cost_allocations |
| Inventory | stock_movements, stock_movement_lines, stock_balances, stock_reservations, stock_counts, stock_count_lines, transfers, transfer_lines |
| Sales | sales, sale_lines, sale_payments, sale_returns, sale_return_lines, warranties, service_orders |
| Expenses | expense_claims, expense_claim_lines, expense_categories |
| Accounting | accounts, accounting_periods, journal_entries, journal_lines, open_items, reconciliations |
| Sync | sync_outbox, sync_inbox, sync_conflicts, device_number_blocks |
| Governance | attachments, audit_logs, comments, notifications |

## Foundation Tables

### companies

Single legal company profile.

Key fields:

- `id uuid primary key`
- `code varchar(20) not null`
- `legal_name varchar(200) not null`
- `trade_name varchar(200)`
- `tin varchar(30)`
- `base_currency_code char(3) references currencies(code)`
- `timezone varchar(50) default 'Africa/Addis_Ababa'`
- `fiscal_year_start_month smallint check 1..12`
- `logo_object_key text`
- `is_active boolean default true`
- soft-delete fields
- timestamps

Indexes:

- unique `code` among non-deleted companies
- unique `tin` where not null and not deleted

### currencies

ISO currency reference.

Key fields:

- `code char(3) primary key`
- `name varchar(80)`
- `minor_unit smallint`
- `is_active boolean`

### locations

Warehouses, display shops, transit, adjustment, customer, or supplier locations.

Key fields:

- `id uuid primary key`
- `company_id uuid references companies(id)`
- `parent_location_id uuid references locations(id)`
- `code varchar(20)`
- `name varchar(120)`
- `location_type varchar(20)`
- `address_json jsonb`
- `offline_sales_enabled boolean default false`
- `allow_negative_stock boolean default false`
- `is_active boolean default true`
- soft-delete fields
- timestamps

Rules:

- unique `(company_id, code)` where `deleted_at is null`
- index `(company_id, location_type, is_active)`
- index `parent_location_id`

### devices

Registered browsers/computers allowed to sell offline.

Key fields:

- `id uuid primary key`
- `location_id uuid references locations(id)`
- `device_key_hash varchar(128) unique`
- `name varchar(100)`
- `platform varchar(80)`
- `is_primary_offline_device boolean default false`
- `status varchar(20)` with `active`, `revoked`, `replaced`
- `last_seen_at timestamptz`
- `last_sync_cursor bigint default 0`
- `storage_persistent boolean default false`
- soft-delete fields
- timestamps

Rule:

- unique active primary offline device per location:

```sql
UNIQUE(location_id)
WHERE is_primary_offline_device = true
  AND status = 'active'
  AND deleted_at IS NULL
```

### employees and users

Employees represent people. Users represent application identities.

Important user fields:

- `id uuid primary key`
- `company_id uuid references companies(id)`
- `employee_id uuid references employees(id)`
- `username varchar(80)`
- `email citext`
- `password_hash text`
- `status varchar(20)`
- `last_login_at timestamptz`
- soft-delete fields
- timestamps

Rules:

- unique `(company_id, username)` where not deleted
- unique email where not null and not deleted

### roles, permissions, role_permissions, user_roles, user_location_access

Use action-based permissions and location-scoped access.

Permission examples:

- `product.view`
- `product.manage`
- `inventory.receive`
- `inventory.transfer.approve`
- `sales.create`
- `sales.discount.override`
- `sales.cost.view`
- `expense.approve`
- `report.profit.view`

Location access controls which locations a user can view and transact in. Role permission alone is not enough.

## Catalog Tables

### product_categories

Hierarchical categories.

Rules:

- unique `(company_id, parent_category_id, name)` where not deleted
- index `(company_id, name)`

### brands

Brand/manufacturer reference.

### units_of_measure

Examples: `pcs`, `set`, `liter`, `meter`.

### products

Key fields:

- `id uuid primary key`
- `company_id uuid references companies(id)`
- `sku varchar(60)`
- `barcode varchar(80)`
- `name varchar(200)`
- `category_id uuid`
- `brand_id uuid`
- `model varchar(100)`
- `description text`
- `unit_id uuid`
- `product_type varchar(30)` with machinery, spare_part, accessory, consumable, service
- `tracking_mode varchar(20)` with none, lot, serial
- `standard_cost_minor bigint`
- `list_price_minor bigint`
- `currency_code char(3)`
- `is_active boolean`
- soft-delete fields
- timestamps

Rules:

- unique `(company_id, sku)` where not deleted
- unique `(company_id, barcode)` where barcode is not null and not deleted

### product_attributes

Flexible product facts: power, capacity, size, voltage, fuel type, color, condition.

### product_compatibilities

Many-to-many relationships for spare parts, substitutes, accessories, and bundles.

### price_lists and price_list_items

Use minor-unit money fields:

- `unit_price_minor bigint`
- `currency_code char(3)`
- date validity fields

Recommended:

- prevent overlapping active price periods for the same product/price list.

### product_serials

Serialized machinery identity.

Key fields:

- `id uuid primary key`
- `product_id uuid references products(id)`
- `serial_no varchar(120)`
- `engine_no varchar(120)`
- `chassis_no varchar(120)`
- `status varchar(30)`
- `current_location_id uuid references locations(id)`
- `current_customer_id uuid references partners(id)`
- `landed_unit_cost_minor bigint`
- warranty date fields
- timestamps

Rules:

- unique serial number while active
- unique engine number where present
- unique chassis number where present
- index `(product_id, status, current_location_id)`

## Partner Tables

### partners

Unified customers and suppliers.

Key fields:

- `id uuid primary key`
- `company_id uuid references companies(id)`
- `code varchar(40)`
- `display_name varchar(200)`
- `legal_name varchar(200)`
- `tin varchar(30)`
- `is_customer boolean`
- `is_supplier boolean`
- `payment_term_id uuid`
- `credit_limit_minor bigint`
- `currency_code char(3)`
- `status varchar(20)`
- soft-delete fields
- timestamps

Rules:

- unique `(company_id, code)` where not deleted
- index `(company_id, display_name)`
- index `tin`

### partner_addresses, partner_contacts, payment_terms

Keep multiple addresses and contacts per partner. Payment terms define due days and credit behavior.

## Purchasing Tables

### purchase_orders and purchase_order_lines

Statuses:

- `draft`
- `submitted`
- `approved`
- `partially_received`
- `received`
- `closed`
- `cancelled`

Money fields use:

- `subtotal_minor`
- `tax_minor`
- `total_minor`
- `unit_price_minor`
- `discount_minor`
- `line_total_minor`

Quantity fields use `numeric(20,6)`.

### goods_receipts and goods_receipt_lines

Receiving document that posts stock movements.

Rules:

- receipt posting creates `stock_movements` and `stock_movement_lines`
- serial-tracked products require product serial capture
- posted receipt cannot be hard deleted

### landed_costs and landed_cost_allocations

Freight, insurance, duty, handling, and import costs allocated into item cost.

## Inventory Tables

### stock_movements

Append-only stock movement header.

Movement types:

- `purchase_receipt`
- `sale_issue`
- `sale_return`
- `transfer_dispatch`
- `transfer_receipt`
- `adjustment`
- `count_variance`
- `write_off`

Rules:

- posted movement cannot be edited or hard deleted
- cancellation/reversal creates another movement
- index `(source_document_type, source_document_id)`
- index `(occurred_at, movement_type)`

### stock_movement_lines

Key fields:

- `stock_movement_id uuid`
- `product_id uuid`
- `product_serial_id uuid`
- `quantity numeric(20,6)`
- `unit_cost_minor bigint`
- `total_cost_minor bigint`
- `status varchar(30)`

Rules:

- serial-tracked stock movement quantity must be `1` or `-1`
- serial-tracked line must include `product_serial_id`

### stock_balances

Generated/maintained projection.

Key fields:

- `location_id`
- `product_id`
- `product_serial_id`
- `status`
- `on_hand_qty numeric(20,6)`
- `reserved_qty numeric(20,6)`
- `available_qty numeric(20,6)`
- `inventory_value_minor bigint`
- `version bigint`

Rules:

- `available_qty = on_hand_qty - reserved_qty`
- index `(product_id, location_id)`
- unique active serial balance where `product_serial_id is not null`
- null-safe unique projection for non-serialized items

### stock_reservations

Reservations for sale or transfer documents.

### stock_counts and stock_count_lines

Blind counts, snapshot quantities, variance approval, and adjustment posting.

### transfers and transfer_lines

Statuses:

- `draft`
- `submitted`
- `approved`
- `rejected`
- `picking`
- `dispatched`
- `partially_received`
- `received`
- `closed`
- `cancelled`
- `discrepancy`

Transfers require central connectivity in version 1.

## Sales, Warranty, and Service Tables

### sales

Key fields:

- `id uuid primary key`
- `company_id uuid`
- `location_id uuid`
- `device_id uuid`
- `customer_id uuid`
- `sale_no varchar`
- `provisional_no varchar`
- `business_date date`
- `status varchar(30)`
- `subtotal_minor bigint`
- `discount_minor bigint`
- `tax_minor bigint`
- `total_minor bigint`
- `paid_minor bigint`
- `balance_minor bigint`
- `currency_code char(3)`
- `server_received_at timestamptz`
- timestamps

Indexes:

- `(location_id, business_date)`
- `(customer_id, status)`
- `(status, server_received_at)`

### sale_lines

Rules:

- `product_serial_id` required for serial-tracked products
- unique `product_serial_id` where not null for active sale lines
- line values use minor-unit money fields

### sale_payments

Payment methods:

- `cash`
- `bank_transfer`
- `card`
- `mobile_money`

Verification statuses:

- `not_required`
- `pending`
- `verified`
- `rejected`

### sale_returns and sale_return_lines

Always reference original sale lines. Returns reverse stock, revenue, COGS, tax, and payment/refund effects according to policy.

### warranties and service_orders

Warranty registration should be in scope for serialized sales. Full service-center workflow can remain later unless the business confirms it for release 1.

## Expenses and Accounting Tables

### expense_claims and expense_claim_lines

Statuses:

- `draft`
- `submitted`
- `approved`
- `rejected`
- `finance_verified`
- `paid`
- `cancelled`

Posted/paid claims should not be soft deleted. Use reversal or cancellation workflow.

### accounts

Chart of accounts. Soft delete is allowed only before the account is referenced.

### accounting_periods

Statuses:

- `open`
- `soft_closed`
- `closed`

### journal_entries and journal_lines

Rules:

- posted journal entries cannot be edited or hard deleted
- unique `(source_type, source_id)` where status is not reversed
- total debit must equal total credit before posting
- debit and credit are stored as minor-unit bigint values

### open_items and reconciliations

Track receivables/payables and payment matching.

## Synchronization Tables

### sync_outbox

Central events to be pulled by offline devices.

Rules:

- cursor must be monotonic
- index `(location_id, cursor)`
- index `published_at`

### sync_inbox

Events pushed from offline devices.

Rules:

- unique `event_id`
- unique `(device_id, device_sequence)`
- duplicate event returns stored deterministic result
- index `(device_id, status, received_at)`

### sync_conflicts

Manager queue for:

- duplicate serial sale
- stale stock projection
- revoked offline permission
- closed accounting period
- malformed event
- sequence gap

### device_number_blocks

Preallocated document/reference ranges for offline provisional or official numbers if policy allows.

## Governance Tables

### attachments

Evidence and uploaded files.

Key fields:

- `id uuid primary key`
- `entity_type`
- `entity_id`
- `object_key`
- `file_name`
- `mime_type`
- `size_bytes bigint`
- `sha256_hash`
- `uploaded_by`
- soft-delete fields for unposted/non-legal attachments only

### audit_logs

Append-only. Do not soft delete.

Indexes:

- `(entity_type, entity_id, occurred_at)`
- `(actor_user_id, occurred_at)`

### comments and notifications

Comments may support soft delete for user mistakes. Notifications can be archived/read, but audit-significant notifications should not be hard deleted.

## Offline IndexedDB Design

IndexedDB stores a denormalized read model and append-only sales queue.

Rules:

- decimal quantities are strings to avoid JavaScript floating-point errors
- money remains integer minor units
- only assigned-shop products, prices, permissions, customers, and stock projections are cached
- offline sales are stored in a durable outbox before printing/sync

Suggested stores:

- `local_products`
- `local_prices`
- `local_customers`
- `local_stock_balances`
- `local_serials`
- `local_sales`
- `local_sale_lines`
- `local_payments`
- `local_sync_outbox`
- `local_sync_inbox`
- `local_settings`

## Critical Transaction Boundaries

### Sale Synchronization

One PostgreSQL transaction must:

1. insert or detect duplicate `sync_inbox`
2. validate device, location, user snapshot, and sequence
3. create sale and payment records
4. lock affected `stock_balances` and product serials
5. post stock movement
6. create accounting proposal or draft journal
7. append `sync_outbox` events
8. store deterministic sync result

### Purchase Receipt Posting

One PostgreSQL transaction must:

1. validate purchase order and receipt quantities
2. create goods receipt records
3. create product serial records where required
4. post stock movement
5. update stock balance projection
6. update purchasing status
7. append `sync_outbox` events

### Journal Posting

One PostgreSQL transaction must:

1. validate accounting period
2. validate source document
3. verify debit equals credit
4. post journal entry
5. update open items if needed
6. append audit log

## Recommended Migration Order

1. Foundation: companies, currencies, users, roles, permissions, employees, locations, devices.
2. Catalog and partners: products, categories, brands, units, product serials, partners.
3. Governance: attachments, audit logs, comments, notifications.
4. Inventory: stock movements, stock balances, reservations, counts, transfers.
5. Purchasing: purchase orders, goods receipts, landed costs.
6. Sales: sales, sale lines, payments, returns, warranties.
7. Expenses and accounting: expense claims, accounts, periods, journals, open items.
8. Synchronization: sync inbox/outbox, conflicts, number blocks.
9. Reporting: views/materialized views for dashboards.

## Implementation Note

Before running `pnpm db:migrate`, replace the current starter Drizzle schema with this design’s first migration set. The previous starter schema should be treated as a scaffold only.

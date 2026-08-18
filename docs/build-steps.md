# syncPoS Feasible Implementation Steps

This plan breaks the project into small, testable steps. Each step should end with working code, a clear migration or feature output, and basic tests before moving forward.

## Rule Before Starting

Do not build all modules at once. Build one vertical slice at a time:

1. database structure
2. seed/test data
3. service logic
4. API route or server action
5. UI screen
6. validation/tests

## Step 1 - Full Initial Migration Design

Goal: replace the starter Drizzle schema with the real foundation schema before running migrations.

Implement:

- enums/shared constants
- soft-delete columns helper
- timestamp columns helper
- companies
- currencies
- employees
- users
- roles
- permissions
- role_permissions
- user_roles
- locations
- user_location_access
- devices
- audit_logs
- attachments

Test:

- `pnpm lint`
- `pnpm exec tsc --noEmit`
- `pnpm db:generate`
- inspect generated SQL manually
- confirm soft-delete partial unique indexes exist
- confirm no migration has been applied yet until SQL review is approved

Exit criteria:

- first migration SQL is reviewed and accepted

## Step 2 - Run First Migration Locally

Goal: create the local PostgreSQL schema.

Implement:

- start local PostgreSQL
- run Drizzle migration
- verify tables exist

Commands:

```bash
pnpm db:up
pnpm db:migrate
```

Test:

- connect with `psql`
- list tables
- check enum creation
- check indexes
- check FK constraints

Exit criteria:

- local database has foundation tables
- migration can run from empty database without error

## Step 3 - Seed Foundation Data

Goal: make the app usable with basic company, currency, roles, users, and one display shop.

Implement:

- seed script
- ETB currency
- default company
- admin role
- salesperson role
- inventory manager role
- default admin user
- main warehouse
- one display shop
- one primary offline device placeholder

Test:

- seed can run once
- seed can run twice without duplicate records
- admin user exists
- locations exist
- roles and permissions exist

Exit criteria:

- local database has predictable development data

## Step 4 - Product Catalog Migration

Goal: add product master data.

Implement:

- product_categories
- brands
- units_of_measure
- products
- product_attributes
- product_compatibilities
- price_lists
- price_list_items
- product_serials

Test:

- create product without serial tracking
- create serial-tracked machine
- duplicate SKU is blocked
- duplicate active barcode is blocked
- duplicate serial number is blocked
- soft-deleted SKU can be reused only if policy allows it

Exit criteria:

- product and serial data can be stored safely

## Step 5 - Product Admin Screens

Goal: create basic UI for managing products.

Implement:

- product list
- product create/edit form
- category/brand/unit selectors
- tracking mode selector
- soft delete action
- restore action if needed

Test:

- validation errors display clearly
- deleted products do not appear in normal list
- SKU uniqueness works
- barcode uniqueness works

Exit criteria:

- admin can manage catalog data from UI

## Step 6 - Partner Migration and UI

Goal: manage customers and suppliers.

Implement:

- partners
- partner_contacts
- partner_addresses
- payment_terms
- partner list
- partner create/edit form
- customer/supplier flags
- soft delete

Test:

- partner can be customer only
- partner can be supplier only
- partner can be both
- duplicate partner code is blocked
- deleted partner hidden by default

Exit criteria:

- customers and suppliers are ready for purchasing/sales

## Step 7 - Inventory Ledger Migration

Goal: create the stock authority model.

Implement:

- stock_movements
- stock_movement_lines
- stock_balances
- stock_reservations
- stock_counts
- stock_count_lines

Test:

- movement can post inside one transaction
- stock balance projection updates
- negative stock is blocked
- serialized quantity must be `1` or `-1`
- serial asset cannot be active in two locations
- posted movement cannot be edited/deleted

Exit criteria:

- every stock quantity can be traced to movement lines

## Step 8 - Opening Stock Import

Goal: load initial stock before purchase/sale workflows.

Implement:

- CSV/Excel import template
- validation preview
- import error report
- opening stock movement type
- opening cost per item/serial
- import audit log

Test:

- invalid SKU rejected
- duplicate serial rejected
- missing cost rejected or flagged
- import preview matches posted result
- stock card shows opening movement

Exit criteria:

- business can load starting stock reliably

## Step 9 - Stock Card and Inventory Screens

Goal: users can verify stock.

Implement:

- stock by location
- product stock card
- serial history
- stock status filters
- as-of-date report foundation

Test:

- stock balance equals ledger movement total
- serial current location matches movement history
- restricted users only see assigned locations

Exit criteria:

- stock visibility is trustworthy

## Step 10 - Purchasing Workflow

Goal: receive stock through controlled purchasing.

Implement:

- purchase_orders
- purchase_order_lines
- goods_receipts
- goods_receipt_lines
- landed_costs
- landed_cost_allocations
- supplier bill placeholder if accounting is delayed
- PO list and form
- receipt posting

Test:

- PO can be drafted and approved
- partial receipt works
- over-receipt is blocked or requires configured approval
- receipt creates stock movement
- serials captured during receipt
- landed cost updates item cost

Exit criteria:

- stock can enter the business through purchase receipts

## Step 11 - Purchase Cleanup and Vendor Bill Completion

Goal: make purchasing behave like a clean Odoo-style document workflow.

Implement:

- replace supplier bill placeholder with proper vendor bill creation flow
- vendor bill draft/posted/cancelled status actions
- create vendor bill from purchase order
- create vendor bill from receipt
- keep placeholder only as temporary migration/development fallback
- vendor bill line taxes
- vendor bill totals and residual amount
- smart buttons on purchase order:
  - Receipts
  - Vendor Bills
  - Payments
  - Landed Costs

Test:

- PO smart buttons open filtered related lists
- receipt detail opens as separate document
- vendor bill detail opens as separate document
- vendor bill cannot be posted with invalid totals
- posted bill cannot be silently edited
- cancelled bill does not affect payable balance

Exit criteria:

- purchase order, receipt, and vendor bill are separate linked documents
- vendor bill is ready for payment tracking

## Step 12 - Payment Configuration

Goal: define how money is received and paid.

Implement:

- payment_methods
- payment_accounts
- cash/bank/mobile-money/card method types
- inbound/outbound flags
- active/inactive status
- payment account opening balance placeholder if needed

Test:

- duplicate active payment method code blocked
- inactive method hidden from payment forms
- outbound-only method cannot be used for customer payment
- inbound-only method cannot be used for supplier payment

Exit criteria:

- app has reusable payment methods for sales, purchasing, and expenses

## Step 13 - Supplier Payment Tracking

Goal: pay vendor bills and track payable balance.

Implement:

- payments
- payment_allocations
- payment type: outbound
- payment status: draft, posted, cancelled
- supplier bill residual amount
- register payment button on vendor bill
- vendor bill smart button for payments
- payment document page

Test:

- full supplier bill payment marks bill as paid
- partial payment leaves residual balance
- overpayment is blocked or stored as vendor credit by policy
- cancelling payment restores payable balance
- payment document links back to vendor bill

Exit criteria:

- supplier bills can be paid and tracked without accounting module

## Step 14 - Expense Registration

Goal: record business expenses that are not stock value.

Implement:

- expense_categories
- expenses
- expense_lines if multi-line is needed
- expense attachments
- paid/unpaid status
- register payment from expense
- employee/vendor optional relation
- location optional relation

Test:

- expense requires category, date, amount, and payment status
- paid expense creates payment record
- unpaid expense can be paid later
- cancelled expense does not appear in normal expense totals
- attachment can be linked

Exit criteria:

- non-inventory costs can be captured and paid

## Step 15 - Landed Cost Workflow

Goal: separate normal expenses from costs that increase inventory value.

Implement:

- landed cost create/edit document page
- link landed cost to purchase order or receipt
- allocation methods:
  - quantity
  - value
  - manual
- allocation preview
- post landed cost
- update receipt line landed cost
- update product serial/lot landed unit cost
- smart button from PO and receipt

Test:

- landed cost cannot post without receipt lines
- allocation total equals landed cost amount
- posted landed cost updates inventory valuation fields
- posted landed cost cannot be edited
- normal expense remains separate from landed cost

Exit criteria:

- freight/customs/handling can be capitalized into inventory cost

## Step 16 - Sales Foundation Migration

Goal: create the sales document model.

Implement:

- sales_orders
- sales_order_lines
- customer_invoices
- customer_invoice_lines
- deliveries
- delivery_lines
- sale payments relation
- sales tax support using existing tax table

Recommended document flow:

1. quotation
2. sales order
3. delivery
4. customer invoice
5. customer payment
6. return/refund

Test:

- quotation can be created without stock movement
- confirmed sales order reserves stock if policy requires it
- delivery reduces stock
- invoice creates receivable balance
- taxes calculate consistently with purchase taxes

Exit criteria:

- sales has the same document foundation as purchasing

## Step 17 - Sales Order UI

Goal: create Odoo-like sales order screens.

Implement:

- quotation/order list
- create/edit sales order form
- notebook order lines
- customer selector
- product selector
- tax selector
- subtotal/tax/total calculation
- smart buttons:
  - Deliveries
  - Invoices
  - Payments
  - Returns

Test:

- create quotation
- edit draft quotation
- confirm quotation to sales order
- order lines keep data when notebook tabs change
- customer-only partners appear in customer selector

Exit criteria:

- sales order can be managed from UI

## Step 18 - Delivery Workflow

Goal: move sold stock out through controlled inventory operation.

Implement:

- delivery list
- delivery document page
- create delivery from sales order
- serial/lot selection during delivery
- stock movement type: sale_delivery
- delivery status: draft, posted, cancelled

Test:

- cannot deliver unavailable stock
- serial cannot be delivered twice
- delivery creates stock movement
- delivery updates stock balance
- delivery smart button works from sales order

Exit criteria:

- stock can leave the business through sales delivery

## Step 19 - Customer Invoice and Payment Tracking

Goal: track customer receivables and payments.

Implement:

- customer invoice list/detail
- create invoice from sales order or delivery
- invoice status and residual amount
- register customer payment
- payment type: inbound
- customer payment document page
- invoice smart button for payments

Test:

- full payment marks invoice paid
- partial payment leaves residual
- overpayment blocked or recorded as customer credit by policy
- cancelling payment restores receivable balance

Exit criteria:

- customer debt and payments can be tracked

## Step 20 - Inventory Operations Completion

Goal: make all inventory operations document-based.

Implement:

- receipts as inventory operation links
- internal transfers
- adjustments
- scrap
- customer returns
- supplier returns
- operation-specific list filters
- document status actions
- smart links back to source documents

Test:

- each operation creates movement lines
- stock balance reconciles to movement history
- serial/lot status changes correctly
- posted operations cannot be silently edited
- cancelled/reversal flow is explicit

Exit criteria:

- inventory is controlled through traceable documents

## Step 21 - Returns, Refunds, and Warranty

Goal: handle after-sale and after-purchase corrections safely.

Implement:

- customer return request
- return receipt
- credit note/refund placeholder
- supplier return
- vendor refund placeholder
- warranty registration
- serial ownership/status history

Test:

- customer return references original sale
- supplier return references purchase receipt
- refund cannot exceed original paid amount
- returned serial goes to correct available/returned/damaged status
- warranty dates are created for serial sale

Exit criteria:

- sales and purchase corrections are auditable

## Step 22 - Transfers

Goal: move stock between locations centrally.

Implement:

- transfers
- transfer_lines
- approval flow
- dispatch movement
- in-transit status
- receipt movement
- discrepancy handling

Test:

- transfer cannot dispatch before approval
- in-transit stock is not sellable
- partial receipt remains open
- serial cannot exist in source and destination at the same time

Exit criteria:

- controlled stock movement between shops works

## Step 23 - Accounting Foundation

Goal: prepare for real financial reporting without blocking operations.

Implement:

- chart of accounts
- accounting periods
- journal_entries
- journal_lines
- source document links
- open items
- reconciliation table

Start with generated journal proposals, not full accounting automation.

Test:

- journal entry must balance
- closed period blocks posting
- payment links to open item
- reversal references original journal entry

Exit criteria:

- app can later produce reliable profit/loss and balance reports

## Step 24 - Reporting and Management Dashboard

Goal: give management trustworthy visibility.

Implement:

- inventory valuation summary
- stock movement audit report
- purchase report
- sales report
- supplier payable aging
- customer receivable aging
- expense summary
- payment register
- audit log search

Test:

- report totals reconcile to document totals
- filters respect location permissions
- drilldown links to source documents
- exports include filters and generated timestamp

Exit criteria:

- operational data can be reviewed by management

## Step 25 - Online Hardening and Pilot

Goal: prepare the online/core app for real use before starting offline work.

Implement:

- backup/restore test
- role permission review
- stock reconciliation test
- purchase-to-payment simulation
- sale-to-payment simulation
- expense payment simulation
- barcode scanner test
- receipt printer test
- migration dry run
- user training seed data

Test:

- restore from backup works
- one-day sales and purchase simulation reconciles
- user roles cannot access restricted pages
- stock, payable, receivable, payment, and expense reports reconcile

Exit criteria:

- one location can pilot the online workflow safely

## Testing Checklist For Every Step

Run these before closing each step:

```bash
pnpm lint
pnpm exec tsc --noEmit
```

For database steps:

```bash
pnpm db:generate
pnpm db:migrate
```

For risky database changes:

- review generated SQL
- test from an empty database
- test with existing sample data
- confirm rollback/reversal strategy

## Suggested Immediate Next Step

Continue with Step 11: complete the purchase vendor bill model and prepare it for supplier payment tracking.

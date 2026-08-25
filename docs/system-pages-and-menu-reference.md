# syncPoS Pages and Menu Reference

This document describes the visible pages, left-side main menus, top submenus, and access permissions currently implemented in syncPoS.

## Access Model

The admin UI uses role-based permissions. A user sees only the main menus and submenus allowed by their assigned role permissions. Direct page access is also guarded on the server for protected pages.

| Permission | Purpose |
| --- | --- |
| `all:all:all` | Full access to every module. |
| `catalog:products:view` | View product catalog pages. |
| `catalog:products:manage` | Create, update, delete, and restore product catalog records. |
| `partners:partners:view` | View customers, suppliers, and payment terms. |
| `partners:partners:manage` | Create, update, delete, and restore partner records. |
| `inventory:stock:view` | View inventory, stock cards, serial history, transfers, and operations. |
| `inventory:stock:receive` | Post stock operations, purchases, receipts, adjustments, opening stock, and returns. |
| `inventory:locations:manage` | Manage warehouse and shop locations. |
| `sales:orders:create` | Access sales order, delivery, invoice, payment, and return flows. |
| `reports:profit:view` | View dashboard and detailed reports. |
| `company:settings:manage` | Manage payment configuration, expenses, and company-level operational settings. |
| `iam:users:view` | View users. |
| `iam:users:manage` | Create, edit, disable, and unlock users. |
| `iam:roles:view` | View roles and permissions. |
| `iam:roles:manage` | Create, edit, and delete roles. |

## Public and Auth Pages

| Page | Route | Purpose |
| --- | --- | --- |
| Landing page | `/` | Public professional landing page for syncPoS. Introduces the retail management system and links users into the app. |
| Login | `/login` | User sign-in page. Tracks failed login attempts and temporarily locks accounts after repeated failures. |
| Unauthorized | `/unauthorized` | Access denied page shown when a signed-in user lacks the required permission. |

## Admin Shell

| Area | Purpose |
| --- | --- |
| Left sidebar | Main module navigation: Dashboard, Products, Partners, Purchasing, Sales, Inventory, Reports, Settings, Operations. Items are hidden when the user lacks permission. |
| Top submenu | Shows submenus for the active module, similar to Odoo. Submenu items are also permission-filtered. |
| Sign out area | Shows sync status, current username, and the sign out button. |

## Dashboard

Required permission: `reports:profit:view`

| Menu | Route | Purpose |
| --- | --- | --- |
| Overview | `/admin` | Main operations dashboard. Shows sales, payments, expenses, supplier payments, receivables, payables, stock value, pending purchases, low stock, payment account summary, and recent activity. |
| Daily Activity | `/admin?view=daily` | Reserved dashboard view for daily operational activity. Currently routed through the dashboard menu. |
| Sync Status | `/admin?view=sync` | Reserved dashboard view for sync/offline status. Currently routed through the dashboard menu. |

## Products

Required view permission: `catalog:products:view`

Manage actions require: `catalog:products:manage`

| Menu | Route | Purpose |
| --- | --- | --- |
| Products | `/admin/products` | Product list with filters and product detail access. |
| New Product | `/admin/products/new` | Create product with Odoo-like form tabs. Supports catalog data, pricing, tracking mode, attributes, compatibility, and taxes. |
| Product Detail | `/admin/products/[id]` | View product detail, stock/tracking context, and related information. |
| Edit Product | `/admin/products/[id]/edit` | Edit the same product form used for create. |
| Categories | `/admin/products/categories` | Manage product categories in popup forms. |
| Brands | `/admin/products/brands` | Manage product brands in popup forms. |
| Units | `/admin/products/units` | Manage units of measure in popup forms. |
| Taxes | `/admin/products/taxes` | Configure tax name, rate, active status, and tax metadata. Taxes are reused in purchase and sales order lines. |
| Price Lists | `/admin/products/price-lists` | View/manage price lists and product prices. |
| Lots / Serials | `/admin/products/tracking` | View serial/lot tracking information for tracked products. |

## Partners

Required view permission: `partners:partners:view`

Manage actions require: `partners:partners:manage`

| Menu | Route | Purpose |
| --- | --- | --- |
| All Partners | `/admin/partners` | Partner list for customers, suppliers, or both. |
| Customers | `/admin/partners?role=customer` | Customer-filtered partner list. |
| Suppliers | `/admin/partners?role=supplier` | Supplier-filtered partner list. |
| New Partner | `/admin/partners/new` | Create customer/supplier partner. |
| Edit Partner | `/admin/partners/[id]/edit` | Edit partner profile, contact, address, and flags. |
| Payment Terms | `/admin/partners/payment-terms` | Manage payment term records using text-based terms. |

## Purchasing

Required permission: `inventory:stock:receive`

| Menu | Route | Purpose |
| --- | --- | --- |
| RFQs / Orders | `/admin/purchasing` | Purchase order list. Covers RFQ/draft, confirmed purchase order, received status, and related document counts. |
| New RFQ | `/admin/purchasing/new` | Create a purchase order using an Odoo-like form with notebook order lines. Supports many order lines and many taxes per line. |
| Purchase Detail | `/admin/purchasing/[id]` | Edit draft purchase orders, confirm orders, receive products, and open smart buttons for receipts, vendor bills, landed costs, payments, and returns. |
| Receipts | `/admin/purchasing?view=receipts` | List purchase receipts separately from purchase orders. |
| Receipt Detail | `/admin/purchasing/receipts/[id]` | View/post receipt details. Serial and lot assignment happens during receipt. |
| Landed Costs | `/admin/purchasing?view=landed-costs` | List landed cost documents. |
| New Landed Cost | `/admin/purchasing/landed-costs/new` | Create landed cost linked to receipt or purchase order. |
| Landed Cost Detail | `/admin/purchasing/landed-costs/[id]` | View landed cost allocation preview and posted result. |
| Vendor Bills | `/admin/purchasing?view=supplier-bills` | List vendor bills separately from purchase order pages. Shows products, taxes, totals, residual amount, and payment status. |
| Vendor Bill Detail | `/admin/purchasing/vendor-bills/[source]/[id]` | View vendor bill details and register supplier payment. |
| Payments | `/admin/purchasing?view=payments` | List outbound supplier payments. |
| Supplier Payment Detail | `/admin/purchasing/payments/[id]` | View, post, or cancel supplier payment document. |
| Returns | `/admin/purchasing?view=returns` | List supplier return documents. |
| New Supplier Return | `/admin/purchasing/returns/new` | Start supplier return from a posted purchase receipt. |
| Supplier Return Detail | `/admin/purchasing/returns/[id]` | View/post supplier return document. |

## Sales

Required permission: `sales:orders:create`

| Menu | Route | Purpose |
| --- | --- | --- |
| Quotations / Orders | `/admin/sales` | Sales quotation/order list. Shows customer, status, delivery/invoice/payment progress, products, and totals. |
| New Quotation | `/admin/sales/new` | Create a sales quotation using the shared Odoo-like order form and notebook lines. |
| Sales Order Detail | `/admin/sales/[id]` | Edit draft quotation, confirm quotation, create delivery, create invoice, and use smart buttons for related documents. |
| Deliveries | `/admin/sales?view=deliveries` | List customer delivery documents. |
| Delivery Detail | `/admin/sales/deliveries/[id]` | View/post/cancel delivery. Delivery reduces stock and updates serial status. |
| Invoices | `/admin/sales?view=invoices` | List customer invoices with residual and payment status. |
| Customer Invoice Detail | `/admin/sales/invoices/[id]` | View/post invoice and register inbound customer payment. |
| Payments | `/admin/sales?view=payments` | List inbound customer payments. |
| Customer Payment Detail | `/admin/sales/payments/[id]` | View/post/cancel customer payment document. |
| Returns | `/admin/sales?view=returns` | List customer returns. |
| New Customer Return | `/admin/sales/returns/new` | Start customer return from original sales order. |
| Customer Return Detail | `/admin/sales/returns/[id]` | View/post customer return and related refund placeholder data. |

## Inventory

Required view permission: `inventory:stock:view`

Posting/operation actions require: `inventory:stock:receive`

Location management requires: `inventory:locations:manage`

| Menu | Route | Purpose |
| --- | --- | --- |
| Stock | `/admin/inventory` | Stock by location summary with product, location, quantity, serial/lot, and cost visibility. |
| Operations | `/admin/inventory/operations` | Inventory operation list covering receipts, deliveries, adjustments, scrap, and returns. |
| New Operation | `/admin/inventory/operations/new` | Create document-based inventory operation. |
| Operation Detail | `/admin/inventory/operations/[id]` | View/post inventory operation and movement lines. |
| Receipts | `/admin/inventory/operations?view=receipts` | Inventory operation filter for incoming receipts. |
| Deliveries | `/admin/inventory/operations?view=deliveries` | Inventory operation filter for outgoing deliveries. |
| Transfers | `/admin/inventory/transfers` | Transfer list for moving stock between locations. |
| New Transfer | `/admin/inventory/transfers/new` | Create transfer with source, transit, and destination locations. |
| Transfer Detail | `/admin/inventory/transfers/[id]` | Approve, dispatch, receive, and handle transfer discrepancies. |
| Adjustments | `/admin/inventory/operations?view=adjustments` | Inventory operation filter for stock adjustments. |
| Scrap | `/admin/inventory/operations?view=scrap` | Inventory operation filter for scrapped stock. |
| Returns | `/admin/inventory/operations?view=returns` | Inventory operation filter for customer/supplier returns. |
| Stock Card | `/admin/inventory/stock-card` | Product ledger report showing stock movement history. |
| Serial History | `/admin/inventory/serial-history` | Serial/lot history and current status/location. |
| Locations | `/admin/inventory/locations` | Manage warehouses, shops, transit, supplier, customer, and scrap locations. |
| Opening Stock | `/admin/inventory/opening-stock` | CSV/Excel-style opening stock import with validation preview and audit trail. |
| Opening Stock Template | `/admin/inventory/opening-stock/template` | Downloads the import template. |

## Reports

Required permission: `reports:profit:view`

| Menu | Route | Purpose |
| --- | --- | --- |
| Report Hub | `/admin/reports` | Central page for detailed report links. |
| Sales | `/admin/reports/sales` | Sales report by date/customer/document with totals. |
| Expenses | `/admin/reports/expenses` | Expense report by category, date, payment account, and status. |
| Payment Accounts | `/admin/reports/payment-accounts` | Bank/cash/mobile/card transaction summary and account movement detail. |
| Stock | `/admin/reports/stock` | Stock valuation and stock availability report. |
| Receivables | `/admin/reports/receivables` | Customer invoice residual balances and payment status. |
| Payables | `/admin/reports/payables` | Vendor bill residual balances and payment status. |

## Settings

Settings menus are permission-filtered. Users and Roles have separate view and manage permissions.

| Menu | Route | Purpose | Permission |
| --- | --- | --- | --- |
| Users | `/admin/settings?view=users` | View users, employee links, roles, login status, failed attempts, lock state, and last login. | `iam:users:view` |
| New/Edit User | Popup on Users page | Create/update username, email, employee link, password, status, email verified flag, and assigned roles. | `iam:users:manage` |
| Disable/Unlock User | Actions on Users page | Disable user login or unlock/reset failed login status. | `iam:users:manage` |
| Roles | `/admin/settings?view=roles` | View role code, name, flags, user count, permission count, and active status. | `iam:roles:view` |
| New/Edit Role | Popup on Roles page | Create/update role metadata and assign permissions using many-to-many tags. | `iam:roles:manage` |
| Delete Role | Action on Roles page | Soft-delete custom deletable roles. Protected roles cannot be deleted. | `iam:roles:manage` |
| Permissions | `/admin/settings?view=permissions` | View permission catalog with application, feature, action, status, and description. | `iam:roles:view` |
| Payments | `/admin/settings/payments` | Configure payment methods and payment accounts for cash, bank transfer, mobile money, and card usage. | `company:settings:manage` |

## Operations

Required permission: `company:settings:manage`

| Menu | Route | Purpose |
| --- | --- | --- |
| Tasks | `/admin/operations` | Operations workspace. Currently links to expense registration and reserves space for approval queues. |
| Approvals | `/admin/operations?view=approvals` | Reserved approval queue view. |
| Expenses | `/admin/operations/expenses` | List business expenses that do not increase inventory value. |
| New Expense | `/admin/operations/expenses/new` | Register paid or unpaid expense with category, payment status, optional employee/vendor/location, and notes. |
| Expense Detail | `/admin/operations/expenses/[id]` | View expense, register payment later, and track status. |
| Expense Categories | `/admin/operations/expenses/categories` | Manage reusable expense categories. |

## Important Navigation Notes

- The left sidebar uses the active user's permissions to decide which modules are shown.
- The top submenu uses the same permissions to decide which page links are shown.
- Hidden menu items are not the only protection. Important pages and server actions also call permission checks.
- Some planned views are present as menu routes but are not yet full independent pages, such as dashboard daily activity, dashboard sync status, and operations approvals.
- `Settings / Users` and `Settings / Roles` separate viewing from management. A user can be allowed to inspect records without being allowed to edit them.

## Suggested Future Permission Improvements

The current permission model is usable, but still coarse in some business areas. For production-grade control, consider adding:

| Future Permission | Purpose |
| --- | --- |
| `sales:orders:view` | View sales without creating or editing. |
| `sales:deliveries:manage` | Post/cancel customer deliveries separately from sales order creation. |
| `sales:invoices:manage` | Create/post customer invoices. |
| `sales:payments:manage` | Register/post customer payments. |
| `purchasing:orders:view` | View purchasing without receiving or posting. |
| `purchasing:orders:manage` | Create/confirm purchase orders. |
| `purchasing:bills:manage` | Create/post vendor bills. |
| `purchasing:payments:manage` | Register/post supplier payments. |
| `expenses:view` | View expenses without managing company settings. |
| `expenses:manage` | Create, edit, cancel, and pay expenses. |
| `reports:financial:view` | View financial reports separately from operational reports. |
| `inventory:valuation:view` | View stock cost/value fields separately from physical stock quantities. |

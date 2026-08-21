# syncPoS User Acceptance Testing Guide - Steps 1 to 22

This document is for testing the online/core syncPoS workflow with real users before moving to offline POS or full accounting. The goal is to confirm that users can perform daily work correctly, that stock and payment data stays traceable, and that issues are recorded clearly.

## 1. Testing Scope

Included in this round:

- Login, access, and basic navigation
- Foundation setup and seeded data
- Product catalog
- Product categories, brands, units, taxes, and price lists
- Partners, contacts, addresses, and payment terms
- Inventory locations
- Opening stock import
- Stock by location, stock card, serial history
- Purchasing: RFQ/purchase order, receipt, vendor bill
- Supplier payment tracking
- Expenses and expense categories
- Landed cost workflow
- Sales: quotation/order, delivery, invoice, payment
- Inventory operations: receipts, deliveries, adjustments, scrap, returns
- Customer returns, supplier returns, refund placeholders, warranty/serial ownership
- Transfers between locations with approval, dispatch, in-transit, receipt, and discrepancy handling

Not included in this round:

- Offline POS
- IndexedDB/Dexie sync
- Full accounting, chart of accounts, journal entries, balance sheet, profit and loss
- Bank reconciliation
- Production deployment

## 2. Test Environment

Use the local development environment unless a separate staging server is provided.

```bash
pnpm install
pnpm db:up
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Open:

```text
http://localhost:3000
```

Default seeded login:

```text
Username: admin
Password: admin123
```

Before testing, the technical tester should run:

```bash
pnpm exec tsc --noEmit
pnpm lint
```

## 3. Test Roles

Use these roles during testing, even if the current seeded user is admin:

- Admin: configuration, users, product setup, payment setup
- Inventory user: locations, opening stock, stock checks, transfers, adjustments
- Purchasing user: suppliers, purchase orders, receipts, vendor bills, supplier payments
- Sales user: customers, quotations, deliveries, invoices, customer payments
- Manager: reports/checking totals, approval decisions, issue sign-off

If only the admin user exists, testers should still write down which role they were acting as.

## 4. Issue Log Format

Every problem should be recorded with this format:

```text
Issue ID:
Tester:
Date:
Module:
Test case:
Steps performed:
Expected result:
Actual result:
Screenshot or document number:
Severity: Critical / High / Medium / Low
Can continue testing: Yes / No
```

Severity guide:

- Critical: blocks sale, purchase, stock posting, or payment posting
- High: wrong stock, wrong money, wrong document state, or missing traceability
- Medium: workflow confusing but workaround exists
- Low: wording, layout, small usability issue

## 5. Common Test Data To Prepare

Create or confirm these records before running full workflow tests.

Products:

- Bulk product without tracking: example `OIL-FILTER-001`
- Serial tracked machine: example `TRACTOR-001`
- Lot tracked spare part: example `BELT-LOT-001`

Partners:

- Customer only
- Supplier only
- Partner that is both customer and supplier

Locations:

- Main Warehouse
- Display Shop
- Transit Location

Payment setup:

- Cash method linked to a cash account
- Bank transfer method linked to a bank account
- Mobile money method linked to a mobile money account, if used

Taxes:

- Purchase VAT tax
- Sales VAT tax
- A product or purchase/sales line with more than one tax, if configured

## 6. General Navigation And Authentication

### UAT-001 Login

Steps:

1. Open `/login`.
2. Enter `admin` and `admin123`.
3. Sign in.

Expected:

- User is redirected to the admin area.
- Left menu is visible.
- Top submenu changes when selecting main menus.
- Sign out is visible.

Pass/Fail:

```text
Result:
Notes:
```

### UAT-002 Main Menu Structure

Steps:

1. Open Products.
2. Confirm top submenu shows product-related items.
3. Open Partners.
4. Open Inventory.
5. Open Purchasing.
6. Open Sales.
7. Open Settings or Operations if present.

Expected:

- Left side shows main menus.
- Top section shows submenus related to the selected module.
- Page body changes without losing global layout.

Pass/Fail:

```text
Result:
Notes:
```

## 7. Foundation And Configuration Tests

### UAT-003 Seeded Foundation Data

Steps:

1. Confirm company exists.
2. Confirm ETB currency exists.
3. Confirm admin role exists.
4. Confirm at least one warehouse and one display shop exist.

Expected:

- System can be used without manually creating foundation data.
- Re-running seed does not create duplicate foundation records.

Pass/Fail:

```text
Result:
Notes:
```

### UAT-004 Soft Delete Behavior

Steps:

1. Open any simple reference list, such as product category, brand, unit, tax, payment term, or location.
2. Create a record.
3. Delete it.
4. Confirm it disappears from the normal list.
5. Open deleted view if available.
6. Restore it if restore is available.

Expected:

- Deleted records are hidden from normal lists.
- Restore brings record back without creating duplicates.

Pass/Fail:

```text
Result:
Notes:
```

## 8. Product Catalog Tests

### UAT-005 Product Category, Brand, And Unit Popup CRUD

Steps:

1. Open Products.
2. Open Categories.
3. Create a category using the popup form.
4. Edit the category using the popup form.
5. Repeat for Brands.
6. Repeat for Units.

Expected:

- Popup opens correctly.
- Save creates or updates the record.
- The list refreshes after save.
- Duplicate active code is blocked.

Pass/Fail:

```text
Result:
Notes:
```

### UAT-006 Tax Configuration

Steps:

1. Open Products -> Taxes.
2. Create a tax with name, code, rate, scope, and active status.
3. Create one purchase tax and one sales tax.
4. Try duplicate active tax code.

Expected:

- Tax can be created and edited.
- Duplicate active tax code is blocked.
- Inactive tax does not appear in normal tax selectors.

Pass/Fail:

```text
Result:
Notes:
```

### UAT-007 Product Create And Edit

Steps:

1. Open Products.
2. Create a new product.
3. Fill SKU, name, category, brand, unit, tracking mode, barcode if needed, and price/cost fields if available.
4. Move between notebook tabs before saving.
5. Save.
6. Open product detail.
7. Edit the product.

Expected:

- Product saves successfully.
- Notebook tab switching does not remove entered data.
- Detail page and edit page show the same product information.
- Duplicate SKU is blocked.
- Duplicate active barcode is blocked.

Pass/Fail:

```text
Result:
Notes:
```

### UAT-008 Tracking Modes

Steps:

1. Create or open a non-tracked product.
2. Create or open a lot-tracked product.
3. Create or open a serial-tracked product.
4. Confirm tracking information appears correctly in purchase, inventory, and sales workflows.

Expected:

- Non-tracked products accept normal quantities.
- Lot-tracked products require lot information in stock movements.
- Serial-tracked products require one serial per unit.

Pass/Fail:

```text
Result:
Notes:
```

## 9. Partner Tests

### UAT-009 Partner Types

Steps:

1. Open Partners.
2. Create a customer-only partner.
3. Create a supplier-only partner.
4. Create a partner that is both customer and supplier.

Expected:

- Customer-only partner appears in customer selectors.
- Supplier-only partner appears in supplier selectors.
- Both-type partner appears in both selectors.

Pass/Fail:

```text
Result:
Notes:
```

### UAT-010 Partner Contacts And Addresses

Steps:

1. Open an existing partner.
2. Add contact information.
3. Add address information.
4. Save and reopen.

Expected:

- Contact and address data is saved.
- Partner detail shows the correct information.

Pass/Fail:

```text
Result:
Notes:
```

### UAT-011 Payment Terms

Steps:

1. Open Partner Payment Terms.
2. Create a payment term with a text description.
3. Edit it.
4. Confirm partner form does not show unrelated partner information on payment terms page.

Expected:

- Payment terms are managed separately from partner form.
- Text field saves correctly.

Pass/Fail:

```text
Result:
Notes:
```

## 10. Inventory Location And Opening Stock Tests

### UAT-012 Location Management

Steps:

1. Open Inventory -> Locations.
2. Create a warehouse location.
3. Create a display shop location.
4. Create a transit location.
5. Deactivate or delete a test location.

Expected:

- Location type is saved correctly.
- Deleted/inactive locations are hidden from normal selectors.
- Transit locations are available for transfers but not as sales source locations.

Pass/Fail:

```text
Result:
Notes:
```

### UAT-013 Opening Stock Template And Validation

Steps:

1. Open Inventory -> Opening Stock.
2. Download or view the import template.
3. Prepare valid opening stock rows.
4. Prepare invalid rows with wrong SKU, duplicate serial, missing cost, or wrong location.
5. Run preview/import.

Expected:

- Valid rows are accepted.
- Invalid rows show clear error messages.
- Import does not post bad rows silently.

Pass/Fail:

```text
Result:
Notes:
```

### UAT-014 Opening Stock Posting

Steps:

1. Import valid opening stock.
2. Open Inventory stock by location.
3. Open Stock Card for the product.
4. Open Serial History for serial-tracked product.

Expected:

- Stock quantity increases in the selected location.
- Stock card shows opening movement.
- Serial history shows current serial location.

Pass/Fail:

```text
Result:
Notes:
```

## 11. Inventory Visibility Tests

### UAT-015 Stock By Location

Steps:

1. Open Inventory.
2. Filter by location if available.
3. Compare displayed stock with opening stock and later movements.

Expected:

- Quantities match posted stock movements.
- No duplicate table key or duplicate row display appears.
- Serial and bulk rows are clearly distinguishable.

Pass/Fail:

```text
Result:
Notes:
```

### UAT-016 Stock Card

Steps:

1. Open Inventory -> Stock Card.
2. Select a product.
3. Review movement history.

Expected:

- Movement history shows opening, purchase receipt, sale delivery, adjustment, return, or transfer movements as applicable.
- Balance matches stock by location.

Pass/Fail:

```text
Result:
Notes:
```

### UAT-017 Serial History

Steps:

1. Open Inventory -> Serial History.
2. Search for a serial number.
3. Confirm all related movements.

Expected:

- Serial current location matches the latest posted movement.
- Serial is not shown as active in two physical locations at once.

Pass/Fail:

```text
Result:
Notes:
```

## 12. Purchasing Tests

### UAT-018 Purchase Order With Notebook Lines

Steps:

1. Open Purchasing.
2. Create a new purchase order/RFQ.
3. Select supplier, deadline, expected arrival, and delivery location.
4. Add multiple order lines in the notebook.
5. Select product, quantity, unit cost, and one or more taxes.
6. Switch notebook tabs before saving.
7. Save.

Expected:

- Multiple purchase order lines are saved.
- Notebook tab switching does not remove entered lines.
- Line subtotal, tax, and total are calculated correctly.
- Tax selector supports many taxes when configured.

Pass/Fail:

```text
Result:
Notes:
```

### UAT-019 Purchase Order Edit And Approval

Steps:

1. Open a draft purchase order.
2. Edit header and lines.
3. Save.
4. Approve/confirm the purchase order.
5. Try to edit posted/locked information if UI allows.

Expected:

- Draft purchase order is editable.
- Confirmed order state is clear.
- Locked documents cannot be silently changed.

Pass/Fail:

```text
Result:
Notes:
```

### UAT-020 Goods Receipt From Purchase

Steps:

1. Open confirmed purchase order.
2. Create receipt.
3. Receive partial quantity.
4. For serial-tracked product, enter serial number during receipt.
5. Post receipt.
6. Open Inventory.

Expected:

- Receipt is listed separately under Purchasing -> Receipts.
- Receipt detail shows product lines and serial/lot information.
- Receipt creates inventory movement.
- Stock quantity increases.
- Partial receipt keeps remaining quantity open.

Pass/Fail:

```text
Result:
Notes:
```

### UAT-021 Vendor Bill From PO Or Receipt

Steps:

1. Open purchase order or receipt.
2. Create vendor bill.
3. Confirm bill lines include purchased products.
4. Confirm taxes from purchase lines are copied or selectable.
5. Post vendor bill.

Expected:

- Vendor bill is listed separately under Purchasing -> Vendor Bills.
- Bill detail shows product lines, taxes, untaxed amount, tax amount, total, residual.
- Posted bill cannot be silently edited.

Pass/Fail:

```text
Result:
Notes:
```

### UAT-022 Purchase Smart Buttons

Steps:

1. Open a purchase order with receipt, vendor bill, landed cost, and payment if available.
2. Click smart buttons for Receipts, Vendor Bills, Payments, and Landed Costs.

Expected:

- Each smart button opens the related filtered list or document.
- Related documents link back to purchase order.

Pass/Fail:

```text
Result:
Notes:
```

## 13. Payment Configuration And Supplier Payment Tests

### UAT-023 Payment Methods And Accounts

Steps:

1. Open Settings -> Payments.
2. Create payment methods for cash, bank transfer, mobile money, and card if needed.
3. Create payment accounts for each bank/cash account.
4. Try duplicate active payment method code.
5. Mark a method inactive.

Expected:

- Duplicate active code is blocked.
- Inactive method is hidden from payment forms.
- Payment account clearly identifies which bank or cash account was used.

Pass/Fail:

```text
Result:
Notes:
```

### UAT-024 Supplier Payment Full And Partial

Steps:

1. Open a posted vendor bill.
2. Register partial payment using a bank account.
3. Confirm residual remains.
4. Register remaining payment.
5. Confirm bill becomes paid.
6. Open payment document.

Expected:

- Partial payment leaves correct residual amount.
- Full payment marks bill as paid.
- Payment document links back to vendor bill.
- Payment shows payment method, account/bank, date, reference, and amount.

Pass/Fail:

```text
Result:
Notes:
```

### UAT-025 Supplier Payment Overpayment And Cancel

Steps:

1. Try to pay more than vendor bill residual.
2. Cancel a posted payment if cancel is available.
3. Reopen vendor bill.

Expected:

- Overpayment is blocked unless vendor credit policy is implemented.
- Cancelling payment restores payable/residual amount.

Pass/Fail:

```text
Result:
Notes:
```

## 14. Expense Tests

### UAT-026 Expense Category

Steps:

1. Open Expenses -> Categories.
2. Create category, such as Fuel, Rent, Salary Advance, Transport, Repair.
3. Edit and delete a test category.

Expected:

- Category saves correctly.
- Deleted category is hidden from normal expense creation.

Pass/Fail:

```text
Result:
Notes:
```

### UAT-027 Paid Expense

Steps:

1. Open Expenses.
2. Create a paid expense.
3. Select category, date, amount, payment method, payment account/bank, optional partner/employee/location.
4. Save.
5. Open expense detail and payment document.

Expected:

- Paid expense creates or links payment record.
- Payment record shows which bank/cash account was used.
- Expense appears in normal expense list.

Pass/Fail:

```text
Result:
Notes:
```

### UAT-028 Unpaid Expense And Later Payment

Steps:

1. Create an unpaid expense.
2. Open the expense detail.
3. Register payment later.

Expected:

- Expense starts as unpaid.
- Payment changes expense to paid or updates residual/payment status.
- Payment document links back to expense.

Pass/Fail:

```text
Result:
Notes:
```

### UAT-029 Cancel Expense

Steps:

1. Open a test expense.
2. Cancel it.
3. Return to expense list.

Expected:

- Cancelled expense is not included in normal expense totals.
- Cancelled expense is still auditable if cancelled view exists.

Pass/Fail:

```text
Result:
Notes:
```

## 15. Landed Cost Tests

### UAT-030 Create Landed Cost

Steps:

1. Open purchase order or receipt.
2. Create landed cost.
3. Enter freight/customs/handling amount.
4. Link to purchase order or receipt.
5. Select allocation method: quantity, value, or manual.

Expected:

- Landed cost document is created.
- Allocation preview is visible.
- Normal expense remains separate from landed cost.

Pass/Fail:

```text
Result:
Notes:
```

### UAT-031 Post Landed Cost

Steps:

1. Open landed cost detail.
2. Review allocation lines.
3. Post landed cost.
4. Open receipt lines, product serial/lot detail, or stock valuation fields if available.

Expected:

- Landed cost cannot post without receipt lines.
- Allocation total equals landed cost amount.
- Posted landed cost updates inventory valuation fields.
- Posted landed cost cannot be edited.

Pass/Fail:

```text
Result:
Notes:
```

## 16. Sales Tests

### UAT-032 Create Quotation With Multiple Lines

Steps:

1. Open Sales.
2. Create quotation.
3. Select customer, source location, date, and other header fields.
4. Add multiple order lines.
5. Select product, quantity, unit price, and taxes.
6. Switch notebook tabs before saving.
7. Save quotation.

Expected:

- Quotation saves without stock movement.
- Customer selector shows customer-only and both-type partners, not supplier-only partners.
- Line subtotal, tax, and total are calculated correctly.
- Notebook tab switching does not remove line data.

Pass/Fail:

```text
Result:
Notes:
```

### UAT-033 Confirm Sales Order

Steps:

1. Open draft quotation.
2. Confirm it to sales order.
3. Check status and smart buttons.

Expected:

- Quotation changes to confirmed sales order.
- Smart buttons for Deliveries, Invoices, Payments, and Returns are visible or accessible.
- No stock leaves inventory until delivery is posted.

Pass/Fail:

```text
Result:
Notes:
```

### UAT-034 Delivery From Sales Order

Steps:

1. Open confirmed sales order.
2. Create delivery.
3. Select delivered quantities.
4. For serial-tracked product, select serial number.
5. Post delivery.
6. Open Inventory.

Expected:

- Delivery is listed separately under Sales -> Deliveries.
- Delivery creates stock movement with sale delivery type.
- Stock quantity decreases.
- Serial status/location updates.
- Same serial cannot be delivered twice.

Pass/Fail:

```text
Result:
Notes:
```

### UAT-035 Customer Invoice From Sales

Steps:

1. Open sales order or posted delivery.
2. Create customer invoice.
3. Review invoice lines, taxes, total, and residual.
4. Post invoice.

Expected:

- Invoice appears under Sales -> Invoices.
- Invoice amount matches sales order/delivery policy.
- Posted invoice creates receivable balance.
- Posted invoice cannot be silently edited.

Pass/Fail:

```text
Result:
Notes:
```

### UAT-036 Customer Payment Full And Partial

Steps:

1. Open posted customer invoice.
2. Register partial payment.
3. Confirm residual remains.
4. Register remaining payment.
5. Open payment document.

Expected:

- Partial payment leaves correct residual.
- Full payment marks invoice as paid.
- Payment document shows inbound payment, method, account/bank, reference, and related invoice.

Pass/Fail:

```text
Result:
Notes:
```

### UAT-037 Customer Overpayment And Cancel

Steps:

1. Try to register payment greater than invoice residual.
2. Cancel payment if cancel is available.
3. Reopen invoice.

Expected:

- Overpayment is blocked unless customer credit policy is implemented.
- Cancelling payment restores receivable balance.

Pass/Fail:

```text
Result:
Notes:
```

## 17. Inventory Operations Tests

### UAT-038 Operation Lists And Filters

Steps:

1. Open Inventory -> Operations.
2. Open receipt filter.
3. Open delivery filter.
4. Open adjustment filter.
5. Open scrap filter.
6. Open returns filter.

Expected:

- Each filter shows the correct movement/document types.
- Operation detail links back to source document where available.

Pass/Fail:

```text
Result:
Notes:
```

### UAT-039 Adjustment Operation

Steps:

1. Create inventory adjustment.
2. Select product, location, quantity, and cost if required.
3. Post.
4. Check stock by location and stock card.

Expected:

- Adjustment creates movement lines.
- Stock balance reconciles with stock card.
- Posted operation cannot be silently edited.

Pass/Fail:

```text
Result:
Notes:
```

### UAT-040 Scrap Operation

Steps:

1. Create scrap operation.
2. Select source location and product.
3. Post.
4. Check stock.

Expected:

- Stock decreases from source location.
- Serial/lot status changes correctly if tracked.
- Posted operation is traceable.

Pass/Fail:

```text
Result:
Notes:
```

## 18. Returns, Refund Placeholders, And Warranty Tests

### UAT-041 Customer Return

Steps:

1. Open Sales -> Returns.
2. Create customer return referencing original sale or delivery.
3. Select product, quantity, condition, and serial/lot if needed.
4. Post return.
5. Open Inventory and Serial History.

Expected:

- Customer return references original sale/delivery.
- Return receipt creates stock movement.
- Returned serial goes to correct status/location based on condition.
- Refund placeholder is available if implemented.

Pass/Fail:

```text
Result:
Notes:
```

### UAT-042 Supplier Return

Steps:

1. Open Purchasing -> Returns.
2. Create supplier return referencing original receipt.
3. Select product, quantity, condition, and serial/lot if needed.
4. Post return.
5. Open Inventory and Serial History.

Expected:

- Supplier return references original purchase receipt.
- Stock decreases from source location.
- Vendor refund placeholder is available if implemented.

Pass/Fail:

```text
Result:
Notes:
```

### UAT-043 Warranty And Serial Ownership

Steps:

1. Sell and deliver a serial-tracked product.
2. Open serial history or product tracking.
3. Check warranty/ownership record if visible.

Expected:

- Warranty registration is created for serial sale when applicable.
- Serial ownership history links customer, sale, delivery, and serial.
- Returned serial updates ownership/status history.

Pass/Fail:

```text
Result:
Notes:
```

## 19. Transfer Tests

### UAT-044 Create Draft Transfer

Steps:

1. Open Inventory -> Transfers.
2. Create new transfer.
3. Select From location, Transit location, and To location.
4. Add multiple lines.
5. For serial-tracked product, enter serial number and quantity `1`.
6. For lot-tracked product, enter lot number.
7. Save draft.

Expected:

- Transfer draft is created.
- Source, transit, and destination cannot be the same.
- Serialized product requires quantity `1` and serial number.
- Lot-tracked product requires lot number.

Pass/Fail:

```text
Result:
Notes:
```

### UAT-045 Transfer Approval

Steps:

1. Open draft transfer.
2. Try to dispatch before approval if a direct action is available.
3. Approve transfer.

Expected:

- Transfer cannot dispatch before approval.
- Approved state is clear.
- Cancel is allowed only while draft or approved.

Pass/Fail:

```text
Result:
Notes:
```

### UAT-046 Transfer Dispatch

Steps:

1. Open approved transfer.
2. Dispatch transfer.
3. Open Inventory -> Operations or smart dispatch movement.
4. Check stock by location.

Expected:

- Dispatch creates movement from source to transit.
- Source stock decreases.
- Transit stock increases.
- Serial status becomes in-transit.
- In-transit stock is not available for sales.

Pass/Fail:

```text
Result:
Notes:
```

### UAT-047 Partial Transfer Receipt

Steps:

1. Open dispatched transfer.
2. Receive only part of the remaining quantity.
3. Select discrepancy if needed.
4. Post receipt.
5. Reopen transfer.

Expected:

- Partial receipt creates movement from transit to destination.
- Transfer status becomes partially received.
- Remaining quantity stays open.
- Discrepancy is saved on the line.

Pass/Fail:

```text
Result:
Notes:
```

### UAT-048 Complete Transfer Receipt

Steps:

1. Open partially received or dispatched transfer.
2. Receive remaining quantity.
3. Post receipt.
4. Check stock by location and serial history.

Expected:

- Transfer status becomes received.
- Transit stock decreases.
- Destination stock increases.
- Serial current location is destination.
- Serial does not exist in source and destination at the same time.

Pass/Fail:

```text
Result:
Notes:
```

## 20. End-To-End Business Scenarios

### UAT-049 Purchase To Stock To Supplier Payment

Steps:

1. Create supplier.
2. Create purchase order with multiple products and tax.
3. Confirm purchase order.
4. Receive stock, including serial/lot where needed.
5. Create and post vendor bill.
6. Register supplier payment through a bank account.
7. Check inventory, vendor bill residual, payment document, and purchase smart buttons.

Expected:

- Stock enters inventory through receipt.
- Vendor bill tracks payable.
- Payment reduces payable.
- Payment document identifies which bank/account was used.
- Purchase order links to receipt, vendor bill, and payment.

Pass/Fail:

```text
Result:
Notes:
```

### UAT-050 Sale To Delivery To Customer Payment

Steps:

1. Create customer.
2. Create quotation with products and tax.
3. Confirm to sales order.
4. Create and post delivery.
5. Create and post customer invoice.
6. Register customer payment through cash or bank account.
7. Check inventory, invoice residual, payment document, and sales smart buttons.

Expected:

- Quotation does not move stock.
- Delivery decreases stock.
- Invoice tracks receivable.
- Payment reduces receivable.
- Payment document identifies which bank/account was used.

Pass/Fail:

```text
Result:
Notes:
```

### UAT-051 Expense Payment Tracking

Steps:

1. Create expense category.
2. Create unpaid expense.
3. Register payment through a selected bank/cash account.
4. Create a separate paid expense directly.
5. Review expense list and payment documents.

Expected:

- Expenses are categorized.
- Paid/unpaid state is understandable.
- Payment records show bank/cash account.
- Cancelled expenses are excluded from normal totals.

Pass/Fail:

```text
Result:
Notes:
```

### UAT-052 Stock Transfer Between Shops

Steps:

1. Ensure stock exists in Main Warehouse.
2. Create transfer from Main Warehouse to Display Shop through Transit.
3. Approve and dispatch.
4. Confirm stock is in transit and not sellable.
5. Receive partially.
6. Receive remaining quantity.
7. Check stock card and serial history.

Expected:

- Transfer follows approval, dispatch, and receipt stages.
- Partial receipt remains open.
- Completed receipt updates destination stock.
- Stock card and serial history show complete trace.

Pass/Fail:

```text
Result:
Notes:
```

## 21. Data Reconciliation Checks

Run these checks at the end of a testing day.

### UAT-053 Stock Reconciliation

Steps:

1. Pick 3 products: one bulk, one serial, one lot-tracked.
2. Compare stock by location with stock card movement totals.
3. Compare serial current location with serial movement history.

Expected:

- Stock by location equals posted movement history.
- Serial current location equals latest posted serial movement.

Pass/Fail:

```text
Result:
Notes:
```

### UAT-054 Payable And Receivable Reconciliation

Steps:

1. List posted vendor bills.
2. Compare total, payments, and residual.
3. List posted customer invoices.
4. Compare total, payments, and residual.

Expected:

- Paid documents have zero residual.
- Partially paid documents show correct residual.
- Cancelled documents do not affect normal balances.

Pass/Fail:

```text
Result:
Notes:
```

### UAT-055 Bank/Payment Account Transaction Check

Steps:

1. Pick each payment account/bank.
2. List supplier payments, customer payments, and expense payments made through that account.
3. Compare total inbound and outbound amounts.

Expected:

- Every payment has method, account/bank, amount, date, and reference if required.
- Reports or lists can answer which bank/cash account was used for each transaction.

Pass/Fail:

```text
Result:
Notes:
```

## 22. Usability Questions For Real Users

Ask users these questions after each session:

```text
Which task did you try?
Could you find the menu without help?
Which field names were confusing?
Which step felt too long?
Did the document status make sense?
Did totals and quantities look trustworthy?
What would you need on paper/receipt/report after this task?
What is the most important missing shortcut?
Would you use this flow during a busy workday?
```

## 23. Sign-Off Template

Use this after one complete pilot test.

```text
Tester name:
Role tested:
Date:
Environment:

Modules tested:
- Products:
- Partners:
- Inventory:
- Purchasing:
- Payments:
- Expenses:
- Landed Costs:
- Sales:
- Returns/Warranty:
- Transfers:

Critical issues open:
High issues open:
Medium issues open:
Low issues open:

Can this workflow move to the next build step? Yes / No
Reason:
```

## 24. Minimum Pass Criteria Before Continuing

Do not start offline POS until all of these are true:

- Product setup is stable.
- Customer and supplier setup is stable.
- Opening stock can be imported and verified.
- Purchase order to receipt to vendor bill to supplier payment works.
- Sales quotation to delivery to invoice to customer payment works.
- Expenses can be recorded and paid with payment account/bank tracking.
- Transfers can move stock between locations through transit.
- Serial-tracked products cannot be sold, returned, or transferred incorrectly.
- Stock card and stock by location reconcile for tested products.
- Vendor bill and customer invoice residual amounts reconcile with payments.
- No critical issue is open.
- High issues have an agreed fix plan.


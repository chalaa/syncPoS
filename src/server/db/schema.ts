import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  char,
  check,
  date,
  index,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

const softDelete = {
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  deletedBy: uuid("deleted_by"),
  deleteReason: text("delete_reason"),
};

export const locationType = pgEnum("location_type", [
  "warehouse",
  "display_shop",
  "transit",
  "adjustment",
  "scrap",
  "customer",
  "supplier",
]);

export const deviceStatus = pgEnum("device_status", ["active", "revoked", "replaced"]);
export const userStatus = pgEnum("user_status", ["active", "disabled", "locked"]);
export const employeeStatus = pgEnum("employee_status", ["active", "inactive"]);
export const auditSeverity = pgEnum("audit_severity", ["info", "warning", "critical"]);
export const trackingMode = pgEnum("tracking_mode", ["none", "lot", "serial"]);
export const serialStatus = pgEnum("serial_status", [
  "available",
  "reserved",
  "in_transit",
  "sold",
  "returned",
  "damaged",
  "scrapped",
]);
export const compatibilityType = pgEnum("compatibility_type", [
  "compatible",
  "substitute",
  "accessory",
  "bundle",
  "upsell",
]);
export const partnerStatus = pgEnum("partner_status", ["active", "blocked", "inactive"]);
export const addressType = pgEnum("address_type", ["billing", "delivery", "office", "warehouse"]);
export const stockMovementType = pgEnum("stock_movement_type", [
  "opening_balance",
  "purchase_receipt",
  "sale_issue",
  "sale_delivery",
  "customer_return",
  "supplier_return",
  "transfer",
  "adjustment",
  "scrap",
  "stock_count",
]);
export const stockMovementStatus = pgEnum("stock_movement_status", [
  "draft",
  "posted",
  "void",
]);
export const stockReservationStatus = pgEnum("stock_reservation_status", [
  "active",
  "fulfilled",
  "cancelled",
  "expired",
]);
export const stockCountStatus = pgEnum("stock_count_status", [
  "draft",
  "in_progress",
  "completed",
  "posted",
  "cancelled",
]);
export const stockCountLineStatus = pgEnum("stock_count_line_status", [
  "pending",
  "counted",
  "recount_required",
  "approved",
]);
export const purchaseOrderStatus = pgEnum("purchase_order_status", [
  "draft",
  "confirmed",
  "partially_received",
  "received",
  "cancelled",
]);
export const purchasePaymentTerm = pgEnum("purchase_payment_term", ["cash", "credit"]);
export const goodsReceiptStatus = pgEnum("goods_receipt_status", [
  "draft",
  "posted",
  "cancelled",
]);
export const landedCostStatus = pgEnum("landed_cost_status", [
  "draft",
  "allocated",
  "posted",
  "cancelled",
]);
export const landedCostType = pgEnum("landed_cost_type", [
  "freight",
  "customs",
  "insurance",
  "handling",
  "other",
]);
export const landedCostAllocationMethod = pgEnum("landed_cost_allocation_method", [
  "quantity",
  "value",
  "weight",
  "manual",
]);
export const supplierBillStatus = pgEnum("supplier_bill_status", [
  "placeholder",
  "pending",
  "matched",
  "cancelled",
]);
export const taxScope = pgEnum("tax_scope", ["purchase", "sale", "both"]);
export const taxComputation = pgEnum("tax_computation", ["percent", "fixed"]);
export const vendorBillStatus = pgEnum("vendor_bill_status", [
  "draft",
  "posted",
  "cancelled",
]);
export const vendorBillPaymentStatus = pgEnum("vendor_bill_payment_status", [
  "not_paid",
  "partial",
  "paid",
]);
export const paymentMethodType = pgEnum("payment_method_type", [
  "cash",
  "bank_transfer",
  "mobile_money",
  "card",
]);
export const paymentType = pgEnum("payment_type", ["inbound", "outbound"]);
export const paymentStatus = pgEnum("payment_status", ["draft", "posted", "cancelled"]);
export const expenseStatus = pgEnum("expense_status", ["posted", "cancelled"]);
export const expensePaymentStatus = pgEnum("expense_payment_status", ["unpaid", "paid"]);
export const salesOrderStatus = pgEnum("sales_order_status", [
  "quotation",
  "confirmed",
  "partially_delivered",
  "delivered",
  "invoiced",
  "cancelled",
]);
export const salesPaymentTerm = pgEnum("sales_payment_term", ["cash", "credit"]);
export const deliveryStatus = pgEnum("delivery_status", ["draft", "posted", "cancelled"]);
export const customerInvoiceStatus = pgEnum("customer_invoice_status", [
  "draft",
  "posted",
  "cancelled",
]);
export const customerInvoicePaymentStatus = pgEnum("customer_invoice_payment_status", [
  "not_paid",
  "partial",
  "paid",
]);
export const returnDocumentStatus = pgEnum("return_document_status", [
  "draft",
  "posted",
  "cancelled",
]);
export const returnLineCondition = pgEnum("return_line_condition", [
  "available",
  "returned",
  "damaged",
  "scrapped",
]);
export const refundPlaceholderStatus = pgEnum("refund_placeholder_status", [
  "pending",
  "approved",
  "paid",
  "cancelled",
]);
export const warrantyStatus = pgEnum("warranty_status", [
  "active",
  "expired",
  "void",
]);
export const serialOwnershipType = pgEnum("serial_ownership_type", [
  "sale",
  "customer_return",
  "warranty_registration",
  "supplier_return",
]);
export const transferStatus = pgEnum("transfer_status", [
  "draft",
  "approved",
  "dispatched",
  "partially_received",
  "received",
  "cancelled",
]);
export const transferLineDiscrepancy = pgEnum("transfer_line_discrepancy", [
  "none",
  "shortage",
  "overage",
  "damaged",
]);

export const currencies = pgTable(
  "currencies",
  {
    code: char("code", { length: 3 }).primaryKey(),
    name: varchar("name", { length: 80 }).notNull(),
    minorUnit: smallint("minor_unit").notNull().default(2),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (table) => [check("currencies_minor_unit_chk", sql`${table.minorUnit} between 0 and 6`)],
);

export const companies = pgTable(
  "companies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 20 }).notNull(),
    legalName: varchar("legal_name", { length: 200 }).notNull(),
    tradeName: varchar("trade_name", { length: 200 }),
    tin: varchar("tin", { length: 30 }),
    baseCurrencyCode: char("base_currency_code", { length: 3 })
      .notNull()
      .references(() => currencies.code, { onDelete: "restrict", onUpdate: "cascade" }),
    timezone: varchar("timezone", { length: 50 }).notNull().default("Africa/Addis_Ababa"),
    fiscalYearStartMonth: smallint("fiscal_year_start_month").notNull().default(1),
    logoObjectKey: text("logo_object_key"),
    isActive: boolean("is_active").notNull().default(true),
    ...softDelete,
    ...timestamps,
  },
  (table) => [
    check(
      "companies_fiscal_year_start_month_chk",
      sql`${table.fiscalYearStartMonth} between 1 and 12`,
    ),
    uniqueIndex("companies_code_active_uidx")
      .on(table.code)
      .where(sql`${table.deletedAt} is null`),
    uniqueIndex("companies_tin_active_uidx")
      .on(table.tin)
      .where(sql`${table.tin} is not null and ${table.deletedAt} is null`),
  ],
);

export const owners = pgTable(
  "owners",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict", onUpdate: "cascade" }),
    name: varchar("name", { length: 160 }).notNull(),
    ...softDelete,
    ...timestamps,
  },
  (table) => [
    check("owners_name_not_empty_chk", sql`length(trim(${table.name})) > 0`),
    uniqueIndex("owners_company_name_active_uidx")
      .on(table.companyId, table.name)
      .where(sql`${table.deletedAt} is null`),
    index("owners_company_name_idx").on(table.companyId, table.name),
  ],
);

export const employees = pgTable(
  "employees",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict", onUpdate: "cascade" }),
    employeeNo: varchar("employee_no", { length: 40 }),
    fullName: varchar("full_name", { length: 160 }).notNull(),
    phone: varchar("phone", { length: 40 }),
    email: varchar("email", { length: 160 }),
    status: employeeStatus("status").notNull().default("active"),
    ...softDelete,
    ...timestamps,
  },
  (table) => [
    uniqueIndex("employees_no_active_uidx")
      .on(table.companyId, table.employeeNo)
      .where(sql`${table.employeeNo} is not null and ${table.deletedAt} is null`),
    index("employees_company_status_idx").on(table.companyId, table.status),
  ],
);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict", onUpdate: "cascade" }),
    employeeId: uuid("employee_id").references(() => employees.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    username: varchar("username", { length: 80 }).notNull(),
    email: varchar("email", { length: 160 }),
    normalizedEmail: varchar("normalized_email", { length: 160 }),
    passwordHash: text("password_hash").notNull(),
    emailVerified: boolean("email_verified").notNull().default(false),
    failedLoginAttempts: smallint("failed_login_attempts").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    passwordChangedAt: timestamp("password_changed_at", { withTimezone: true }),
    status: userStatus("status").notNull().default("active"),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    lastLoginIp: varchar("last_login_ip", { length: 80 }),
    ...softDelete,
    ...timestamps,
  },
  (table) => [
    check("users_failed_login_attempts_chk", sql`${table.failedLoginAttempts} >= 0`),
    uniqueIndex("users_username_active_uidx")
      .on(table.companyId, table.username)
      .where(sql`${table.deletedAt} is null`),
    uniqueIndex("users_email_active_uidx")
      .on(table.companyId, table.email)
      .where(sql`${table.email} is not null and ${table.deletedAt} is null`),
    uniqueIndex("users_normalized_email_active_uidx")
      .on(table.companyId, table.normalizedEmail)
      .where(sql`${table.normalizedEmail} is not null and ${table.deletedAt} is null`),
    index("users_company_status_idx").on(table.companyId, table.status),
  ],
);

export const authSessions = pgTable(
  "auth_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" }),
    tokenHash: char("token_hash", { length: 64 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    userAgent: text("user_agent"),
    ipAddress: varchar("ip_address", { length: 80 }),
    rotatedAt: timestamp("rotated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("auth_sessions_expires_after_created_chk", sql`${table.expiresAt} > ${table.createdAt}`),
    uniqueIndex("auth_sessions_token_hash_uidx").on(table.tokenHash),
    index("auth_sessions_user_active_idx").on(table.userId, table.expiresAt, table.revokedAt),
  ],
);

export const roles = pgTable(
  "roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict", onUpdate: "cascade" }),
    code: varchar("code", { length: 80 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    description: text("description"),
    isSystem: boolean("is_system").notNull().default(false),
    isEditable: boolean("is_editable").notNull().default(true),
    isDeletable: boolean("is_deletable").notNull().default(true),
    isActive: boolean("is_active").notNull().default(true),
    ...softDelete,
    ...timestamps,
  },
  (table) => [
    uniqueIndex("roles_code_active_uidx")
      .on(table.companyId, table.code)
      .where(sql`${table.deletedAt} is null`),
  ],
);

export const permissions = pgTable(
  "permissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 120 }).notNull(),
    description: text("description"),
    application: varchar("application", { length: 80 }),
    feature: varchar("feature", { length: 80 }),
    action: varchar("action", { length: 80 }),
    isActive: boolean("is_active").notNull().default(true),
    ...softDelete,
    ...timestamps,
  },
  (table) => [
    uniqueIndex("permissions_parts_active_uidx")
      .on(table.application, table.feature, table.action)
      .where(sql`${table.application} is not null and ${table.feature} is not null and ${table.action} is not null and ${table.deletedAt} is null`),
    uniqueIndex("permissions_code_active_uidx")
      .on(table.code)
      .where(sql`${table.deletedAt} is null`),
  ],
);

export const rolePermissions = pgTable(
  "role_permissions",
  {
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade", onUpdate: "cascade" }),
    permissionId: uuid("permission_id")
      .notNull()
      .references(() => permissions.id, { onDelete: "cascade", onUpdate: "cascade" }),
    grantedAt: timestamp("granted_at", { withTimezone: true }).notNull().defaultNow(),
    grantedBy: uuid("granted_by").references(() => users.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
  },
  (table) => [primaryKey({ columns: [table.roleId, table.permissionId] })],
);

export const userRoles = pgTable(
  "user_roles",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" }),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "restrict", onUpdate: "cascade" }),
    validFrom: timestamp("valid_from", { withTimezone: true }),
    validTo: timestamp("valid_to", { withTimezone: true }),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
    assignedBy: uuid("assigned_by").references(() => users.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.roleId] }),
    index("user_roles_validity_idx").on(table.userId, table.validFrom, table.validTo),
  ],
);

export const locations = pgTable(
  "locations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict", onUpdate: "cascade" }),
    parentLocationId: uuid("parent_location_id").references((): AnyPgColumn => locations.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    code: varchar("code", { length: 20 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    locationType: locationType("location_type").notNull(),
    addressJson: jsonb("address_json"),
    offlineSalesEnabled: boolean("offline_sales_enabled").notNull().default(false),
    allowNegativeStock: boolean("allow_negative_stock").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    ...softDelete,
    ...timestamps,
  },
  (table) => [
    uniqueIndex("locations_code_active_uidx")
      .on(table.companyId, table.code)
      .where(sql`${table.deletedAt} is null`),
    index("locations_type_active_idx").on(table.companyId, table.locationType, table.isActive),
    index("locations_parent_idx").on(table.parentLocationId),
  ],
);

export const userLocationAccess = pgTable(
  "user_location_access",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" }),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "restrict", onUpdate: "cascade" }),
    canView: boolean("can_view").notNull().default(true),
    canTransact: boolean("can_transact").notNull().default(false),
    validFrom: timestamp("valid_from", { withTimezone: true }),
    validTo: timestamp("valid_to", { withTimezone: true }),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
    assignedBy: uuid("assigned_by").references(() => users.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.locationId] }),
    index("user_location_access_validity_idx").on(table.userId, table.validFrom, table.validTo),
  ],
);

export const devices = pgTable(
  "devices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "restrict", onUpdate: "cascade" }),
    deviceKeyHash: varchar("device_key_hash", { length: 128 }).notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    platform: varchar("platform", { length: 80 }),
    isPrimaryOfflineDevice: boolean("is_primary_offline_device").notNull().default(false),
    status: deviceStatus("status").notNull().default("active"),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    lastSyncCursor: bigint("last_sync_cursor", { mode: "number" }).notNull().default(0),
    storagePersistent: boolean("storage_persistent").notNull().default(false),
    ...softDelete,
    ...timestamps,
  },
  (table) => [
    uniqueIndex("devices_key_hash_uidx").on(table.deviceKeyHash),
    uniqueIndex("devices_primary_active_uidx")
      .on(table.locationId)
      .where(
        sql`${table.isPrimaryOfflineDevice} = true and ${table.status} = 'active' and ${table.deletedAt} is null`,
      ),
    index("devices_location_status_idx").on(table.locationId, table.status),
  ],
);

export const attachments = pgTable(
  "attachments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict", onUpdate: "cascade" }),
    entityType: varchar("entity_type", { length: 80 }).notNull(),
    entityId: uuid("entity_id").notNull(),
    objectKey: text("object_key").notNull(),
    fileName: varchar("file_name", { length: 240 }).notNull(),
    mimeType: varchar("mime_type", { length: 120 }).notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    sha256Hash: char("sha256_hash", { length: 64 }).notNull(),
    uploadedBy: uuid("uploaded_by").references(() => users.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    ...softDelete,
    ...timestamps,
  },
  (table) => [
    index("attachments_entity_idx").on(table.entityType, table.entityId),
    index("attachments_company_idx").on(table.companyId),
  ],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict", onUpdate: "cascade" }),
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    deviceId: uuid("device_id").references(() => devices.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    locationId: uuid("location_id").references(() => locations.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    action: varchar("action", { length: 120 }).notNull(),
    entityType: varchar("entity_type", { length: 80 }).notNull(),
    entityId: uuid("entity_id"),
    severity: auditSeverity("severity").notNull().default("info"),
    beforeHash: char("before_hash", { length: 64 }),
    afterHash: char("after_hash", { length: 64 }),
    metadata: jsonb("metadata").notNull().default({}),
    ipAddress: varchar("ip_address", { length: 64 }),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("audit_logs_entity_time_idx").on(table.entityType, table.entityId, table.occurredAt),
    index("audit_logs_actor_time_idx").on(table.actorUserId, table.occurredAt),
    index("audit_logs_company_time_idx").on(table.companyId, table.occurredAt),
  ],
);

export const productCategories = pgTable(
  "product_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict", onUpdate: "cascade" }),
    parentCategoryId: uuid("parent_category_id").references(
      (): AnyPgColumn => productCategories.id,
      {
        onDelete: "restrict",
        onUpdate: "cascade",
      },
    ),
    code: varchar("code", { length: 40 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    description: text("description"),
    isActive: boolean("is_active").notNull().default(true),
    ...softDelete,
    ...timestamps,
  },
  (table) => [
    uniqueIndex("product_categories_code_active_uidx")
      .on(table.companyId, table.code)
      .where(sql`${table.deletedAt} is null`),
    uniqueIndex("product_categories_name_active_uidx")
      .on(
        table.companyId,
        sql`coalesce(${table.parentCategoryId}, '00000000-0000-0000-0000-000000000000'::uuid)`,
        table.name,
      )
      .where(sql`${table.deletedAt} is null`),
    index("product_categories_company_name_idx").on(table.companyId, table.name),
    index("product_categories_parent_idx").on(table.parentCategoryId),
  ],
);

export const brands = pgTable(
  "brands",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict", onUpdate: "cascade" }),
    code: varchar("code", { length: 40 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    description: text("description"),
    isActive: boolean("is_active").notNull().default(true),
    ...softDelete,
    ...timestamps,
  },
  (table) => [
    uniqueIndex("brands_code_active_uidx")
      .on(table.companyId, table.code)
      .where(sql`${table.deletedAt} is null`),
    uniqueIndex("brands_name_active_uidx")
      .on(table.companyId, table.name)
      .where(sql`${table.deletedAt} is null`),
  ],
);

export const unitsOfMeasure = pgTable(
  "units_of_measure",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict", onUpdate: "cascade" }),
    code: varchar("code", { length: 20 }).notNull(),
    name: varchar("name", { length: 80 }).notNull(),
    precision: numeric("precision", { precision: 20, scale: 6 }).notNull().default("1"),
    isActive: boolean("is_active").notNull().default(true),
    ...softDelete,
    ...timestamps,
  },
  (table) => [
    check("units_of_measure_precision_chk", sql`${table.precision} > 0`),
    uniqueIndex("units_of_measure_code_active_uidx")
      .on(table.companyId, table.code)
      .where(sql`${table.deletedAt} is null`),
  ],
);

export const catalogAttributes = pgTable(
  "catalog_attributes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict", onUpdate: "cascade" }),
    code: varchar("code", { length: 40 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    isActive: boolean("is_active").notNull().default(true),
    ...softDelete,
    ...timestamps,
  },
  (table) => [
    uniqueIndex("catalog_attributes_code_active_uidx")
      .on(table.companyId, table.code)
      .where(sql`${table.deletedAt} is null`),
    uniqueIndex("catalog_attributes_name_active_uidx")
      .on(table.companyId, table.name)
      .where(sql`${table.deletedAt} is null`),
  ],
);

export const catalogAttributeValues = pgTable(
  "catalog_attribute_values",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict", onUpdate: "cascade" }),
    attributeId: uuid("attribute_id")
      .notNull()
      .references(() => catalogAttributes.id, { onDelete: "cascade", onUpdate: "cascade" }),
    value: varchar("value", { length: 120 }).notNull(),
    sortOrder: smallint("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    ...softDelete,
    ...timestamps,
  },
  (table) => [
    uniqueIndex("catalog_attribute_values_active_uidx")
      .on(table.attributeId, table.value)
      .where(sql`${table.deletedAt} is null`),
    index("catalog_attribute_values_attribute_idx").on(table.attributeId, table.sortOrder),
  ],
);

export const productCategoryAttributes = pgTable(
  "product_category_attributes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict", onUpdate: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => productCategories.id, { onDelete: "cascade", onUpdate: "cascade" }),
    attributeId: uuid("attribute_id")
      .notNull()
      .references(() => catalogAttributes.id, { onDelete: "restrict", onUpdate: "cascade" }),
    isRequired: boolean("is_required").notNull().default(false),
    sortOrder: smallint("sort_order").notNull().default(0),
    ...softDelete,
    ...timestamps,
  },
  (table) => [
    uniqueIndex("product_category_attributes_active_uidx")
      .on(table.categoryId, table.attributeId)
      .where(sql`${table.deletedAt} is null`),
    index("product_category_attributes_category_idx").on(table.categoryId, table.sortOrder),
  ],
);

export const productTemplates = pgTable(
  "product_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict", onUpdate: "cascade" }),
    categoryId: uuid("category_id").references(() => productCategories.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    brandId: uuid("brand_id").references(() => brands.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    name: varchar("name", { length: 200 }).notNull(),
    description: text("description"),
    unitId: uuid("unit_id").references(() => unitsOfMeasure.id, { onDelete: "restrict", onUpdate: "cascade" }),
    trackingMode: trackingMode("tracking_mode").notNull().default("none"),
    isActive: boolean("is_active").notNull().default(true),
    ...softDelete,
    ...timestamps,
  },
  (table) => [
    uniqueIndex("product_templates_name_active_uidx")
      .on(table.companyId, table.name)
      .where(sql`${table.deletedAt} is null`),
    index("product_templates_category_idx").on(table.categoryId),
    index("product_templates_brand_idx").on(table.brandId),
  ],
);

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict", onUpdate: "cascade" }),
    templateId: uuid("template_id").references(() => productTemplates.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    sku: varchar("sku", { length: 60 }).notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    categoryId: uuid("category_id").references(() => productCategories.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    brandId: uuid("brand_id").references(() => brands.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    model: varchar("model", { length: 100 }),
    description: text("description"),
    unitId: uuid("unit_id")
      .notNull()
      .references(() => unitsOfMeasure.id, { onDelete: "restrict", onUpdate: "cascade" }),
    trackingMode: trackingMode("tracking_mode").notNull().default("none"),
    standardCostMinor: bigint("standard_cost_minor", { mode: "number" }).notNull().default(0),
    listPriceMinor: bigint("list_price_minor", { mode: "number" }).notNull().default(0),
    currencyCode: char("currency_code", { length: 3 })
      .notNull()
      .references(() => currencies.code, { onDelete: "restrict", onUpdate: "cascade" }),
    isActive: boolean("is_active").notNull().default(true),
    ...softDelete,
    ...timestamps,
  },
  (table) => [
    check("products_standard_cost_minor_chk", sql`${table.standardCostMinor} >= 0`),
    check("products_list_price_minor_chk", sql`${table.listPriceMinor} >= 0`),
    uniqueIndex("products_sku_active_uidx")
      .on(table.companyId, table.sku)
      .where(sql`${table.deletedAt} is null`),
    index("products_company_name_idx").on(table.companyId, table.name),
    index("products_category_active_idx").on(table.categoryId, table.isActive),
    index("products_template_idx").on(table.templateId),
  ],
);

export const productTemplateAttributeValues = pgTable(
  "product_template_attribute_values",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict", onUpdate: "cascade" }),
    templateId: uuid("template_id")
      .notNull()
      .references(() => productTemplates.id, { onDelete: "cascade", onUpdate: "cascade" }),
    attributeId: uuid("attribute_id")
      .notNull()
      .references(() => catalogAttributes.id, { onDelete: "restrict", onUpdate: "cascade" }),
    attributeValueId: uuid("attribute_value_id")
      .notNull()
      .references(() => catalogAttributeValues.id, { onDelete: "restrict", onUpdate: "cascade" }),
    ...softDelete,
    ...timestamps,
  },
  (table) => [
    uniqueIndex("product_template_attribute_values_active_uidx")
      .on(table.templateId, table.attributeValueId)
      .where(sql`${table.deletedAt} is null`),
    index("product_template_attribute_values_template_idx").on(table.templateId, table.attributeId),
  ],
);

export const productVariantAttributeValues = pgTable(
  "product_variant_attribute_values",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict", onUpdate: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade", onUpdate: "cascade" }),
    attributeId: uuid("attribute_id")
      .notNull()
      .references(() => catalogAttributes.id, { onDelete: "restrict", onUpdate: "cascade" }),
    attributeValueId: uuid("attribute_value_id")
      .notNull()
      .references(() => catalogAttributeValues.id, { onDelete: "restrict", onUpdate: "cascade" }),
    ...softDelete,
    ...timestamps,
  },
  (table) => [
    uniqueIndex("product_variant_attribute_values_active_uidx")
      .on(table.productId, table.attributeId)
      .where(sql`${table.deletedAt} is null`),
    index("product_variant_attribute_values_product_idx").on(table.productId),
    index("product_variant_attribute_values_value_idx").on(table.attributeValueId),
  ],
);

export const productAttributes = pgTable(
  "product_attributes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade", onUpdate: "cascade" }),
    attributeName: varchar("attribute_name", { length: 80 }).notNull(),
    attributeValue: varchar("attribute_value", { length: 200 }).notNull(),
    sortOrder: smallint("sort_order").notNull().default(0),
    ...softDelete,
    ...timestamps,
  },
  (table) => [
    uniqueIndex("product_attributes_name_active_uidx")
      .on(table.productId, table.attributeName)
      .where(sql`${table.deletedAt} is null`),
  ],
);

export const productCompatibilities = pgTable(
  "product_compatibilities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict", onUpdate: "cascade" }),
    relatedProductId: uuid("related_product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict", onUpdate: "cascade" }),
    compatibilityType: compatibilityType("compatibility_type").notNull().default("compatible"),
    notes: text("notes"),
    effectiveFrom: date("effective_from"),
    effectiveTo: date("effective_to"),
    isActive: boolean("is_active").notNull().default(true),
    ...softDelete,
    ...timestamps,
  },
  (table) => [
    check("product_compatibilities_not_self_chk", sql`${table.productId} <> ${table.relatedProductId}`),
    check(
      "product_compatibilities_date_range_chk",
      sql`${table.effectiveTo} is null or ${table.effectiveFrom} is null or ${table.effectiveTo} >= ${table.effectiveFrom}`,
    ),
    uniqueIndex("product_compatibilities_active_uidx")
      .on(table.productId, table.relatedProductId, table.compatibilityType)
      .where(sql`${table.deletedAt} is null`),
  ],
);

export const productSaleTaxes = pgTable(
  "product_sale_taxes",
  {
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade", onUpdate: "cascade" }),
    taxId: uuid("tax_id")
      .notNull()
      .references(() => taxes.id, { onDelete: "restrict", onUpdate: "cascade" }),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.productId, table.taxId] }),
    index("product_sale_taxes_tax_idx").on(table.taxId),
  ],
);

export const productPurchaseTaxes = pgTable(
  "product_purchase_taxes",
  {
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade", onUpdate: "cascade" }),
    taxId: uuid("tax_id")
      .notNull()
      .references(() => taxes.id, { onDelete: "restrict", onUpdate: "cascade" }),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.productId, table.taxId] }),
    index("product_purchase_taxes_tax_idx").on(table.taxId),
  ],
);

export const priceLists = pgTable(
  "price_lists",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict", onUpdate: "cascade" }),
    ownerId: uuid("owner_id").references(() => owners.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    name: varchar("name", { length: 120 }).notNull(),
    currencyCode: char("currency_code", { length: 3 })
      .notNull()
      .references(() => currencies.code, { onDelete: "restrict", onUpdate: "cascade" }),
    isActive: boolean("is_active").notNull().default(true),
    ...softDelete,
    ...timestamps,
  },
  (table) => [
    uniqueIndex("price_lists_name_owner_active_uidx")
      .on(table.companyId, table.name, table.ownerId)
      .where(sql`${table.deletedAt} is null`),
    index("price_lists_owner_active_idx").on(table.companyId, table.ownerId, table.isActive),
  ],
);

export const priceListItems = pgTable(
  "price_list_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    priceListId: uuid("price_list_id")
      .notNull()
      .references(() => priceLists.id, { onDelete: "cascade", onUpdate: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict", onUpdate: "cascade" }),
    minimumQuantity: numeric("minimum_quantity", { precision: 20, scale: 6 })
      .notNull()
      .default("1"),
    unitPriceMinor: bigint("unit_price_minor", { mode: "number" }).notNull(),
    discountMinor: bigint("discount_minor", { mode: "number" }).notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    ...softDelete,
    ...timestamps,
  },
  (table) => [
    check("price_list_items_minimum_quantity_chk", sql`${table.minimumQuantity} > 0`),
    check("price_list_items_unit_price_minor_chk", sql`${table.unitPriceMinor} >= 0`),
    check("price_list_items_discount_minor_chk", sql`${table.discountMinor} >= 0`),
    uniqueIndex("price_list_items_product_qty_active_uidx")
      .on(table.priceListId, table.productId, table.minimumQuantity)
      .where(sql`${table.deletedAt} is null`),
    index("price_list_items_product_idx").on(table.productId),
  ],
);

export const productSerials = pgTable(
  "product_serials",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict", onUpdate: "cascade" }),
    serialNo: varchar("serial_no", { length: 120 }).notNull(),
    engineNo: varchar("engine_no", { length: 120 }),
    chassisNo: varchar("chassis_no", { length: 120 }),
    status: serialStatus("status").notNull().default("available"),
    currentLocationId: uuid("current_location_id").references(() => locations.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    landedUnitCostMinor: bigint("landed_unit_cost_minor", { mode: "number" }),
    warrantyStartDate: date("warranty_start_date"),
    warrantyEndDate: date("warranty_end_date"),
    ...softDelete,
    ...timestamps,
  },
  (table) => [
    uniqueIndex("product_serials_serial_no_uidx").on(table.serialNo),
    uniqueIndex("product_serials_engine_no_uidx")
      .on(table.engineNo)
      .where(sql`${table.engineNo} is not null`),
    uniqueIndex("product_serials_chassis_no_uidx")
      .on(table.chassisNo)
      .where(sql`${table.chassisNo} is not null`),
    index("product_serials_product_status_location_idx").on(
      table.productId,
      table.status,
      table.currentLocationId,
    ),
  ],
);

export const productLots = pgTable(
  "product_lots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict", onUpdate: "cascade" }),
    lotNo: varchar("lot_no", { length: 120 }).notNull(),
    status: serialStatus("status").notNull().default("available"),
    currentLocationId: uuid("current_location_id").references(() => locations.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    landedUnitCostMinor: bigint("landed_unit_cost_minor", { mode: "number" }),
    expiryDate: date("expiry_date"),
    ...softDelete,
    ...timestamps,
  },
  (table) => [
    uniqueIndex("product_lots_product_lot_no_active_uidx")
      .on(table.productId, table.lotNo)
      .where(sql`${table.deletedAt} is null`),
    index("product_lots_product_status_location_idx").on(
      table.productId,
      table.status,
      table.currentLocationId,
    ),
  ],
);

export const stockMovements = pgTable(
  "stock_movements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict", onUpdate: "cascade" }),
    ownerId: uuid("owner_id").references(() => owners.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    movementNo: varchar("movement_no", { length: 60 }).notNull(),
    movementType: stockMovementType("movement_type").notNull(),
    status: stockMovementStatus("status").notNull().default("draft"),
    movementDate: timestamp("movement_date", { withTimezone: true }).notNull().defaultNow(),
    fromLocationId: uuid("from_location_id").references(() => locations.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    toLocationId: uuid("to_location_id").references(() => locations.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    sourceType: varchar("source_type", { length: 80 }),
    sourceId: uuid("source_id"),
    sourceNo: varchar("source_no", { length: 80 }),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    postedBy: uuid("posted_by").references(() => users.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    deviceId: uuid("device_id").references(() => devices.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    notes: text("notes"),
    metadata: jsonb("metadata").notNull().default({}),
    ...softDelete,
    ...timestamps,
  },
  (table) => [
    check(
      "stock_movements_location_direction_chk",
      sql`
        (
          ${table.movementType} in ('purchase_receipt', 'customer_return', 'opening_balance')
          and ${table.toLocationId} is not null
        )
        or (
          ${table.movementType} in ('sale_issue', 'sale_delivery', 'supplier_return', 'scrap')
          and ${table.fromLocationId} is not null
        )
        or (
          ${table.movementType} = 'transfer'
          and ${table.fromLocationId} is not null
          and ${table.toLocationId} is not null
          and ${table.fromLocationId} <> ${table.toLocationId}
        )
        or ${table.movementType} in ('adjustment', 'stock_count')
      `,
    ),
    check(
      "stock_movements_posted_state_chk",
      sql`
        (${table.status} = 'posted' and ${table.postedAt} is not null)
        or (${table.status} <> 'posted' and ${table.postedAt} is null)
      `,
    ),
    uniqueIndex("stock_movements_no_active_uidx")
      .on(table.companyId, table.movementNo)
      .where(sql`${table.deletedAt} is null`),
    index("stock_movements_company_date_idx").on(table.companyId, table.movementDate),
    index("stock_movements_status_idx").on(table.companyId, table.status),
    index("stock_movements_owner_idx").on(table.companyId, table.ownerId),
    index("stock_movements_source_idx").on(table.sourceType, table.sourceId),
    index("stock_movements_from_location_idx").on(table.fromLocationId),
    index("stock_movements_to_location_idx").on(table.toLocationId),
  ],
);

export const stockMovementLines = pgTable(
  "stock_movement_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    stockMovementId: uuid("stock_movement_id")
      .notNull()
      .references(() => stockMovements.id, { onDelete: "cascade", onUpdate: "cascade" }),
    ownerId: uuid("owner_id").references(() => owners.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    lineNo: smallint("line_no").notNull(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict", onUpdate: "cascade" }),
    productSerialId: uuid("product_serial_id").references(() => productSerials.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    productLotId: uuid("product_lot_id").references(() => productLots.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    fromLocationId: uuid("from_location_id").references(() => locations.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    toLocationId: uuid("to_location_id").references(() => locations.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    unitId: uuid("unit_id")
      .notNull()
      .references(() => unitsOfMeasure.id, { onDelete: "restrict", onUpdate: "cascade" }),
    quantity: numeric("quantity", { precision: 20, scale: 6 }).notNull(),
    totalCostMinor: bigint("total_cost_minor", { mode: "number" }).notNull().default(0),
    currencyCode: char("currency_code", { length: 3 })
      .notNull()
      .references(() => currencies.code, { onDelete: "restrict", onUpdate: "cascade" }),
    notes: text("notes"),
    metadata: jsonb("metadata").notNull().default({}),
    ...softDelete,
    ...timestamps,
  },
  (table) => [
    check("stock_movement_lines_line_no_chk", sql`${table.lineNo} > 0`),
    check("stock_movement_lines_quantity_chk", sql`${table.quantity} <> 0`),
    check("stock_movement_lines_total_cost_chk", sql`${table.totalCostMinor} >= 0`),
    uniqueIndex("stock_movement_lines_no_active_uidx")
      .on(table.stockMovementId, table.lineNo)
      .where(sql`${table.deletedAt} is null`),
    index("stock_movement_lines_product_idx").on(table.productId),
    index("stock_movement_lines_owner_idx").on(table.ownerId),
    index("stock_movement_lines_serial_idx").on(table.productSerialId),
    index("stock_movement_lines_lot_idx").on(table.productLotId),
    index("stock_movement_lines_from_location_idx").on(table.fromLocationId),
    index("stock_movement_lines_to_location_idx").on(table.toLocationId),
  ],
);

export const stockBalances = pgTable(
  "stock_balances",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict", onUpdate: "cascade" }),
    ownerId: uuid("owner_id").references(() => owners.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "restrict", onUpdate: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict", onUpdate: "cascade" }),
    productSerialId: uuid("product_serial_id").references(() => productSerials.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    productLotId: uuid("product_lot_id").references(() => productLots.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    quantityOnHand: numeric("quantity_on_hand", { precision: 20, scale: 6 })
      .notNull()
      .default("0"),
    quantityReserved: numeric("quantity_reserved", { precision: 20, scale: 6 })
      .notNull()
      .default("0"),
    quantityAvailable: numeric("quantity_available", { precision: 20, scale: 6 })
      .notNull()
      .default("0"),
    averageCostMinor: bigint("average_cost_minor", { mode: "number" }).notNull().default(0),
    currencyCode: char("currency_code", { length: 3 })
      .notNull()
      .references(() => currencies.code, { onDelete: "restrict", onUpdate: "cascade" }),
    lastMovementAt: timestamp("last_movement_at", { withTimezone: true }),
    ...softDelete,
    ...timestamps,
  },
  (table) => [
    check("stock_balances_reserved_chk", sql`${table.quantityReserved} >= 0`),
    check("stock_balances_average_cost_chk", sql`${table.averageCostMinor} >= 0`),
    check(
      "stock_balances_available_chk",
      sql`${table.quantityAvailable} = ${table.quantityOnHand} - ${table.quantityReserved}`,
    ),
    uniqueIndex("stock_balances_location_product_active_uidx")
      .on(
        table.companyId,
        table.locationId,
        table.productId,
        sql`coalesce(${table.ownerId}, '00000000-0000-0000-0000-000000000000'::uuid)`,
        sql`coalesce(${table.productSerialId}, '00000000-0000-0000-0000-000000000000'::uuid)`,
        sql`coalesce(${table.productLotId}, '00000000-0000-0000-0000-000000000000'::uuid)`,
      )
      .where(sql`${table.deletedAt} is null`),
    index("stock_balances_product_idx").on(table.companyId, table.productId),
    index("stock_balances_location_idx").on(table.companyId, table.locationId),
    index("stock_balances_owner_idx").on(table.companyId, table.ownerId),
    index("stock_balances_serial_idx").on(table.productSerialId),
    index("stock_balances_lot_idx").on(table.productLotId),
  ],
);

export const stockReservations = pgTable(
  "stock_reservations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict", onUpdate: "cascade" }),
    reservationNo: varchar("reservation_no", { length: 60 }).notNull(),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "restrict", onUpdate: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict", onUpdate: "cascade" }),
    productSerialId: uuid("product_serial_id").references(() => productSerials.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    productLotId: uuid("product_lot_id").references(() => productLots.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    partnerId: uuid("partner_id").references(() => partners.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    sourceType: varchar("source_type", { length: 80 }),
    sourceId: uuid("source_id"),
    sourceNo: varchar("source_no", { length: 80 }),
    quantity: numeric("quantity", { precision: 20, scale: 6 }).notNull(),
    status: stockReservationStatus("status").notNull().default("active"),
    reservedAt: timestamp("reserved_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    fulfilledAt: timestamp("fulfilled_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    notes: text("notes"),
    metadata: jsonb("metadata").notNull().default({}),
    ...softDelete,
    ...timestamps,
  },
  (table) => [
    check("stock_reservations_quantity_chk", sql`${table.quantity} > 0`),
    check(
      "stock_reservations_expiry_chk",
      sql`${table.expiresAt} is null or ${table.expiresAt} > ${table.reservedAt}`,
    ),
    uniqueIndex("stock_reservations_no_active_uidx")
      .on(table.companyId, table.reservationNo)
      .where(sql`${table.deletedAt} is null`),
    index("stock_reservations_status_idx").on(table.companyId, table.status),
    index("stock_reservations_product_location_idx").on(table.productId, table.locationId),
    index("stock_reservations_lot_idx").on(table.productLotId),
    index("stock_reservations_source_idx").on(table.sourceType, table.sourceId),
  ],
);

export const stockCounts = pgTable(
  "stock_counts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict", onUpdate: "cascade" }),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "restrict", onUpdate: "cascade" }),
    countNo: varchar("count_no", { length: 60 }).notNull(),
    status: stockCountStatus("status").notNull().default("draft"),
    countDate: date("count_date").notNull().defaultNow(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    postedBy: uuid("posted_by").references(() => users.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    notes: text("notes"),
    metadata: jsonb("metadata").notNull().default({}),
    ...softDelete,
    ...timestamps,
  },
  (table) => [
    check(
      "stock_counts_completed_range_chk",
      sql`${table.completedAt} is null or ${table.startedAt} is null or ${table.completedAt} >= ${table.startedAt}`,
    ),
    uniqueIndex("stock_counts_no_active_uidx")
      .on(table.companyId, table.countNo)
      .where(sql`${table.deletedAt} is null`),
    index("stock_counts_location_date_idx").on(table.locationId, table.countDate),
    index("stock_counts_status_idx").on(table.companyId, table.status),
  ],
);

export const stockCountLines = pgTable(
  "stock_count_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    stockCountId: uuid("stock_count_id")
      .notNull()
      .references(() => stockCounts.id, { onDelete: "cascade", onUpdate: "cascade" }),
    lineNo: smallint("line_no").notNull(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict", onUpdate: "cascade" }),
    productSerialId: uuid("product_serial_id").references(() => productSerials.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    productLotId: uuid("product_lot_id").references(() => productLots.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    expectedQuantity: numeric("expected_quantity", { precision: 20, scale: 6 })
      .notNull()
      .default("0"),
    countedQuantity: numeric("counted_quantity", { precision: 20, scale: 6 }),
    varianceQuantity: numeric("variance_quantity", { precision: 20, scale: 6 })
      .notNull()
      .default("0"),
    status: stockCountLineStatus("status").notNull().default("pending"),
    countedAt: timestamp("counted_at", { withTimezone: true }),
    countedBy: uuid("counted_by").references(() => users.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    notes: text("notes"),
    ...softDelete,
    ...timestamps,
  },
  (table) => [
    check("stock_count_lines_line_no_chk", sql`${table.lineNo} > 0`),
    check("stock_count_lines_expected_quantity_chk", sql`${table.expectedQuantity} >= 0`),
    check(
      "stock_count_lines_counted_quantity_chk",
      sql`${table.countedQuantity} is null or ${table.countedQuantity} >= 0`,
    ),
    check(
      "stock_count_lines_variance_chk",
      sql`${table.countedQuantity} is null or ${table.varianceQuantity} = ${table.countedQuantity} - ${table.expectedQuantity}`,
    ),
    uniqueIndex("stock_count_lines_no_active_uidx")
      .on(table.stockCountId, table.lineNo)
      .where(sql`${table.deletedAt} is null`),
    uniqueIndex("stock_count_lines_product_active_uidx")
      .on(
        table.stockCountId,
        table.productId,
        sql`coalesce(${table.productSerialId}, '00000000-0000-0000-0000-000000000000'::uuid)`,
      )
      .where(sql`${table.deletedAt} is null`),
    index("stock_count_lines_product_idx").on(table.productId),
    index("stock_count_lines_serial_idx").on(table.productSerialId),
  ],
);

export const paymentTerms = pgTable(
  "payment_terms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict", onUpdate: "cascade" }),
    code: varchar("code", { length: 40 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    dueDays: smallint("due_days").notNull().default(0),
    description: text("description"),
    isActive: boolean("is_active").notNull().default(true),
    ...softDelete,
    ...timestamps,
  },
  (table) => [
    check("payment_terms_due_days_chk", sql`${table.dueDays} >= 0`),
    uniqueIndex("payment_terms_code_active_uidx")
      .on(table.companyId, table.code)
      .where(sql`${table.deletedAt} is null`),
  ],
);

export const paymentMethods = pgTable(
  "payment_methods",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict", onUpdate: "cascade" }),
    code: varchar("code", { length: 40 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    methodType: paymentMethodType("method_type").notNull(),
    allowInbound: boolean("allow_inbound").notNull().default(true),
    allowOutbound: boolean("allow_outbound").notNull().default(false),
    requiresReference: boolean("requires_reference").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    notes: text("notes"),
    ...softDelete,
    ...timestamps,
  },
  (table) => [
    check(
      "payment_methods_direction_chk",
      sql`${table.allowInbound} = true or ${table.allowOutbound} = true`,
    ),
    uniqueIndex("payment_methods_code_active_uidx")
      .on(table.companyId, table.code)
      .where(sql`${table.deletedAt} is null and ${table.isActive} = true`),
    index("payment_methods_type_idx").on(table.companyId, table.methodType),
  ],
);

export const paymentAccounts = pgTable(
  "payment_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict", onUpdate: "cascade" }),
    paymentMethodId: uuid("payment_method_id")
      .notNull()
      .references(() => paymentMethods.id, { onDelete: "restrict", onUpdate: "cascade" }),
    code: varchar("code", { length: 40 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    institutionName: varchar("institution_name", { length: 120 }),
    accountNumber: varchar("account_number", { length: 80 }),
    openingBalanceMinor: bigint("opening_balance_minor", { mode: "number" }).notNull().default(0),
    currencyCode: char("currency_code", { length: 3 })
      .notNull()
      .references(() => currencies.code, { onDelete: "restrict", onUpdate: "cascade" }),
    isActive: boolean("is_active").notNull().default(true),
    notes: text("notes"),
    ...softDelete,
    ...timestamps,
  },
  (table) => [
    uniqueIndex("payment_accounts_code_active_uidx")
      .on(table.companyId, table.code)
      .where(sql`${table.deletedAt} is null and ${table.isActive} = true`),
    index("payment_accounts_method_idx").on(table.paymentMethodId),
  ],
);

export const partners = pgTable(
  "partners",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict", onUpdate: "cascade" }),
    code: varchar("code", { length: 40 }).notNull(),
    displayName: varchar("display_name", { length: 200 }).notNull(),
    legalName: varchar("legal_name", { length: 200 }),
    tin: varchar("tin", { length: 30 }),
    isCustomer: boolean("is_customer").notNull().default(false),
    isSupplier: boolean("is_supplier").notNull().default(false),
    paymentTermId: uuid("payment_term_id").references(() => paymentTerms.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    creditLimitMinor: bigint("credit_limit_minor", { mode: "number" }).notNull().default(0),
    currencyCode: char("currency_code", { length: 3 })
      .notNull()
      .references(() => currencies.code, { onDelete: "restrict", onUpdate: "cascade" }),
    status: partnerStatus("status").notNull().default("active"),
    notes: text("notes"),
    ...softDelete,
    ...timestamps,
  },
  (table) => [
    check("partners_role_chk", sql`${table.isCustomer} = true or ${table.isSupplier} = true`),
    check("partners_credit_limit_minor_chk", sql`${table.creditLimitMinor} >= 0`),
    uniqueIndex("partners_code_active_uidx")
      .on(table.companyId, table.code)
      .where(sql`${table.deletedAt} is null`),
    uniqueIndex("partners_tin_active_uidx")
      .on(table.companyId, table.tin)
      .where(sql`${table.tin} is not null and ${table.deletedAt} is null`),
    index("partners_company_display_name_idx").on(table.companyId, table.displayName),
    index("partners_status_idx").on(table.companyId, table.status),
  ],
);

export const partnerContacts = pgTable(
  "partner_contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    partnerId: uuid("partner_id")
      .notNull()
      .references(() => partners.id, { onDelete: "cascade", onUpdate: "cascade" }),
    fullName: varchar("full_name", { length: 160 }).notNull(),
    roleTitle: varchar("role_title", { length: 100 }),
    phone: varchar("phone", { length: 40 }),
    email: varchar("email", { length: 160 }),
    isPrimary: boolean("is_primary").notNull().default(false),
    ...softDelete,
    ...timestamps,
  },
  (table) => [
    uniqueIndex("partner_contacts_primary_active_uidx")
      .on(table.partnerId)
      .where(sql`${table.isPrimary} = true and ${table.deletedAt} is null`),
    index("partner_contacts_partner_idx").on(table.partnerId),
  ],
);

export const partnerAddresses = pgTable(
  "partner_addresses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    partnerId: uuid("partner_id")
      .notNull()
      .references(() => partners.id, { onDelete: "cascade", onUpdate: "cascade" }),
    addressType: addressType("address_type").notNull().default("office"),
    label: varchar("label", { length: 100 }),
    line1: varchar("line1", { length: 200 }).notNull(),
    line2: varchar("line2", { length: 200 }),
    city: varchar("city", { length: 120 }),
    region: varchar("region", { length: 120 }),
    country: varchar("country", { length: 120 }).notNull().default("Ethiopia"),
    isPrimary: boolean("is_primary").notNull().default(false),
    ...softDelete,
    ...timestamps,
  },
  (table) => [
    uniqueIndex("partner_addresses_primary_type_active_uidx")
      .on(table.partnerId, table.addressType)
      .where(sql`${table.isPrimary} = true and ${table.deletedAt} is null`),
    index("partner_addresses_partner_idx").on(table.partnerId),
  ],
);

export const taxGroups = pgTable(
  "tax_groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict", onUpdate: "cascade" }),
    code: varchar("code", { length: 40 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    sortOrder: smallint("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    ...softDelete,
    ...timestamps,
  },
  (table) => [
    uniqueIndex("tax_groups_code_active_uidx")
      .on(table.companyId, table.code)
      .where(sql`${table.deletedAt} is null`),
    uniqueIndex("tax_groups_name_active_uidx")
      .on(table.companyId, table.name)
      .where(sql`${table.deletedAt} is null`),
  ],
);

export const taxes = pgTable(
  "taxes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict", onUpdate: "cascade" }),
    taxGroupId: uuid("tax_group_id").references(() => taxGroups.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    code: varchar("code", { length: 40 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    scope: taxScope("scope").notNull().default("purchase"),
    computation: taxComputation("computation").notNull().default("percent"),
    rate: numeric("rate", { precision: 9, scale: 4 }).notNull().default("0"),
    amountMinor: bigint("amount_minor", { mode: "number" }).notNull().default(0),
    priceIncluded: boolean("price_included").notNull().default(false),
    description: text("description"),
    isActive: boolean("is_active").notNull().default(true),
    ...softDelete,
    ...timestamps,
  },
  (table) => [
    check("taxes_rate_chk", sql`${table.rate} >= 0`),
    check("taxes_amount_chk", sql`${table.amountMinor} >= 0`),
    uniqueIndex("taxes_code_active_uidx")
      .on(table.companyId, table.code)
      .where(sql`${table.deletedAt} is null`),
    index("taxes_group_idx").on(table.taxGroupId),
    index("taxes_scope_active_idx").on(table.companyId, table.scope, table.isActive),
  ],
);

export const purchaseOrders = pgTable(
  "purchase_orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict", onUpdate: "cascade" }),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => partners.id, { onDelete: "restrict", onUpdate: "cascade" }),
    ownerId: uuid("owner_id").references(() => owners.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    deliverToLocationId: uuid("deliver_to_location_id").references(() => locations.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    orderNo: varchar("order_no", { length: 60 }).notNull(),
    vendorReference: varchar("vendor_reference", { length: 80 }),
    paymentTerm: purchasePaymentTerm("payment_term").notNull().default("credit"),
    status: purchaseOrderStatus("status").notNull().default("draft"),
    orderDate: date("order_date").notNull().defaultNow(),
    paymentDueDate: date("payment_due_date"),
    currencyCode: char("currency_code", { length: 3 })
      .notNull()
      .references(() => currencies.code, { onDelete: "restrict", onUpdate: "cascade" }),
    subtotalMinor: bigint("subtotal_minor", { mode: "number" }).notNull().default(0),
    landedCostEstimateMinor: bigint("landed_cost_estimate_minor", { mode: "number" }).notNull().default(0),
    taxAmountMinor: bigint("tax_amount_minor", { mode: "number" }).notNull().default(0),
    totalMinor: bigint("total_minor", { mode: "number" }).notNull().default(0),
    notes: text("notes"),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    confirmedBy: uuid("confirmed_by").references(() => users.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    ...softDelete,
    ...timestamps,
  },
  (table) => [
    check("purchase_orders_subtotal_chk", sql`${table.subtotalMinor} >= 0`),
    check("purchase_orders_landed_estimate_chk", sql`${table.landedCostEstimateMinor} >= 0`),
    check("purchase_orders_tax_amount_chk", sql`${table.taxAmountMinor} >= 0`),
    check("purchase_orders_total_chk", sql`${table.totalMinor} >= 0`),
    uniqueIndex("purchase_orders_no_active_uidx")
      .on(table.companyId, table.orderNo)
      .where(sql`${table.deletedAt} is null`),
    index("purchase_orders_owner_idx").on(table.companyId, table.ownerId),
    index("purchase_orders_supplier_idx").on(table.supplierId),
    index("purchase_orders_deliver_to_idx").on(table.deliverToLocationId),
    index("purchase_orders_status_idx").on(table.companyId, table.status),
    index("purchase_orders_date_idx").on(table.companyId, table.orderDate),
  ],
);

export const purchaseOrderLines = pgTable(
  "purchase_order_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    purchaseOrderId: uuid("purchase_order_id")
      .notNull()
      .references(() => purchaseOrders.id, { onDelete: "cascade", onUpdate: "cascade" }),
    lineNo: smallint("line_no").notNull(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict", onUpdate: "cascade" }),
    ownerId: uuid("owner_id").references(() => owners.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    description: text("description"),
    unitId: uuid("unit_id")
      .notNull()
      .references(() => unitsOfMeasure.id, { onDelete: "restrict", onUpdate: "cascade" }),
    quantityOrdered: numeric("quantity_ordered", { precision: 20, scale: 6 }).notNull(),
    quantityReceived: numeric("quantity_received", { precision: 20, scale: 6 })
      .notNull()
      .default("0"),
    unitCostMinor: bigint("unit_cost_minor", { mode: "number" }).notNull().default(0),
    taxAmountMinor: bigint("tax_amount_minor", { mode: "number" }).notNull().default(0),
    lineTotalMinor: bigint("line_total_minor", { mode: "number" }).notNull().default(0),
    currencyCode: char("currency_code", { length: 3 })
      .notNull()
      .references(() => currencies.code, { onDelete: "restrict", onUpdate: "cascade" }),
    notes: text("notes"),
    ...softDelete,
    ...timestamps,
  },
  (table) => [
    check("purchase_order_lines_line_no_chk", sql`${table.lineNo} > 0`),
    check("purchase_order_lines_quantity_ordered_chk", sql`${table.quantityOrdered} > 0`),
    check("purchase_order_lines_quantity_received_chk", sql`${table.quantityReceived} >= 0`),
    check("purchase_order_lines_unit_cost_chk", sql`${table.unitCostMinor} >= 0`),
    check("purchase_order_lines_tax_amount_chk", sql`${table.taxAmountMinor} >= 0`),
    check("purchase_order_lines_total_chk", sql`${table.lineTotalMinor} >= 0`),
    uniqueIndex("purchase_order_lines_no_active_uidx")
      .on(table.purchaseOrderId, table.lineNo)
      .where(sql`${table.deletedAt} is null`),
    index("purchase_order_lines_product_idx").on(table.productId),
    index("purchase_order_lines_owner_idx").on(table.ownerId),
  ],
);

export const purchaseOrderLineTaxes = pgTable(
  "purchase_order_line_taxes",
  {
    purchaseOrderLineId: uuid("purchase_order_line_id")
      .notNull()
      .references(() => purchaseOrderLines.id, { onDelete: "cascade", onUpdate: "cascade" }),
    taxId: uuid("tax_id")
      .notNull()
      .references(() => taxes.id, { onDelete: "restrict", onUpdate: "cascade" }),
    taxAmountMinor: bigint("tax_amount_minor", { mode: "number" }).notNull().default(0),
    ...timestamps,
  },
  (table) => [
    primaryKey({
      name: "purchase_order_line_taxes_pk",
      columns: [table.purchaseOrderLineId, table.taxId],
    }),
    check("purchase_order_line_taxes_amount_chk", sql`${table.taxAmountMinor} >= 0`),
    index("purchase_order_line_taxes_tax_idx").on(table.taxId),
  ],
);

export const supplierBillPlaceholders = pgTable(
  "supplier_bill_placeholders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict", onUpdate: "cascade" }),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => partners.id, { onDelete: "restrict", onUpdate: "cascade" }),
    purchaseOrderId: uuid("purchase_order_id").references(() => purchaseOrders.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    billNo: varchar("bill_no", { length: 80 }).notNull(),
    status: supplierBillStatus("status").notNull().default("placeholder"),
    billDate: date("bill_date").notNull().defaultNow(),
    amountMinor: bigint("amount_minor", { mode: "number" }).notNull().default(0),
    currencyCode: char("currency_code", { length: 3 })
      .notNull()
      .references(() => currencies.code, { onDelete: "restrict", onUpdate: "cascade" }),
    notes: text("notes"),
    ...softDelete,
    ...timestamps,
  },
  (table) => [
    check("supplier_bill_placeholders_amount_chk", sql`${table.amountMinor} >= 0`),
    uniqueIndex("supplier_bill_placeholders_no_active_uidx")
      .on(table.companyId, table.billNo)
      .where(sql`${table.deletedAt} is null`),
    index("supplier_bill_placeholders_supplier_idx").on(table.supplierId),
  ],
);

export const vendorBills = pgTable(
  "vendor_bills",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict", onUpdate: "cascade" }),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => partners.id, { onDelete: "restrict", onUpdate: "cascade" }),
    purchaseOrderId: uuid("purchase_order_id").references(() => purchaseOrders.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    goodsReceiptId: uuid("goods_receipt_id").references((): AnyPgColumn => goodsReceipts.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    billNo: varchar("bill_no", { length: 80 }).notNull(),
    vendorReference: varchar("vendor_reference", { length: 120 }),
    status: vendorBillStatus("status").notNull().default("draft"),
    paymentStatus: vendorBillPaymentStatus("payment_status").notNull().default("not_paid"),
    billDate: date("bill_date").notNull().defaultNow(),
    accountingDate: date("accounting_date"),
    dueDate: date("due_date"),
    untaxedAmountMinor: bigint("untaxed_amount_minor", { mode: "number" }).notNull().default(0),
    taxAmountMinor: bigint("tax_amount_minor", { mode: "number" }).notNull().default(0),
    totalMinor: bigint("total_minor", { mode: "number" }).notNull().default(0),
    currencyCode: char("currency_code", { length: 3 })
      .notNull()
      .references(() => currencies.code, { onDelete: "restrict", onUpdate: "cascade" }),
    notes: text("notes"),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    postedBy: uuid("posted_by").references(() => users.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    ...softDelete,
    ...timestamps,
  },
  (table) => [
    check("vendor_bills_untaxed_chk", sql`${table.untaxedAmountMinor} >= 0`),
    check("vendor_bills_tax_chk", sql`${table.taxAmountMinor} >= 0`),
    check("vendor_bills_total_chk", sql`${table.totalMinor} >= 0`),
    check(
      "vendor_bills_posted_state_chk",
      sql`
        (${table.status} = 'posted' and ${table.postedAt} is not null)
        or (${table.status} <> 'posted' and ${table.postedAt} is null)
      `,
    ),
    uniqueIndex("vendor_bills_no_active_uidx")
      .on(table.companyId, table.billNo)
      .where(sql`${table.deletedAt} is null`),
    uniqueIndex("vendor_bills_vendor_reference_active_uidx")
      .on(table.companyId, table.supplierId, table.vendorReference)
      .where(sql`${table.vendorReference} is not null and ${table.deletedAt} is null`),
    index("vendor_bills_supplier_idx").on(table.supplierId),
    index("vendor_bills_po_idx").on(table.purchaseOrderId),
    index("vendor_bills_receipt_idx").on(table.goodsReceiptId),
    index("vendor_bills_status_idx").on(table.companyId, table.status),
    index("vendor_bills_date_idx").on(table.companyId, table.billDate),
  ],
);

export const vendorBillLines = pgTable(
  "vendor_bill_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    vendorBillId: uuid("vendor_bill_id")
      .notNull()
      .references(() => vendorBills.id, { onDelete: "cascade", onUpdate: "cascade" }),
    purchaseOrderLineId: uuid("purchase_order_line_id").references(() => purchaseOrderLines.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    goodsReceiptLineId: uuid("goods_receipt_line_id").references(
      (): AnyPgColumn => goodsReceiptLines.id,
      {
        onDelete: "restrict",
        onUpdate: "cascade",
      },
    ),
    lineNo: smallint("line_no").notNull(),
    productId: uuid("product_id").references(() => products.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    description: text("description").notNull(),
    unitId: uuid("unit_id").references(() => unitsOfMeasure.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    quantity: numeric("quantity", { precision: 20, scale: 6 }).notNull(),
    unitPriceMinor: bigint("unit_price_minor", { mode: "number" }).notNull().default(0),
    subtotalMinor: bigint("subtotal_minor", { mode: "number" }).notNull().default(0),
    taxAmountMinor: bigint("tax_amount_minor", { mode: "number" }).notNull().default(0),
    totalMinor: bigint("total_minor", { mode: "number" }).notNull().default(0),
    currencyCode: char("currency_code", { length: 3 })
      .notNull()
      .references(() => currencies.code, { onDelete: "restrict", onUpdate: "cascade" }),
    notes: text("notes"),
    ...softDelete,
    ...timestamps,
  },
  (table) => [
    check("vendor_bill_lines_line_no_chk", sql`${table.lineNo} > 0`),
    check("vendor_bill_lines_quantity_chk", sql`${table.quantity} > 0`),
    check("vendor_bill_lines_unit_price_chk", sql`${table.unitPriceMinor} >= 0`),
    check("vendor_bill_lines_subtotal_chk", sql`${table.subtotalMinor} >= 0`),
    check("vendor_bill_lines_tax_chk", sql`${table.taxAmountMinor} >= 0`),
    check("vendor_bill_lines_total_chk", sql`${table.totalMinor} >= 0`),
    uniqueIndex("vendor_bill_lines_no_active_uidx")
      .on(table.vendorBillId, table.lineNo)
      .where(sql`${table.deletedAt} is null`),
    index("vendor_bill_lines_po_line_idx").on(table.purchaseOrderLineId),
    index("vendor_bill_lines_receipt_line_idx").on(table.goodsReceiptLineId),
    index("vendor_bill_lines_product_idx").on(table.productId),
  ],
);

export const vendorBillLineTaxes = pgTable(
  "vendor_bill_line_taxes",
  {
    vendorBillLineId: uuid("vendor_bill_line_id")
      .notNull()
      .references(() => vendorBillLines.id, { onDelete: "cascade", onUpdate: "cascade" }),
    taxId: uuid("tax_id")
      .notNull()
      .references(() => taxes.id, { onDelete: "restrict", onUpdate: "cascade" }),
    taxAmountMinor: bigint("tax_amount_minor", { mode: "number" }).notNull().default(0),
    ...timestamps,
  },
  (table) => [
    primaryKey({
      name: "vendor_bill_line_taxes_pk",
      columns: [table.vendorBillLineId, table.taxId],
    }),
    check("vendor_bill_line_taxes_amount_chk", sql`${table.taxAmountMinor} >= 0`),
    index("vendor_bill_line_taxes_tax_idx").on(table.taxId),
  ],
);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict", onUpdate: "cascade" }),
    partnerId: uuid("partner_id").references(() => partners.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    paymentNo: varchar("payment_no", { length: 60 }).notNull(),
    paymentType: paymentType("payment_type").notNull(),
    status: paymentStatus("status").notNull().default("draft"),
    paymentDate: timestamp("payment_date", { withTimezone: true }).notNull().defaultNow(),
    paymentMethodId: uuid("payment_method_id")
      .notNull()
      .references(() => paymentMethods.id, { onDelete: "restrict", onUpdate: "cascade" }),
    paymentAccountId: uuid("payment_account_id")
      .notNull()
      .references(() => paymentAccounts.id, { onDelete: "restrict", onUpdate: "cascade" }),
    amountMinor: bigint("amount_minor", { mode: "number" }).notNull().default(0),
    currencyCode: char("currency_code", { length: 3 })
      .notNull()
      .references(() => currencies.code, { onDelete: "restrict", onUpdate: "cascade" }),
    reference: varchar("reference", { length: 120 }),
    notes: text("notes"),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    postedBy: uuid("posted_by").references(() => users.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelledBy: uuid("cancelled_by").references(() => users.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    ...softDelete,
    ...timestamps,
  },
  (table) => [
    check("payments_amount_chk", sql`${table.amountMinor} > 0`),
    check(
      "payments_posted_state_chk",
      sql`
        (${table.status} = 'posted' and ${table.postedAt} is not null and ${table.cancelledAt} is null)
        or (${table.status} = 'cancelled' and ${table.cancelledAt} is not null)
        or (${table.status} = 'draft' and ${table.postedAt} is null and ${table.cancelledAt} is null)
      `,
    ),
    uniqueIndex("payments_no_active_uidx")
      .on(table.companyId, table.paymentNo)
      .where(sql`${table.deletedAt} is null`),
    index("payments_partner_idx").on(table.partnerId),
    index("payments_status_idx").on(table.companyId, table.status),
    index("payments_date_idx").on(table.companyId, table.paymentDate),
  ],
);

export const expenseCategories = pgTable(
  "expense_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict", onUpdate: "cascade" }),
    code: varchar("code", { length: 40 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    description: text("description"),
    isActive: boolean("is_active").notNull().default(true),
    ...softDelete,
    ...timestamps,
  },
  (table) => [
    uniqueIndex("expense_categories_code_active_uidx")
      .on(table.companyId, table.code)
      .where(sql`${table.deletedAt} is null`),
  ],
);

export const expenses = pgTable(
  "expenses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict", onUpdate: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => expenseCategories.id, { onDelete: "restrict", onUpdate: "cascade" }),
    employeeId: uuid("employee_id").references(() => employees.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    vendorId: uuid("vendor_id").references(() => partners.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    locationId: uuid("location_id").references(() => locations.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    expenseNo: varchar("expense_no", { length: 60 }).notNull(),
    status: expenseStatus("status").notNull().default("posted"),
    paymentStatus: expensePaymentStatus("payment_status").notNull().default("unpaid"),
    expenseDate: date("expense_date").notNull().defaultNow(),
    amountMinor: bigint("amount_minor", { mode: "number" }).notNull().default(0),
    currencyCode: char("currency_code", { length: 3 })
      .notNull()
      .references(() => currencies.code, { onDelete: "restrict", onUpdate: "cascade" }),
    description: text("description"),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelledBy: uuid("cancelled_by").references(() => users.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    ...softDelete,
    ...timestamps,
  },
  (table) => [
    check("expenses_amount_chk", sql`${table.amountMinor} > 0`),
    check(
      "expenses_cancelled_state_chk",
      sql`
        (${table.status} = 'cancelled' and ${table.cancelledAt} is not null)
        or (${table.status} <> 'cancelled' and ${table.cancelledAt} is null)
      `,
    ),
    uniqueIndex("expenses_no_active_uidx")
      .on(table.companyId, table.expenseNo)
      .where(sql`${table.deletedAt} is null`),
    index("expenses_category_idx").on(table.categoryId),
    index("expenses_vendor_idx").on(table.vendorId),
    index("expenses_employee_idx").on(table.employeeId),
    index("expenses_location_idx").on(table.locationId),
    index("expenses_status_idx").on(table.companyId, table.status),
    index("expenses_date_idx").on(table.companyId, table.expenseDate),
  ],
);

export const salesOrders = pgTable(
  "sales_orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict", onUpdate: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => partners.id, { onDelete: "restrict", onUpdate: "cascade" }),
    ownerId: uuid("owner_id").references(() => owners.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    invoiceAddressId: uuid("invoice_address_id").references(() => partnerAddresses.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    deliveryAddressId: uuid("delivery_address_id").references(() => partnerAddresses.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    sourceLocationId: uuid("source_location_id").references(() => locations.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    priceListId: uuid("price_list_id").references(() => priceLists.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    orderNo: varchar("order_no", { length: 60 }).notNull(),
    customerReference: varchar("customer_reference", { length: 80 }),
    fsNumber: varchar("fs_number", { length: 80 }),
    paymentTerm: salesPaymentTerm("payment_term").notNull().default("credit"),
    status: salesOrderStatus("status").notNull().default("quotation"),
    orderDate: date("order_date").notNull().defaultNow(),
    validUntil: date("valid_until"),
    expectedDeliveryDate: date("expected_delivery_date"),
    currencyCode: char("currency_code", { length: 3 })
      .notNull()
      .references(() => currencies.code, { onDelete: "restrict", onUpdate: "cascade" }),
    subtotalMinor: bigint("subtotal_minor", { mode: "number" }).notNull().default(0),
    taxAmountMinor: bigint("tax_amount_minor", { mode: "number" }).notNull().default(0),
    totalMinor: bigint("total_minor", { mode: "number" }).notNull().default(0),
    reserveOnConfirm: boolean("reserve_on_confirm").notNull().default(true),
    notes: text("notes"),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    confirmedBy: uuid("confirmed_by").references(() => users.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    ...softDelete,
    ...timestamps,
  },
  (table) => [
    check("sales_orders_subtotal_chk", sql`${table.subtotalMinor} >= 0`),
    check("sales_orders_tax_amount_chk", sql`${table.taxAmountMinor} >= 0`),
    check("sales_orders_total_chk", sql`${table.totalMinor} >= 0`),
    check(
      "sales_orders_confirmed_state_chk",
      sql`
        (${table.status} in ('confirmed', 'partially_delivered', 'delivered', 'invoiced') and ${table.confirmedAt} is not null)
        or (${table.status} in ('quotation', 'cancelled') and ${table.confirmedAt} is null)
      `,
    ),
    uniqueIndex("sales_orders_no_active_uidx")
      .on(table.companyId, table.orderNo)
      .where(sql`${table.deletedAt} is null`),
    index("sales_orders_owner_idx").on(table.companyId, table.ownerId),
    index("sales_orders_customer_idx").on(table.customerId),
    index("sales_orders_source_location_idx").on(table.sourceLocationId),
    index("sales_orders_status_idx").on(table.companyId, table.status),
    index("sales_orders_date_idx").on(table.companyId, table.orderDate),
  ],
);

export const salesOrderLines = pgTable(
  "sales_order_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    salesOrderId: uuid("sales_order_id")
      .notNull()
      .references(() => salesOrders.id, { onDelete: "cascade", onUpdate: "cascade" }),
    ownerId: uuid("owner_id").references(() => owners.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    lineNo: smallint("line_no").notNull(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict", onUpdate: "cascade" }),
    description: text("description"),
    unitId: uuid("unit_id")
      .notNull()
      .references(() => unitsOfMeasure.id, { onDelete: "restrict", onUpdate: "cascade" }),
    quantityOrdered: numeric("quantity_ordered", { precision: 20, scale: 6 }).notNull(),
    quantityReserved: numeric("quantity_reserved", { precision: 20, scale: 6 }).notNull().default("0"),
    quantityDelivered: numeric("quantity_delivered", { precision: 20, scale: 6 }).notNull().default("0"),
    quantityInvoiced: numeric("quantity_invoiced", { precision: 20, scale: 6 }).notNull().default("0"),
    unitPriceMinor: bigint("unit_price_minor", { mode: "number" }).notNull().default(0),
    discountMinor: bigint("discount_minor", { mode: "number" }).notNull().default(0),
    taxAmountMinor: bigint("tax_amount_minor", { mode: "number" }).notNull().default(0),
    lineTotalMinor: bigint("line_total_minor", { mode: "number" }).notNull().default(0),
    currencyCode: char("currency_code", { length: 3 })
      .notNull()
      .references(() => currencies.code, { onDelete: "restrict", onUpdate: "cascade" }),
    notes: text("notes"),
    ...softDelete,
    ...timestamps,
  },
  (table) => [
    check("sales_order_lines_line_no_chk", sql`${table.lineNo} > 0`),
    check("sales_order_lines_quantity_ordered_chk", sql`${table.quantityOrdered} > 0`),
    check("sales_order_lines_quantity_reserved_chk", sql`${table.quantityReserved} >= 0`),
    check("sales_order_lines_quantity_delivered_chk", sql`${table.quantityDelivered} >= 0`),
    check("sales_order_lines_quantity_invoiced_chk", sql`${table.quantityInvoiced} >= 0`),
    check("sales_order_lines_unit_price_chk", sql`${table.unitPriceMinor} >= 0`),
    check("sales_order_lines_discount_chk", sql`${table.discountMinor} >= 0`),
    check("sales_order_lines_tax_amount_chk", sql`${table.taxAmountMinor} >= 0`),
    check("sales_order_lines_total_chk", sql`${table.lineTotalMinor} >= 0`),
    uniqueIndex("sales_order_lines_no_active_uidx")
      .on(table.salesOrderId, table.lineNo)
      .where(sql`${table.deletedAt} is null`),
    index("sales_order_lines_owner_idx").on(table.ownerId),
    index("sales_order_lines_product_idx").on(table.productId),
  ],
);

export const salesOrderLineTaxes = pgTable(
  "sales_order_line_taxes",
  {
    salesOrderLineId: uuid("sales_order_line_id")
      .notNull()
      .references(() => salesOrderLines.id, { onDelete: "cascade", onUpdate: "cascade" }),
    taxId: uuid("tax_id")
      .notNull()
      .references(() => taxes.id, { onDelete: "restrict", onUpdate: "cascade" }),
    taxAmountMinor: bigint("tax_amount_minor", { mode: "number" }).notNull().default(0),
    ...timestamps,
  },
  (table) => [
    primaryKey({ columns: [table.salesOrderLineId, table.taxId] }),
    check("sales_order_line_taxes_amount_chk", sql`${table.taxAmountMinor} >= 0`),
    index("sales_order_line_taxes_tax_idx").on(table.taxId),
  ],
);

export const deliveries = pgTable(
  "deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict", onUpdate: "cascade" }),
    salesOrderId: uuid("sales_order_id")
      .notNull()
      .references(() => salesOrders.id, { onDelete: "restrict", onUpdate: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => partners.id, { onDelete: "restrict", onUpdate: "cascade" }),
    sourceLocationId: uuid("source_location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "restrict", onUpdate: "cascade" }),
    deliveryAddressId: uuid("delivery_address_id").references(() => partnerAddresses.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    deliveryNo: varchar("delivery_no", { length: 60 }).notNull(),
    status: deliveryStatus("status").notNull().default("draft"),
    deliveryDate: timestamp("delivery_date", { withTimezone: true }).notNull().defaultNow(),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    postedBy: uuid("posted_by").references(() => users.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    stockMovementId: uuid("stock_movement_id").references(() => stockMovements.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    notes: text("notes"),
    ...softDelete,
    ...timestamps,
  },
  (table) => [
    check(
      "deliveries_posted_state_chk",
      sql`
        (${table.status} = 'posted' and ${table.postedAt} is not null and ${table.stockMovementId} is not null)
        or (${table.status} <> 'posted' and ${table.postedAt} is null)
      `,
    ),
    uniqueIndex("deliveries_no_active_uidx")
      .on(table.companyId, table.deliveryNo)
      .where(sql`${table.deletedAt} is null`),
    index("deliveries_sales_order_idx").on(table.salesOrderId),
    index("deliveries_customer_idx").on(table.customerId),
    index("deliveries_status_idx").on(table.companyId, table.status),
    index("deliveries_location_date_idx").on(table.sourceLocationId, table.deliveryDate),
  ],
);

export const deliveryLines = pgTable(
  "delivery_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    deliveryId: uuid("delivery_id")
      .notNull()
      .references(() => deliveries.id, { onDelete: "cascade", onUpdate: "cascade" }),
    salesOrderLineId: uuid("sales_order_line_id").references(() => salesOrderLines.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    lineNo: smallint("line_no").notNull(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict", onUpdate: "cascade" }),
    productSerialId: uuid("product_serial_id").references(() => productSerials.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    productLotId: uuid("product_lot_id").references(() => productLots.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    unitId: uuid("unit_id")
      .notNull()
      .references(() => unitsOfMeasure.id, { onDelete: "restrict", onUpdate: "cascade" }),
    quantityDelivered: numeric("quantity_delivered", { precision: 20, scale: 6 }).notNull(),
    unitCostMinor: bigint("unit_cost_minor", { mode: "number" }).notNull().default(0),
    totalCostMinor: bigint("total_cost_minor", { mode: "number" }).notNull().default(0),
    currencyCode: char("currency_code", { length: 3 })
      .notNull()
      .references(() => currencies.code, { onDelete: "restrict", onUpdate: "cascade" }),
    serialNo: varchar("serial_no", { length: 120 }),
    lotNo: varchar("lot_no", { length: 120 }),
    notes: text("notes"),
    ...softDelete,
    ...timestamps,
  },
  (table) => [
    check("delivery_lines_line_no_chk", sql`${table.lineNo} > 0`),
    check("delivery_lines_quantity_chk", sql`${table.quantityDelivered} > 0`),
    check("delivery_lines_unit_cost_chk", sql`${table.unitCostMinor} >= 0`),
    check("delivery_lines_total_cost_chk", sql`${table.totalCostMinor} >= 0`),
    uniqueIndex("delivery_lines_no_active_uidx")
      .on(table.deliveryId, table.lineNo)
      .where(sql`${table.deletedAt} is null`),
    index("delivery_lines_sales_order_line_idx").on(table.salesOrderLineId),
    index("delivery_lines_product_idx").on(table.productId),
    index("delivery_lines_serial_idx").on(table.productSerialId),
    index("delivery_lines_lot_idx").on(table.productLotId),
  ],
);

export const customerInvoices = pgTable(
  "customer_invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict", onUpdate: "cascade" }),
    salesOrderId: uuid("sales_order_id").references(() => salesOrders.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    deliveryId: uuid("delivery_id").references(() => deliveries.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => partners.id, { onDelete: "restrict", onUpdate: "cascade" }),
    invoiceAddressId: uuid("invoice_address_id").references(() => partnerAddresses.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    invoiceNo: varchar("invoice_no", { length: 60 }).notNull(),
    customerReference: varchar("customer_reference", { length: 80 }),
    status: customerInvoiceStatus("status").notNull().default("draft"),
    paymentStatus: customerInvoicePaymentStatus("payment_status").notNull().default("not_paid"),
    invoiceDate: date("invoice_date").notNull().defaultNow(),
    dueDate: date("due_date"),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    postedBy: uuid("posted_by").references(() => users.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    currencyCode: char("currency_code", { length: 3 })
      .notNull()
      .references(() => currencies.code, { onDelete: "restrict", onUpdate: "cascade" }),
    untaxedAmountMinor: bigint("untaxed_amount_minor", { mode: "number" }).notNull().default(0),
    taxAmountMinor: bigint("tax_amount_minor", { mode: "number" }).notNull().default(0),
    totalMinor: bigint("total_minor", { mode: "number" }).notNull().default(0),
    notes: text("notes"),
    ...softDelete,
    ...timestamps,
  },
  (table) => [
    check("customer_invoices_untaxed_chk", sql`${table.untaxedAmountMinor} >= 0`),
    check("customer_invoices_tax_amount_chk", sql`${table.taxAmountMinor} >= 0`),
    check("customer_invoices_total_chk", sql`${table.totalMinor} >= 0`),
    check(
      "customer_invoices_posted_state_chk",
      sql`
        (${table.status} = 'posted' and ${table.postedAt} is not null)
        or (${table.status} <> 'posted' and ${table.postedAt} is null)
      `,
    ),
    uniqueIndex("customer_invoices_no_active_uidx")
      .on(table.companyId, table.invoiceNo)
      .where(sql`${table.deletedAt} is null`),
    index("customer_invoices_sales_order_idx").on(table.salesOrderId),
    index("customer_invoices_delivery_idx").on(table.deliveryId),
    index("customer_invoices_customer_idx").on(table.customerId),
    index("customer_invoices_status_idx").on(table.companyId, table.status),
    index("customer_invoices_payment_status_idx").on(table.companyId, table.paymentStatus),
    index("customer_invoices_date_idx").on(table.companyId, table.invoiceDate),
  ],
);

export const customerInvoiceLines = pgTable(
  "customer_invoice_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    customerInvoiceId: uuid("customer_invoice_id")
      .notNull()
      .references(() => customerInvoices.id, { onDelete: "cascade", onUpdate: "cascade" }),
    salesOrderLineId: uuid("sales_order_line_id").references(() => salesOrderLines.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    deliveryLineId: uuid("delivery_line_id").references(() => deliveryLines.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    lineNo: smallint("line_no").notNull(),
    productId: uuid("product_id").references(() => products.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    description: text("description").notNull(),
    quantity: numeric("quantity", { precision: 20, scale: 6 }).notNull(),
    unitPriceMinor: bigint("unit_price_minor", { mode: "number" }).notNull().default(0),
    discountMinor: bigint("discount_minor", { mode: "number" }).notNull().default(0),
    taxAmountMinor: bigint("tax_amount_minor", { mode: "number" }).notNull().default(0),
    lineTotalMinor: bigint("line_total_minor", { mode: "number" }).notNull().default(0),
    currencyCode: char("currency_code", { length: 3 })
      .notNull()
      .references(() => currencies.code, { onDelete: "restrict", onUpdate: "cascade" }),
    notes: text("notes"),
    ...softDelete,
    ...timestamps,
  },
  (table) => [
    check("customer_invoice_lines_line_no_chk", sql`${table.lineNo} > 0`),
    check("customer_invoice_lines_quantity_chk", sql`${table.quantity} > 0`),
    check("customer_invoice_lines_unit_price_chk", sql`${table.unitPriceMinor} >= 0`),
    check("customer_invoice_lines_discount_chk", sql`${table.discountMinor} >= 0`),
    check("customer_invoice_lines_tax_amount_chk", sql`${table.taxAmountMinor} >= 0`),
    check("customer_invoice_lines_total_chk", sql`${table.lineTotalMinor} >= 0`),
    uniqueIndex("customer_invoice_lines_no_active_uidx")
      .on(table.customerInvoiceId, table.lineNo)
      .where(sql`${table.deletedAt} is null`),
    index("customer_invoice_lines_order_line_idx").on(table.salesOrderLineId),
    index("customer_invoice_lines_delivery_line_idx").on(table.deliveryLineId),
    index("customer_invoice_lines_product_idx").on(table.productId),
  ],
);

export const customerInvoiceLineTaxes = pgTable(
  "customer_invoice_line_taxes",
  {
    customerInvoiceLineId: uuid("customer_invoice_line_id")
      .notNull()
      .references(() => customerInvoiceLines.id, { onDelete: "cascade", onUpdate: "cascade" }),
    taxId: uuid("tax_id")
      .notNull()
      .references(() => taxes.id, { onDelete: "restrict", onUpdate: "cascade" }),
    taxAmountMinor: bigint("tax_amount_minor", { mode: "number" }).notNull().default(0),
    ...timestamps,
  },
  (table) => [
    primaryKey({ columns: [table.customerInvoiceLineId, table.taxId] }),
    check("customer_invoice_line_taxes_amount_chk", sql`${table.taxAmountMinor} >= 0`),
    index("customer_invoice_line_taxes_tax_idx").on(table.taxId),
  ],
);

export const paymentAllocations = pgTable(
  "payment_allocations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    paymentId: uuid("payment_id")
      .notNull()
      .references(() => payments.id, { onDelete: "cascade", onUpdate: "cascade" }),
    vendorBillId: uuid("vendor_bill_id").references(() => vendorBills.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    purchaseOrderId: uuid("purchase_order_id").references(() => purchaseOrders.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    expenseId: uuid("expense_id").references(() => expenses.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    customerInvoiceId: uuid("customer_invoice_id").references(() => customerInvoices.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    salesOrderId: uuid("sales_order_id").references(() => salesOrders.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    amountMinor: bigint("amount_minor", { mode: "number" }).notNull().default(0),
    notes: text("notes"),
    ...softDelete,
    ...timestamps,
  },
  (table) => [
    check("payment_allocations_amount_chk", sql`${table.amountMinor} > 0`),
    check(
      "payment_allocations_target_chk",
      sql`
        (case when ${table.vendorBillId} is not null then 1 else 0 end)
        + (case when ${table.purchaseOrderId} is not null then 1 else 0 end)
        + (case when ${table.expenseId} is not null then 1 else 0 end)
        + (case when ${table.customerInvoiceId} is not null then 1 else 0 end)
        + (case when ${table.salesOrderId} is not null then 1 else 0 end)
        = 1
      `,
    ),
    uniqueIndex("payment_allocations_vendor_bill_active_uidx")
      .on(table.paymentId, table.vendorBillId)
      .where(sql`${table.deletedAt} is null and ${table.vendorBillId} is not null`),
    uniqueIndex("payment_allocations_purchase_order_active_uidx")
      .on(table.paymentId, table.purchaseOrderId)
      .where(sql`${table.deletedAt} is null and ${table.purchaseOrderId} is not null`),
    uniqueIndex("payment_allocations_expense_active_uidx")
      .on(table.paymentId, table.expenseId)
      .where(sql`${table.deletedAt} is null and ${table.expenseId} is not null`),
    uniqueIndex("payment_allocations_customer_invoice_active_uidx")
      .on(table.paymentId, table.customerInvoiceId)
      .where(sql`${table.deletedAt} is null and ${table.customerInvoiceId} is not null`),
    uniqueIndex("payment_allocations_sales_order_active_uidx")
      .on(table.paymentId, table.salesOrderId)
      .where(sql`${table.deletedAt} is null and ${table.salesOrderId} is not null`),
    index("payment_allocations_payment_idx").on(table.paymentId),
    index("payment_allocations_vendor_bill_idx").on(table.vendorBillId),
    index("payment_allocations_purchase_order_idx").on(table.purchaseOrderId),
    index("payment_allocations_expense_idx").on(table.expenseId),
    index("payment_allocations_customer_invoice_idx").on(table.customerInvoiceId),
    index("payment_allocations_sales_order_idx").on(table.salesOrderId),
  ],
);

export const customerReturns = pgTable(
  "customer_returns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict", onUpdate: "cascade" }),
    salesOrderId: uuid("sales_order_id")
      .notNull()
      .references(() => salesOrders.id, { onDelete: "restrict", onUpdate: "cascade" }),
    deliveryId: uuid("delivery_id").references(() => deliveries.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    customerInvoiceId: uuid("customer_invoice_id").references(() => customerInvoices.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => partners.id, { onDelete: "restrict", onUpdate: "cascade" }),
    returnNo: varchar("return_no", { length: 60 }).notNull(),
    status: returnDocumentStatus("status").notNull().default("draft"),
    returnDate: date("return_date").notNull().defaultNow(),
    refundAmountMinor: bigint("refund_amount_minor", { mode: "number" }).notNull().default(0),
    currencyCode: char("currency_code", { length: 3 })
      .notNull()
      .references(() => currencies.code, { onDelete: "restrict", onUpdate: "cascade" }),
    destinationLocationId: uuid("destination_location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "restrict", onUpdate: "cascade" }),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    postedBy: uuid("posted_by").references(() => users.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    stockMovementId: uuid("stock_movement_id").references(() => stockMovements.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    notes: text("notes"),
    ...softDelete,
    ...timestamps,
  },
  (table) => [
    check("customer_returns_refund_chk", sql`${table.refundAmountMinor} >= 0`),
    check(
      "customer_returns_posted_state_chk",
      sql`
        (${table.status} = 'posted' and ${table.postedAt} is not null and ${table.stockMovementId} is not null)
        or (${table.status} <> 'posted' and ${table.postedAt} is null)
      `,
    ),
    uniqueIndex("customer_returns_no_active_uidx")
      .on(table.companyId, table.returnNo)
      .where(sql`${table.deletedAt} is null`),
    index("customer_returns_sales_order_idx").on(table.salesOrderId),
    index("customer_returns_delivery_idx").on(table.deliveryId),
    index("customer_returns_invoice_idx").on(table.customerInvoiceId),
    index("customer_returns_customer_idx").on(table.customerId),
    index("customer_returns_status_idx").on(table.companyId, table.status),
  ],
);

export const customerReturnLines = pgTable(
  "customer_return_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    customerReturnId: uuid("customer_return_id")
      .notNull()
      .references(() => customerReturns.id, { onDelete: "cascade", onUpdate: "cascade" }),
    salesOrderLineId: uuid("sales_order_line_id").references(() => salesOrderLines.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    deliveryLineId: uuid("delivery_line_id").references(() => deliveryLines.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    lineNo: smallint("line_no").notNull(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict", onUpdate: "cascade" }),
    productSerialId: uuid("product_serial_id").references(() => productSerials.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    productLotId: uuid("product_lot_id").references(() => productLots.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    unitId: uuid("unit_id")
      .notNull()
      .references(() => unitsOfMeasure.id, { onDelete: "restrict", onUpdate: "cascade" }),
    quantityReturned: numeric("quantity_returned", { precision: 20, scale: 6 }).notNull(),
    condition: returnLineCondition("condition").notNull().default("returned"),
    refundAmountMinor: bigint("refund_amount_minor", { mode: "number" }).notNull().default(0),
    currencyCode: char("currency_code", { length: 3 })
      .notNull()
      .references(() => currencies.code, { onDelete: "restrict", onUpdate: "cascade" }),
    serialNo: varchar("serial_no", { length: 120 }),
    lotNo: varchar("lot_no", { length: 120 }),
    notes: text("notes"),
    ...softDelete,
    ...timestamps,
  },
  (table) => [
    check("customer_return_lines_line_no_chk", sql`${table.lineNo} > 0`),
    check("customer_return_lines_quantity_chk", sql`${table.quantityReturned} > 0`),
    check("customer_return_lines_refund_chk", sql`${table.refundAmountMinor} >= 0`),
    uniqueIndex("customer_return_lines_no_active_uidx")
      .on(table.customerReturnId, table.lineNo)
      .where(sql`${table.deletedAt} is null`),
    index("customer_return_lines_sales_order_line_idx").on(table.salesOrderLineId),
    index("customer_return_lines_delivery_line_idx").on(table.deliveryLineId),
    index("customer_return_lines_product_idx").on(table.productId),
    index("customer_return_lines_serial_idx").on(table.productSerialId),
  ],
);

export const customerRefundPlaceholders = pgTable(
  "customer_refund_placeholders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict", onUpdate: "cascade" }),
    customerReturnId: uuid("customer_return_id")
      .notNull()
      .references(() => customerReturns.id, { onDelete: "restrict", onUpdate: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => partners.id, { onDelete: "restrict", onUpdate: "cascade" }),
    refundNo: varchar("refund_no", { length: 60 }).notNull(),
    status: refundPlaceholderStatus("status").notNull().default("pending"),
    refundDate: date("refund_date").notNull().defaultNow(),
    amountMinor: bigint("amount_minor", { mode: "number" }).notNull().default(0),
    currencyCode: char("currency_code", { length: 3 })
      .notNull()
      .references(() => currencies.code, { onDelete: "restrict", onUpdate: "cascade" }),
    notes: text("notes"),
    ...softDelete,
    ...timestamps,
  },
  (table) => [
    check("customer_refund_placeholders_amount_chk", sql`${table.amountMinor} >= 0`),
    uniqueIndex("customer_refund_placeholders_no_active_uidx")
      .on(table.companyId, table.refundNo)
      .where(sql`${table.deletedAt} is null`),
    index("customer_refund_placeholders_return_idx").on(table.customerReturnId),
    index("customer_refund_placeholders_customer_idx").on(table.customerId),
  ],
);

export const supplierReturns = pgTable(
  "supplier_returns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict", onUpdate: "cascade" }),
    purchaseOrderId: uuid("purchase_order_id").references(() => purchaseOrders.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    goodsReceiptId: uuid("goods_receipt_id")
      .notNull()
      .references(() => goodsReceipts.id, { onDelete: "restrict", onUpdate: "cascade" }),
    vendorBillId: uuid("vendor_bill_id").references(() => vendorBills.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => partners.id, { onDelete: "restrict", onUpdate: "cascade" }),
    returnNo: varchar("return_no", { length: 60 }).notNull(),
    status: returnDocumentStatus("status").notNull().default("draft"),
    returnDate: date("return_date").notNull().defaultNow(),
    refundAmountMinor: bigint("refund_amount_minor", { mode: "number" }).notNull().default(0),
    currencyCode: char("currency_code", { length: 3 })
      .notNull()
      .references(() => currencies.code, { onDelete: "restrict", onUpdate: "cascade" }),
    sourceLocationId: uuid("source_location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "restrict", onUpdate: "cascade" }),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    postedBy: uuid("posted_by").references(() => users.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    stockMovementId: uuid("stock_movement_id").references(() => stockMovements.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    notes: text("notes"),
    ...softDelete,
    ...timestamps,
  },
  (table) => [
    check("supplier_returns_refund_chk", sql`${table.refundAmountMinor} >= 0`),
    check(
      "supplier_returns_posted_state_chk",
      sql`
        (${table.status} = 'posted' and ${table.postedAt} is not null and ${table.stockMovementId} is not null)
        or (${table.status} <> 'posted' and ${table.postedAt} is null)
      `,
    ),
    uniqueIndex("supplier_returns_no_active_uidx")
      .on(table.companyId, table.returnNo)
      .where(sql`${table.deletedAt} is null`),
    index("supplier_returns_purchase_order_idx").on(table.purchaseOrderId),
    index("supplier_returns_receipt_idx").on(table.goodsReceiptId),
    index("supplier_returns_vendor_bill_idx").on(table.vendorBillId),
    index("supplier_returns_supplier_idx").on(table.supplierId),
  ],
);

export const supplierReturnLines = pgTable(
  "supplier_return_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    supplierReturnId: uuid("supplier_return_id")
      .notNull()
      .references(() => supplierReturns.id, { onDelete: "cascade", onUpdate: "cascade" }),
    goodsReceiptLineId: uuid("goods_receipt_line_id").references(() => goodsReceiptLines.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    purchaseOrderLineId: uuid("purchase_order_line_id").references(() => purchaseOrderLines.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    lineNo: smallint("line_no").notNull(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict", onUpdate: "cascade" }),
    productSerialId: uuid("product_serial_id").references(() => productSerials.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    productLotId: uuid("product_lot_id").references(() => productLots.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    unitId: uuid("unit_id")
      .notNull()
      .references(() => unitsOfMeasure.id, { onDelete: "restrict", onUpdate: "cascade" }),
    quantityReturned: numeric("quantity_returned", { precision: 20, scale: 6 }).notNull(),
    condition: returnLineCondition("condition").notNull().default("returned"),
    refundAmountMinor: bigint("refund_amount_minor", { mode: "number" }).notNull().default(0),
    currencyCode: char("currency_code", { length: 3 })
      .notNull()
      .references(() => currencies.code, { onDelete: "restrict", onUpdate: "cascade" }),
    serialNo: varchar("serial_no", { length: 120 }),
    lotNo: varchar("lot_no", { length: 120 }),
    notes: text("notes"),
    ...softDelete,
    ...timestamps,
  },
  (table) => [
    check("supplier_return_lines_line_no_chk", sql`${table.lineNo} > 0`),
    check("supplier_return_lines_quantity_chk", sql`${table.quantityReturned} > 0`),
    check("supplier_return_lines_refund_chk", sql`${table.refundAmountMinor} >= 0`),
    uniqueIndex("supplier_return_lines_no_active_uidx")
      .on(table.supplierReturnId, table.lineNo)
      .where(sql`${table.deletedAt} is null`),
    index("supplier_return_lines_receipt_line_idx").on(table.goodsReceiptLineId),
    index("supplier_return_lines_purchase_order_line_idx").on(table.purchaseOrderLineId),
    index("supplier_return_lines_product_idx").on(table.productId),
    index("supplier_return_lines_serial_idx").on(table.productSerialId),
  ],
);

export const vendorRefundPlaceholders = pgTable(
  "vendor_refund_placeholders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict", onUpdate: "cascade" }),
    supplierReturnId: uuid("supplier_return_id")
      .notNull()
      .references(() => supplierReturns.id, { onDelete: "restrict", onUpdate: "cascade" }),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => partners.id, { onDelete: "restrict", onUpdate: "cascade" }),
    refundNo: varchar("refund_no", { length: 60 }).notNull(),
    status: refundPlaceholderStatus("status").notNull().default("pending"),
    refundDate: date("refund_date").notNull().defaultNow(),
    amountMinor: bigint("amount_minor", { mode: "number" }).notNull().default(0),
    currencyCode: char("currency_code", { length: 3 })
      .notNull()
      .references(() => currencies.code, { onDelete: "restrict", onUpdate: "cascade" }),
    notes: text("notes"),
    ...softDelete,
    ...timestamps,
  },
  (table) => [
    check("vendor_refund_placeholders_amount_chk", sql`${table.amountMinor} >= 0`),
    uniqueIndex("vendor_refund_placeholders_no_active_uidx")
      .on(table.companyId, table.refundNo)
      .where(sql`${table.deletedAt} is null`),
    index("vendor_refund_placeholders_return_idx").on(table.supplierReturnId),
    index("vendor_refund_placeholders_supplier_idx").on(table.supplierId),
  ],
);

export const warrantyRegistrations = pgTable(
  "warranty_registrations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict", onUpdate: "cascade" }),
    productSerialId: uuid("product_serial_id")
      .notNull()
      .references(() => productSerials.id, { onDelete: "restrict", onUpdate: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => partners.id, { onDelete: "restrict", onUpdate: "cascade" }),
    salesOrderId: uuid("sales_order_id").references(() => salesOrders.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    deliveryId: uuid("delivery_id").references(() => deliveries.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    customerInvoiceId: uuid("customer_invoice_id").references(() => customerInvoices.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    warrantyNo: varchar("warranty_no", { length: 60 }).notNull(),
    status: warrantyStatus("status").notNull().default("active"),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    notes: text("notes"),
    ...softDelete,
    ...timestamps,
  },
  (table) => [
    check("warranty_registrations_date_chk", sql`${table.endDate} >= ${table.startDate}`),
    uniqueIndex("warranty_registrations_no_active_uidx")
      .on(table.companyId, table.warrantyNo)
      .where(sql`${table.deletedAt} is null`),
    uniqueIndex("warranty_registrations_serial_active_uidx")
      .on(table.productSerialId)
      .where(sql`${table.deletedAt} is null and ${table.status} = 'active'`),
    index("warranty_registrations_customer_idx").on(table.customerId),
    index("warranty_registrations_sales_order_idx").on(table.salesOrderId),
  ],
);

export const serialOwnershipHistory = pgTable(
  "serial_ownership_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict", onUpdate: "cascade" }),
    productSerialId: uuid("product_serial_id")
      .notNull()
      .references(() => productSerials.id, { onDelete: "restrict", onUpdate: "cascade" }),
    partnerId: uuid("partner_id").references(() => partners.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    ownershipType: serialOwnershipType("ownership_type").notNull(),
    sourceType: varchar("source_type", { length: 80 }).notNull(),
    sourceId: uuid("source_id").notNull(),
    sourceNo: varchar("source_no", { length: 80 }).notNull(),
    effectiveAt: timestamp("effective_at", { withTimezone: true }).notNull().defaultNow(),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [
    index("serial_ownership_history_serial_idx").on(table.productSerialId, table.effectiveAt),
    index("serial_ownership_history_partner_idx").on(table.partnerId),
    index("serial_ownership_history_source_idx").on(table.sourceType, table.sourceId),
  ],
);

export const transfers = pgTable(
  "transfers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict", onUpdate: "cascade" }),
    transferNo: varchar("transfer_no", { length: 60 }).notNull(),
    status: transferStatus("status").notNull().default("draft"),
    ownerId: uuid("owner_id").references(() => owners.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    fromLocationId: uuid("from_location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "restrict", onUpdate: "cascade" }),
    transitLocationId: uuid("transit_location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "restrict", onUpdate: "cascade" }),
    toLocationId: uuid("to_location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "restrict", onUpdate: "cascade" }),
    transferDate: date("transfer_date").notNull().defaultNow(),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    approvedBy: uuid("approved_by").references(() => users.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    dispatchedAt: timestamp("dispatched_at", { withTimezone: true }),
    dispatchedBy: uuid("dispatched_by").references(() => users.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    receivedAt: timestamp("received_at", { withTimezone: true }),
    receivedBy: uuid("received_by").references(() => users.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    dispatchMovementId: uuid("dispatch_movement_id").references(() => stockMovements.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    receiptMovementId: uuid("receipt_movement_id").references(() => stockMovements.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    notes: text("notes"),
    ...softDelete,
    ...timestamps,
  },
  (table) => [
    check(
      "transfers_location_chk",
      sql`${table.fromLocationId} <> ${table.toLocationId} and ${table.fromLocationId} <> ${table.transitLocationId} and ${table.toLocationId} <> ${table.transitLocationId}`,
    ),
    check(
      "transfers_approved_state_chk",
      sql`
        (${table.status} in ('approved', 'dispatched', 'partially_received', 'received') and ${table.approvedAt} is not null)
        or (${table.status} = 'draft' and ${table.approvedAt} is null)
        or (${table.status} = 'cancelled')
      `,
    ),
    check(
      "transfers_dispatched_state_chk",
      sql`
        (${table.status} in ('dispatched', 'partially_received', 'received') and ${table.dispatchedAt} is not null and ${table.dispatchMovementId} is not null)
        or (${table.status} in ('draft', 'approved', 'cancelled') and ${table.dispatchedAt} is null)
      `,
    ),
    uniqueIndex("transfers_no_active_uidx")
      .on(table.companyId, table.transferNo)
      .where(sql`${table.deletedAt} is null`),
    index("transfers_status_idx").on(table.companyId, table.status),
    index("transfers_owner_idx").on(table.companyId, table.ownerId),
    index("transfers_from_location_idx").on(table.fromLocationId),
    index("transfers_to_location_idx").on(table.toLocationId),
  ],
);

export const transferLines = pgTable(
  "transfer_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    transferId: uuid("transfer_id")
      .notNull()
      .references(() => transfers.id, { onDelete: "cascade", onUpdate: "cascade" }),
    lineNo: smallint("line_no").notNull(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict", onUpdate: "cascade" }),
    ownerId: uuid("owner_id").references(() => owners.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    productSerialId: uuid("product_serial_id").references(() => productSerials.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    productLotId: uuid("product_lot_id").references(() => productLots.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    unitId: uuid("unit_id")
      .notNull()
      .references(() => unitsOfMeasure.id, { onDelete: "restrict", onUpdate: "cascade" }),
    quantityRequested: numeric("quantity_requested", { precision: 20, scale: 6 }).notNull(),
    quantityDispatched: numeric("quantity_dispatched", { precision: 20, scale: 6 }).notNull().default("0"),
    quantityReceived: numeric("quantity_received", { precision: 20, scale: 6 }).notNull().default("0"),
    discrepancy: transferLineDiscrepancy("discrepancy").notNull().default("none"),
    unitCostMinor: bigint("unit_cost_minor", { mode: "number" }).notNull().default(0),
    currencyCode: char("currency_code", { length: 3 })
      .notNull()
      .references(() => currencies.code, { onDelete: "restrict", onUpdate: "cascade" }),
    serialNo: varchar("serial_no", { length: 120 }),
    lotNo: varchar("lot_no", { length: 120 }),
    notes: text("notes"),
    ...softDelete,
    ...timestamps,
  },
  (table) => [
    check("transfer_lines_line_no_chk", sql`${table.lineNo} > 0`),
    check("transfer_lines_requested_chk", sql`${table.quantityRequested} > 0`),
    check("transfer_lines_dispatched_chk", sql`${table.quantityDispatched} >= 0`),
    check("transfer_lines_received_chk", sql`${table.quantityReceived} >= 0`),
    check("transfer_lines_cost_chk", sql`${table.unitCostMinor} >= 0`),
    uniqueIndex("transfer_lines_no_active_uidx")
      .on(table.transferId, table.lineNo)
      .where(sql`${table.deletedAt} is null`),
    index("transfer_lines_product_idx").on(table.productId),
    index("transfer_lines_owner_idx").on(table.ownerId),
    index("transfer_lines_serial_idx").on(table.productSerialId),
    index("transfer_lines_lot_idx").on(table.productLotId),
  ],
);

export const goodsReceipts = pgTable(
  "goods_receipts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict", onUpdate: "cascade" }),
    purchaseOrderId: uuid("purchase_order_id")
      .notNull()
      .references(() => purchaseOrders.id, { onDelete: "restrict", onUpdate: "cascade" }),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => partners.id, { onDelete: "restrict", onUpdate: "cascade" }),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "restrict", onUpdate: "cascade" }),
    receiptNo: varchar("receipt_no", { length: 60 }).notNull(),
    status: goodsReceiptStatus("status").notNull().default("draft"),
    receiptDate: timestamp("receipt_date", { withTimezone: true }).notNull().defaultNow(),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    postedBy: uuid("posted_by").references(() => users.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    stockMovementId: uuid("stock_movement_id").references(() => stockMovements.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    supplierBillPlaceholderId: uuid("supplier_bill_placeholder_id").references(
      () => supplierBillPlaceholders.id,
      {
        onDelete: "restrict",
        onUpdate: "cascade",
      },
    ),
    supplierInvoiceNo: varchar("supplier_invoice_no", { length: 80 }),
    notes: text("notes"),
    ...softDelete,
    ...timestamps,
  },
  (table) => [
    check(
      "goods_receipts_posted_state_chk",
      sql`
        (${table.status} = 'posted' and ${table.postedAt} is not null)
        or (${table.status} <> 'posted' and ${table.postedAt} is null)
      `,
    ),
    uniqueIndex("goods_receipts_no_active_uidx")
      .on(table.companyId, table.receiptNo)
      .where(sql`${table.deletedAt} is null`),
    index("goods_receipts_po_idx").on(table.purchaseOrderId),
    index("goods_receipts_status_idx").on(table.companyId, table.status),
    index("goods_receipts_location_date_idx").on(table.locationId, table.receiptDate),
  ],
);

export const goodsReceiptLines = pgTable(
  "goods_receipt_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    goodsReceiptId: uuid("goods_receipt_id")
      .notNull()
      .references(() => goodsReceipts.id, { onDelete: "cascade", onUpdate: "cascade" }),
    purchaseOrderLineId: uuid("purchase_order_line_id").references(() => purchaseOrderLines.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    lineNo: smallint("line_no").notNull(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict", onUpdate: "cascade" }),
    productSerialId: uuid("product_serial_id").references(() => productSerials.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    productLotId: uuid("product_lot_id").references(() => productLots.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    unitId: uuid("unit_id")
      .notNull()
      .references(() => unitsOfMeasure.id, { onDelete: "restrict", onUpdate: "cascade" }),
    quantityReceived: numeric("quantity_received", { precision: 20, scale: 6 }).notNull(),
    unitCostMinor: bigint("unit_cost_minor", { mode: "number" }).notNull().default(0),
    landedUnitCostMinor: bigint("landed_unit_cost_minor", { mode: "number" }).notNull().default(0),
    lineTotalMinor: bigint("line_total_minor", { mode: "number" }).notNull().default(0),
    currencyCode: char("currency_code", { length: 3 })
      .notNull()
      .references(() => currencies.code, { onDelete: "restrict", onUpdate: "cascade" }),
    serialNo: varchar("serial_no", { length: 120 }),
    lotNo: varchar("lot_no", { length: 120 }),
    notes: text("notes"),
    ...softDelete,
    ...timestamps,
  },
  (table) => [
    check("goods_receipt_lines_line_no_chk", sql`${table.lineNo} > 0`),
    check("goods_receipt_lines_quantity_chk", sql`${table.quantityReceived} > 0`),
    check("goods_receipt_lines_unit_cost_chk", sql`${table.unitCostMinor} >= 0`),
    check("goods_receipt_lines_landed_cost_chk", sql`${table.landedUnitCostMinor} >= 0`),
    check("goods_receipt_lines_total_chk", sql`${table.lineTotalMinor} >= 0`),
    uniqueIndex("goods_receipt_lines_no_active_uidx")
      .on(table.goodsReceiptId, table.lineNo)
      .where(sql`${table.deletedAt} is null`),
    index("goods_receipt_lines_po_line_idx").on(table.purchaseOrderLineId),
    index("goods_receipt_lines_product_idx").on(table.productId),
    index("goods_receipt_lines_lot_idx").on(table.productLotId),
  ],
);

export const landedCosts = pgTable(
  "landed_costs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict", onUpdate: "cascade" }),
    purchaseOrderId: uuid("purchase_order_id").references(() => purchaseOrders.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    goodsReceiptId: uuid("goods_receipt_id").references(() => goodsReceipts.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    costNo: varchar("cost_no", { length: 60 }).notNull(),
    costType: landedCostType("cost_type").notNull().default("other"),
    status: landedCostStatus("status").notNull().default("draft"),
    allocationMethod: landedCostAllocationMethod("allocation_method").notNull().default("value"),
    amountMinor: bigint("amount_minor", { mode: "number" }).notNull().default(0),
    currencyCode: char("currency_code", { length: 3 })
      .notNull()
      .references(() => currencies.code, { onDelete: "restrict", onUpdate: "cascade" }),
    vendorId: uuid("vendor_id").references(() => partners.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    notes: text("notes"),
    ...softDelete,
    ...timestamps,
  },
  (table) => [
    check("landed_costs_amount_chk", sql`${table.amountMinor} >= 0`),
    uniqueIndex("landed_costs_no_active_uidx")
      .on(table.companyId, table.costNo)
      .where(sql`${table.deletedAt} is null`),
    index("landed_costs_po_idx").on(table.purchaseOrderId),
    index("landed_costs_receipt_idx").on(table.goodsReceiptId),
  ],
);

export const landedCostAllocations = pgTable(
  "landed_cost_allocations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    landedCostId: uuid("landed_cost_id")
      .notNull()
      .references(() => landedCosts.id, { onDelete: "cascade", onUpdate: "cascade" }),
    goodsReceiptLineId: uuid("goods_receipt_line_id")
      .notNull()
      .references(() => goodsReceiptLines.id, { onDelete: "cascade", onUpdate: "cascade" }),
    allocatedAmountMinor: bigint("allocated_amount_minor", { mode: "number" }).notNull().default(0),
    allocationBasis: numeric("allocation_basis", { precision: 20, scale: 6 }),
    notes: text("notes"),
    ...softDelete,
    ...timestamps,
  },
  (table) => [
    check("landed_cost_allocations_amount_chk", sql`${table.allocatedAmountMinor} >= 0`),
    uniqueIndex("landed_cost_allocations_line_active_uidx")
      .on(table.landedCostId, table.goodsReceiptLineId)
      .where(sql`${table.deletedAt} is null`),
  ],
);

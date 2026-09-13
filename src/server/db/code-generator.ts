import "server-only";

import { type SQL, sql } from "drizzle-orm";

type CodeTable =
  | "brands"
  | "expense_categories"
  | "locations"
  | "partners"
  | "payment_accounts"
  | "payment_methods"
  | "payment_terms"
  | "price_lists"
  | "product_categories"
  | "roles"
  | "taxes"
  | "units_of_measure";

type DocumentTable =
  | "customer_returns"
  | "deliveries"
  | "goods_receipts"
  | "stock_movements"
  | "supplier_returns"
  | "transfers";

type QueryExecutor = {
  execute(query: SQL | string): Promise<unknown[]>;
};

const tableNames: Record<CodeTable, string> = {
  brands: "brands",
  expense_categories: "expense_categories",
  locations: "locations",
  partners: "partners",
  payment_accounts: "payment_accounts",
  payment_methods: "payment_methods",
  payment_terms: "payment_terms",
  price_lists: "price_lists",
  product_categories: "product_categories",
  roles: "roles",
  taxes: "taxes",
  units_of_measure: "units_of_measure",
};

const documentColumns: Record<DocumentTable, { tableName: string; columnName: string }> = {
  customer_returns: { tableName: "customer_returns", columnName: "return_no" },
  deliveries: { tableName: "deliveries", columnName: "delivery_no" },
  goods_receipts: { tableName: "goods_receipts", columnName: "receipt_no" },
  stock_movements: { tableName: "stock_movements", columnName: "movement_no" },
  supplier_returns: { tableName: "supplier_returns", columnName: "return_no" },
  transfers: { tableName: "transfers", columnName: "transfer_no" },
};

export async function generateCompanyCode(
  executor: QueryExecutor,
  {
    companyId,
    table,
    prefix,
    padding = 4,
  }: {
    companyId: string;
    table: CodeTable;
    prefix: string;
    padding?: number;
  },
) {
  const normalizedPrefix = prefix.trim().toUpperCase().replace(/\s+/g, "-");
  const tableName = tableNames[table];
  const pattern = `^${normalizedPrefix}-([0-9]+)$`;
  const filterPattern = `^${normalizedPrefix}-[0-9]+$`;
  const [row] = await executor.execute(sql`
    select (
      ${normalizedPrefix}
      || '-'
      || lpad(
        (coalesce(max((substring(code from ${pattern}))::int), 0) + 1)::text,
        ${padding},
        '0'
      )
    ) as "code"
    from ${sql.raw(`"${tableName}"`)}
    where company_id = ${companyId}
      and deleted_at is null
      and code ~ ${filterPattern}
  `);

  const code = typeof row === "object" && row && "code" in row ? row.code : undefined;

  return typeof code === "string" ? code : `${normalizedPrefix}-${"1".padStart(padding, "0")}`;
}

function currentYear() {
  return new Intl.DateTimeFormat("en", {
    timeZone: "Africa/Addis_Ababa",
    year: "numeric",
  }).format(new Date());
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function generateCompanyDocumentNo(
  executor: QueryExecutor,
  {
    companyId,
    table,
    prefix,
    padding = 5,
  }: {
    companyId: string;
    table: DocumentTable;
    prefix: string;
    padding?: number;
  },
) {
  const year = currentYear();
  const normalizedPrefix = prefix.trim().toUpperCase().replace(/\s+/g, "-");
  const escapedPrefix = escapeRegex(normalizedPrefix);
  const { tableName, columnName } = documentColumns[table];
  const pattern = `^${escapedPrefix}/([0-9]{${padding}})/${year}$`;
  const filterPattern = `^${escapedPrefix}/[0-9]{${padding}}/${year}$`;
  const [row] = await executor.execute(sql`
    select (
      ${normalizedPrefix}
      || '/'
      || lpad(
        (coalesce(max((substring(${sql.raw(`"${columnName}"`)} from ${pattern}))::int), 0) + 1)::text,
        ${padding},
        '0'
      )
      || '/'
      || ${year}
    ) as "documentNo"
    from ${sql.raw(`"${tableName}"`)}
    where company_id = ${companyId}
      and deleted_at is null
      and ${sql.raw(`"${columnName}"`)} ~ ${filterPattern}
  `);

  const documentNo = typeof row === "object" && row && "documentNo" in row ? row.documentNo : undefined;

  return typeof documentNo === "string" ? documentNo : `${normalizedPrefix}/${"1".padStart(padding, "0")}/${year}`;
}

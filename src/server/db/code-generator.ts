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

import { and, asc, desc, eq, ilike, isNotNull, isNull, or, sql } from "drizzle-orm";

import { getDefaultCompany, majorToMinor, minorToDisplay, normalizeCode } from "@/server/catalog/products";
import { db } from "@/server/db/client";
import {
  partnerAddresses,
  partnerContacts,
  partners,
  paymentTerms,
} from "@/server/db/schema";
import type { PartnerDetailRecord, PartnerFinancialSummary } from "@/server/partners/types";
export { addressTypeOptions, partnerStatusOptions } from "@/server/partners/types";

export { majorToMinor, minorToDisplay, normalizeCode };

export async function getPartnerFormOptions() {
  const company = await getDefaultCompany();
  const terms = await db
    .select({
      id: paymentTerms.id,
      code: paymentTerms.code,
      name: paymentTerms.name,
      dueDays: paymentTerms.dueDays,
      description: paymentTerms.description,
      isActive: paymentTerms.isActive,
    })
    .from(paymentTerms)
    .where(and(eq(paymentTerms.companyId, company.id), isNull(paymentTerms.deletedAt)))
    .orderBy(asc(paymentTerms.dueDays), asc(paymentTerms.name));

  return { company, paymentTerms: terms };
}

export async function getPaymentTermList(params: {
  query?: string;
  showDeleted?: boolean;
}) {
  const company = await getDefaultCompany();
  const query = params.query?.trim();
  const deletedFilter = params.showDeleted ? isNotNull(paymentTerms.deletedAt) : isNull(paymentTerms.deletedAt);
  const searchFilter = query
    ? or(
        ilike(paymentTerms.code, `%${query}%`),
        ilike(paymentTerms.name, `%${query}%`),
        ilike(paymentTerms.description, `%${query}%`),
      )
    : undefined;
  const filters = [eq(paymentTerms.companyId, company.id), deletedFilter, searchFilter].filter(Boolean);

  return db
    .select({
      id: paymentTerms.id,
      code: paymentTerms.code,
      name: paymentTerms.name,
      dueDays: paymentTerms.dueDays,
      description: paymentTerms.description,
      isActive: paymentTerms.isActive,
      deletedAt: paymentTerms.deletedAt,
    })
    .from(paymentTerms)
    .where(and(...filters))
    .orderBy(asc(paymentTerms.dueDays), asc(paymentTerms.name));
}

export async function getPartnerList(params: {
  query?: string;
  showDeleted?: boolean;
  role?: "customer" | "supplier";
}) {
  const company = await getDefaultCompany();
  const query = params.query?.trim();
  const deletedFilter = params.showDeleted ? isNotNull(partners.deletedAt) : isNull(partners.deletedAt);
  const roleFilter =
    params.role === "customer"
      ? eq(partners.isCustomer, true)
      : params.role === "supplier"
        ? eq(partners.isSupplier, true)
        : undefined;
  const searchFilter = query
    ? or(
        ilike(partners.code, `%${query}%`),
        ilike(partners.displayName, `%${query}%`),
        ilike(partners.legalName, `%${query}%`),
        ilike(partners.tin, `%${query}%`),
      )
    : undefined;
  const filters = [eq(partners.companyId, company.id), deletedFilter, roleFilter, searchFilter].filter(Boolean);

  return db
    .select({
      id: partners.id,
      code: partners.code,
      displayName: partners.displayName,
      legalName: partners.legalName,
      tin: partners.tin,
      isCustomer: partners.isCustomer,
      isSupplier: partners.isSupplier,
      creditLimitMinor: partners.creditLimitMinor,
      currencyCode: partners.currencyCode,
      status: partners.status,
      deletedAt: partners.deletedAt,
      paymentTermName: paymentTerms.name,
      paymentTermDueDays: paymentTerms.dueDays,
      primaryContactName: partnerContacts.fullName,
      primaryContactPhone: partnerContacts.phone,
      primaryContactEmail: partnerContacts.email,
    })
    .from(partners)
    .leftJoin(paymentTerms, eq(partners.paymentTermId, paymentTerms.id))
    .leftJoin(
      partnerContacts,
      and(
        eq(partners.id, partnerContacts.partnerId),
        eq(partnerContacts.isPrimary, true),
        isNull(partnerContacts.deletedAt),
      ),
    )
    .where(and(...filters))
    .orderBy(desc(partners.createdAt));
}

export async function getPartnerById(id: string) {
  const [partner] = await db
    .select({
      id: partners.id,
      code: partners.code,
      displayName: partners.displayName,
      legalName: partners.legalName,
      tin: partners.tin,
      isCustomer: partners.isCustomer,
      isSupplier: partners.isSupplier,
      paymentTermId: partners.paymentTermId,
      creditLimitMinor: partners.creditLimitMinor,
      currencyCode: partners.currencyCode,
      status: partners.status,
      notes: partners.notes,
      deletedAt: partners.deletedAt,
    })
    .from(partners)
    .where(eq(partners.id, id))
    .limit(1);

  if (!partner) {
    return undefined;
  }

  const [primaryContact] = await db
    .select({
      id: partnerContacts.id,
      fullName: partnerContacts.fullName,
      roleTitle: partnerContacts.roleTitle,
      phone: partnerContacts.phone,
      email: partnerContacts.email,
    })
    .from(partnerContacts)
    .where(
      and(
        eq(partnerContacts.partnerId, id),
        eq(partnerContacts.isPrimary, true),
        isNull(partnerContacts.deletedAt),
      ),
    )
    .limit(1);

  const [primaryAddress] = await db
    .select({
      id: partnerAddresses.id,
      addressType: partnerAddresses.addressType,
      label: partnerAddresses.label,
      line1: partnerAddresses.line1,
      line2: partnerAddresses.line2,
      city: partnerAddresses.city,
      region: partnerAddresses.region,
      country: partnerAddresses.country,
    })
    .from(partnerAddresses)
    .where(
      and(
        eq(partnerAddresses.partnerId, id),
        eq(partnerAddresses.isPrimary, true),
        isNull(partnerAddresses.deletedAt),
      ),
    )
    .limit(1);

  return {
    ...partner,
    primaryContact,
    primaryAddress,
  };
}

export async function getPartnerDetail(id: string): Promise<PartnerDetailRecord | undefined> {
  const company = await getDefaultCompany();

  const [partner] = await db
    .select({
      id: partners.id,
      code: partners.code,
      displayName: partners.displayName,
      legalName: partners.legalName,
      tin: partners.tin,
      isCustomer: partners.isCustomer,
      isSupplier: partners.isSupplier,
      paymentTermId: partners.paymentTermId,
      paymentTermName: paymentTerms.name,
      paymentTermDueDays: paymentTerms.dueDays,
      creditLimitMinor: partners.creditLimitMinor,
      currencyCode: partners.currencyCode,
      status: partners.status,
      notes: partners.notes,
      deletedAt: partners.deletedAt,
    })
    .from(partners)
    .leftJoin(paymentTerms, eq(partners.paymentTermId, paymentTerms.id))
    .where(and(eq(partners.id, id), eq(partners.companyId, company.id), isNull(partners.deletedAt)))
    .limit(1);

  if (!partner) {
    return undefined;
  }

  const [primaryContact, primaryAddress, financial] = await Promise.all([
    db
      .select({
        fullName: partnerContacts.fullName,
        roleTitle: partnerContacts.roleTitle,
        phone: partnerContacts.phone,
        email: partnerContacts.email,
      })
      .from(partnerContacts)
      .where(
        and(
          eq(partnerContacts.partnerId, id),
          eq(partnerContacts.isPrimary, true),
          isNull(partnerContacts.deletedAt),
        ),
      )
      .limit(1)
      .then((rows) => rows[0]),
    db
      .select({
        addressType: partnerAddresses.addressType,
        label: partnerAddresses.label,
        line1: partnerAddresses.line1,
        line2: partnerAddresses.line2,
        city: partnerAddresses.city,
        region: partnerAddresses.region,
        country: partnerAddresses.country,
      })
      .from(partnerAddresses)
      .where(
        and(
          eq(partnerAddresses.partnerId, id),
          eq(partnerAddresses.isPrimary, true),
          isNull(partnerAddresses.deletedAt),
        ),
      )
      .limit(1)
      .then((rows) => rows[0]),
    getPartnerFinancialSummary(company.id, id, partner.creditLimitMinor),
  ]);

  return {
    ...partner,
    primaryContact,
    primaryAddress,
    financial,
  };
}

async function getPartnerFinancialSummary(
  companyId: string,
  partnerId: string,
  creditLimitMinor: number,
): Promise<PartnerFinancialSummary> {
  const [summary] = await db.execute<PartnerFinancialSummary>(sql`
    select
      coalesce((
        select count(*)
        from customer_invoices ci
        where ci.company_id = ${companyId}
          and ci.customer_id = ${partnerId}
          and ci.deleted_at is null
          and ci.status <> 'cancelled'
      ), 0)::int as "invoiceCount",
      coalesce((
        select count(*)
        from vendor_bills vb
        where vb.company_id = ${companyId}
          and vb.supplier_id = ${partnerId}
          and vb.deleted_at is null
          and vb.status <> 'cancelled'
      ), 0)::int as "billCount",
      coalesce((
        select sum(greatest(ci.total_minor - coalesce((
          select sum(pa.amount_minor)
          from payment_allocations pa
          inner join payments p on p.id = pa.payment_id
          where pa.customer_invoice_id = ci.id
            and pa.deleted_at is null
            and p.deleted_at is null
            and p.status = 'posted'
        ), 0), 0))
        from customer_invoices ci
        where ci.company_id = ${companyId}
          and ci.customer_id = ${partnerId}
          and ci.deleted_at is null
          and ci.status <> 'cancelled'
      ), 0)::bigint as "receivableResidualMinor",
      coalesce((
        select sum(greatest(vb.total_minor - coalesce((
          select sum(pa.amount_minor)
          from payment_allocations pa
          inner join payments p on p.id = pa.payment_id
          where pa.vendor_bill_id = vb.id
            and pa.deleted_at is null
            and p.deleted_at is null
            and p.status = 'posted'
        ), 0), 0))
        from vendor_bills vb
        where vb.company_id = ${companyId}
          and vb.supplier_id = ${partnerId}
          and vb.deleted_at is null
          and vb.status <> 'cancelled'
      ), 0)::bigint as "payableResidualMinor",
      greatest(${creditLimitMinor}::bigint - coalesce((
        select sum(greatest(ci.total_minor - coalesce((
          select sum(pa.amount_minor)
          from payment_allocations pa
          inner join payments p on p.id = pa.payment_id
          where pa.customer_invoice_id = ci.id
            and pa.deleted_at is null
            and p.deleted_at is null
            and p.status = 'posted'
        ), 0), 0))
        from customer_invoices ci
        where ci.company_id = ${companyId}
          and ci.customer_id = ${partnerId}
          and ci.deleted_at is null
          and ci.status <> 'cancelled'
      ), 0), 0)::bigint as "remainingCreditMinor",
      coalesce((
        select sum(greatest(ci.total_minor - coalesce((
          select sum(pa.amount_minor)
          from payment_allocations pa
          inner join payments p on p.id = pa.payment_id
          where pa.customer_invoice_id = ci.id
            and pa.deleted_at is null
            and p.deleted_at is null
            and p.status = 'posted'
        ), 0), 0))
        from customer_invoices ci
        where ci.company_id = ${companyId}
          and ci.customer_id = ${partnerId}
          and ci.deleted_at is null
          and ci.status <> 'cancelled'
      ), 0)::bigint - coalesce((
        select sum(greatest(vb.total_minor - coalesce((
          select sum(pa.amount_minor)
          from payment_allocations pa
          inner join payments p on p.id = pa.payment_id
          where pa.vendor_bill_id = vb.id
            and pa.deleted_at is null
            and p.deleted_at is null
            and p.status = 'posted'
        ), 0), 0))
        from vendor_bills vb
        where vb.company_id = ${companyId}
          and vb.supplier_id = ${partnerId}
          and vb.deleted_at is null
          and vb.status <> 'cancelled'
      ), 0)::bigint as "netBalanceMinor"
  `);

  return summary;
}

export function formatPartnerRoles(value: { isCustomer: boolean; isSupplier: boolean }) {
  if (value.isCustomer && value.isSupplier) {
    return "Customer / Supplier";
  }

  if (value.isCustomer) {
    return "Customer";
  }

  return "Supplier";
}

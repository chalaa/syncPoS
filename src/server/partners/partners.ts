import { and, asc, desc, eq, ilike, isNotNull, isNull, or } from "drizzle-orm";

import { getDefaultCompany, majorToMinor, minorToDisplay, normalizeCode } from "@/server/catalog/products";
import { db } from "@/server/db/client";
import {
  partnerAddresses,
  partnerContacts,
  partners,
  paymentTerms,
} from "@/server/db/schema";
import type { PartnerDetailRecord, PartnerStatusOption } from "@/server/partners/types";
import { getPartnerOrderBalances } from "@/server/partners/order-balances";
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
  status?: string;
  paymentTermId?: string;
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
  const statusFilter = params.status ? eq(partners.status, params.status as PartnerStatusOption) : undefined;
  const paymentTermFilter = params.paymentTermId ? eq(partners.paymentTermId, params.paymentTermId) : undefined;

  const searchFilter = query
    ? or(
        ilike(partners.code, `%${query}%`),
        ilike(partners.displayName, `%${query}%`),
        ilike(partners.legalName, `%${query}%`),
        ilike(partners.tin, `%${query}%`),
      )
    : undefined;
  const filters = [
    eq(partners.companyId, company.id),
    deletedFilter,
    roleFilter,
    statusFilter,
    paymentTermFilter,
    searchFilter,
  ].filter(Boolean);

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
    getPartnerOrderBalances(company.id, id, partner.currencyCode, partner.creditLimitMinor),
  ]);

  return {
    ...partner,
    primaryContact,
    primaryAddress,
    financial,
  };
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

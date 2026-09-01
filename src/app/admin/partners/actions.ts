"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";

import {
  addressTypeOptions,
  getPartnerFormOptions,
  majorToMinor,
  normalizeCode,
  partnerStatusOptions,
} from "@/server/partners/partners";
import { uniqueViolationMessage } from "@/server/catalog/products";
import { requirePermission } from "@/server/auth/session";
import { db } from "@/server/db/client";
import { generateCompanyCode } from "@/server/db/code-generator";
import {
  partnerAddresses,
  partnerContacts,
  partners,
  paymentTerms,
} from "@/server/db/schema";

const optionalUuid = z.string().uuid().or(z.literal("")).transform((value) => value || null);

const partnerFormSchema = z
  .object({
    id: z.string().uuid().optional(),
    code: z.string().trim().max(40),
    displayName: z.string().trim().min(1, "Display name is required").max(200),
    legalName: z.string().trim().max(200).optional(),
    tin: z.string().trim().max(30).optional(),
    isCustomer: z.boolean(),
    isSupplier: z.boolean(),
    paymentTermId: optionalUuid,
    creditLimit: z.string().trim().default("0"),
    status: z.enum(partnerStatusOptions),
    notes: z.string().trim().optional(),
    contactName: z.string().trim().max(160).optional(),
    contactRole: z.string().trim().max(100).optional(),
    contactPhone: z.string().trim().max(40).optional(),
    contactEmail: z.string().trim().max(160).optional(),
    addressType: z.enum(addressTypeOptions),
    addressLabel: z.string().trim().max(100).optional(),
    addressLine1: z.string().trim().max(200).optional(),
    addressLine2: z.string().trim().max(200).optional(),
    city: z.string().trim().max(120).optional(),
    region: z.string().trim().max(120).optional(),
    country: z.string().trim().min(1).max(120).default("Ethiopia"),
  })
  .refine((value) => value.isCustomer || value.isSupplier, {
    message: "Select customer, supplier, or both.",
    path: ["isCustomer"],
  });

const paymentTermSchema = z.object({
  id: z.string().uuid().optional(),
  code: z.string().trim().max(40),
  name: z.string().trim().min(1).max(120),
  dueDays: z.coerce.number().int().min(0).max(3650),
  description: z.string().trim().optional(),
  isActive: z.enum(["on"]).optional(),
  returnPath: z.string().trim().startsWith("/admin/partners").default("/admin/partners/payment-terms"),
});

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : "";
}

function partnerPayload(formData: FormData) {
  return {
    id: formValue(formData, "id") || undefined,
    code: normalizeCode(formValue(formData, "code")),
    displayName: formValue(formData, "displayName"),
    legalName: formValue(formData, "legalName"),
    tin: formValue(formData, "tin"),
    isCustomer: formData.get("isCustomer") === "on",
    isSupplier: formData.get("isSupplier") === "on",
    paymentTermId: formValue(formData, "paymentTermId"),
    creditLimit: formValue(formData, "creditLimit") || "0",
    status: formValue(formData, "status"),
    notes: formValue(formData, "notes"),
    contactName: formValue(formData, "contactName"),
    contactRole: formValue(formData, "contactRole"),
    contactPhone: formValue(formData, "contactPhone"),
    contactEmail: formValue(formData, "contactEmail"),
    addressType: formValue(formData, "addressType") || "office",
    addressLabel: formValue(formData, "addressLabel"),
    addressLine1: formValue(formData, "addressLine1"),
    addressLine2: formValue(formData, "addressLine2"),
    city: formValue(formData, "city"),
    region: formValue(formData, "region"),
    country: formValue(formData, "country") || "Ethiopia",
  };
}

function formErrorPath(path: string, error: unknown) {
  const message = error instanceof z.ZodError ? error.issues[0]?.message : String(error);

  return `${path}?error=${encodeURIComponent(message || "Invalid form data")}`;
}

function redirectWithMessage(path: string, key: "notice" | "error", message: string): never {
  redirect(`${path}${path.includes("?") ? "&" : "?"}${key}=${encodeURIComponent(message)}`);
}

function paymentTermPayload(formData: FormData) {
  return {
    id: formValue(formData, "id") || undefined,
    code: normalizeCode(formValue(formData, "code")),
    name: formValue(formData, "name"),
    dueDays: formValue(formData, "dueDays") || "0",
    description: formValue(formData, "description"),
    isActive: formData.get("isActive") === "on" ? "on" : undefined,
    returnPath: formValue(formData, "returnPath") || "/admin/partners/payment-terms",
  };
}

function partnerCodePrefix(value: { isCustomer: boolean; isSupplier: boolean }) {
  if (value.isCustomer && value.isSupplier) {
    return "PART";
  }

  return value.isCustomer ? "CUST" : "SUP";
}

async function upsertPrimaryContact(
  partnerId: string,
  contact: {
    contactName?: string;
    contactRole?: string;
    contactPhone?: string;
    contactEmail?: string;
  },
) {
  if (!contact.contactName && !contact.contactPhone && !contact.contactEmail) {
    return;
  }

  const [existing] = await db
    .select({ id: partnerContacts.id })
    .from(partnerContacts)
    .where(
      and(
        eq(partnerContacts.partnerId, partnerId),
        eq(partnerContacts.isPrimary, true),
        isNull(partnerContacts.deletedAt),
      ),
    )
    .limit(1);

  const values = {
    fullName: contact.contactName || "Primary Contact",
    roleTitle: contact.contactRole || null,
    phone: contact.contactPhone || null,
    email: contact.contactEmail || null,
    isPrimary: true,
    updatedAt: sql`now()`,
  };

  if (existing) {
    await db.update(partnerContacts).set(values).where(eq(partnerContacts.id, existing.id));
    return;
  }

  await db.insert(partnerContacts).values({
    partnerId,
    ...values,
  });
}

async function upsertPrimaryAddress(
  partnerId: string,
  address: {
    addressType: (typeof addressTypeOptions)[number];
    addressLabel?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    region?: string;
    country: string;
  },
) {
  if (!address.addressLine1) {
    return;
  }

  const [existing] = await db
    .select({ id: partnerAddresses.id })
    .from(partnerAddresses)
    .where(
      and(
        eq(partnerAddresses.partnerId, partnerId),
        eq(partnerAddresses.isPrimary, true),
        isNull(partnerAddresses.deletedAt),
      ),
    )
    .limit(1);

  const values = {
    addressType: address.addressType,
    label: address.addressLabel || null,
    line1: address.addressLine1,
    line2: address.addressLine2 || null,
    city: address.city || null,
    region: address.region || null,
    country: address.country,
    isPrimary: true,
    updatedAt: sql`now()`,
  };

  if (existing) {
    await db.update(partnerAddresses).set(values).where(eq(partnerAddresses.id, existing.id));
    return;
  }

  await db.insert(partnerAddresses).values({
    partnerId,
    ...values,
  });
}

export async function createPartner(formData: FormData) {
  await requirePermission("partner.manage");

  const parsed = partnerFormSchema.safeParse(partnerPayload(formData));

  if (!parsed.success) {
    redirect(formErrorPath("/admin/partners/new", parsed.error));
  }

  const { company } = await getPartnerFormOptions();

  try {
    const code = parsed.data.code || await generateCompanyCode(db, {
      companyId: company.id,
      table: "partners",
      prefix: partnerCodePrefix(parsed.data),
    });
    const [partner] = await db
      .insert(partners)
      .values({
        companyId: company.id,
        code,
        displayName: parsed.data.displayName,
        legalName: parsed.data.legalName || null,
        tin: parsed.data.tin || null,
        isCustomer: parsed.data.isCustomer,
        isSupplier: parsed.data.isSupplier,
        paymentTermId: parsed.data.paymentTermId,
        creditLimitMinor: majorToMinor(parsed.data.creditLimit),
        currencyCode: company.baseCurrencyCode,
        status: parsed.data.status,
        notes: parsed.data.notes || null,
      })
      .returning({ id: partners.id });

    await upsertPrimaryContact(partner.id, parsed.data);
    await upsertPrimaryAddress(partner.id, parsed.data);
  } catch (error) {
    redirect(
      `/admin/partners/new?error=${encodeURIComponent(
        uniqueViolationMessage(error, "Could not create partner."),
      )}`,
    );
  }

  revalidatePath("/admin/partners");
  redirect("/admin/partners?notice=Partner created");
}

export async function updatePartner(formData: FormData) {
  await requirePermission("partner.manage");

  const parsed = partnerFormSchema.safeParse(partnerPayload(formData));

  if (!parsed.success || !parsed.data.id || !parsed.data.code) {
    redirect(formErrorPath("/admin/partners", parsed.success ? "Partner ID is missing" : parsed.error));
  }

  try {
    await db
      .update(partners)
      .set({
        code: parsed.data.code,
        displayName: parsed.data.displayName,
        legalName: parsed.data.legalName || null,
        tin: parsed.data.tin || null,
        isCustomer: parsed.data.isCustomer,
        isSupplier: parsed.data.isSupplier,
        paymentTermId: parsed.data.paymentTermId,
        creditLimitMinor: majorToMinor(parsed.data.creditLimit),
        status: parsed.data.status,
        notes: parsed.data.notes || null,
        updatedAt: sql`now()`,
      })
      .where(eq(partners.id, parsed.data.id));

    await upsertPrimaryContact(parsed.data.id, parsed.data);
    await upsertPrimaryAddress(parsed.data.id, parsed.data);
  } catch (error) {
    redirect(
      `/admin/partners/${parsed.data.id}/edit?error=${encodeURIComponent(
        uniqueViolationMessage(error, "Could not update partner."),
      )}`,
    );
  }

  revalidatePath("/admin/partners");
  redirect("/admin/partners?notice=Partner updated");
}

export async function softDeletePartner(formData: FormData) {
  await requirePermission("partner.manage");

  const id = formValue(formData, "id");

  if (!id) {
    redirect("/admin/partners?error=Partner ID is missing");
  }

  await db
    .update(partners)
    .set({
      deletedAt: sql`now()`,
      deleteReason: "Deleted from partner admin screen",
      updatedAt: sql`now()`,
    })
    .where(eq(partners.id, id));

  revalidatePath("/admin/partners");
  redirect("/admin/partners?notice=Partner deleted");
}

export async function restorePartner(formData: FormData) {
  await requirePermission("partner.manage");

  const id = formValue(formData, "id");

  if (!id) {
    redirect("/admin/partners?show=deleted&error=Partner ID is missing");
  }

  await db
    .update(partners)
    .set({
      deletedAt: null,
      deletedBy: null,
      deleteReason: null,
      updatedAt: sql`now()`,
    })
    .where(eq(partners.id, id));

  revalidatePath("/admin/partners");
  redirect("/admin/partners?show=deleted&notice=Partner restored");
}

export async function createPaymentTerm(formData: FormData) {
  await requirePermission("partner.manage");

  const parsed = paymentTermSchema.safeParse(paymentTermPayload(formData));

  if (!parsed.success) {
    redirectWithMessage("/admin/partners/payment-terms", "error", "Payment term code, name, and due days are required");
  }

  const { company } = await getPartnerFormOptions();

  try {
    await db.insert(paymentTerms).values({
      companyId: company.id,
      code: parsed.data.code || await generateCompanyCode(db, {
        companyId: company.id,
        table: "payment_terms",
        prefix: "TERM",
      }),
      name: parsed.data.name,
      dueDays: parsed.data.dueDays,
      description: parsed.data.description || null,
      isActive: parsed.data.isActive === "on",
    });
  } catch (error) {
    redirectWithMessage(parsed.data.returnPath, "error", uniqueViolationMessage(error, "Could not create payment term."));
  }

  revalidatePath("/admin/partners");
  revalidatePath("/admin/partners/payment-terms");
  redirectWithMessage(parsed.data.returnPath, "notice", "Payment term created");
}

export async function updatePaymentTerm(formData: FormData) {
  await requirePermission("partner.manage");

  const parsed = paymentTermSchema.safeParse(paymentTermPayload(formData));

  if (!parsed.success || !parsed.data.id || !parsed.data.code) {
    redirectWithMessage("/admin/partners/payment-terms", "error", "Payment term ID, code, name, and due days are required");
  }

  try {
    await db
      .update(paymentTerms)
      .set({
        code: parsed.data.code,
        name: parsed.data.name,
        dueDays: parsed.data.dueDays,
        description: parsed.data.description || null,
        isActive: parsed.data.isActive === "on",
        updatedAt: sql`now()`,
      })
      .where(eq(paymentTerms.id, parsed.data.id));
  } catch (error) {
    redirectWithMessage(parsed.data.returnPath, "error", uniqueViolationMessage(error, "Could not update payment term."));
  }

  revalidatePath("/admin/partners");
  revalidatePath("/admin/partners/payment-terms");
  redirectWithMessage(parsed.data.returnPath, "notice", "Payment term updated");
}

export async function softDeletePaymentTerm(formData: FormData) {
  await requirePermission("partner.manage");

  const id = formValue(formData, "id");
  const returnPath = formValue(formData, "returnPath") || "/admin/partners/payment-terms";

  if (!id) {
    redirectWithMessage(returnPath, "error", "Payment term ID is missing");
  }

  await db
    .update(paymentTerms)
    .set({
      deletedAt: sql`now()`,
      deleteReason: "Deleted from payment term admin screen",
      updatedAt: sql`now()`,
    })
    .where(eq(paymentTerms.id, id));

  revalidatePath("/admin/partners");
  revalidatePath("/admin/partners/payment-terms");
  redirectWithMessage(returnPath, "notice", "Payment term deleted");
}

export async function restorePaymentTerm(formData: FormData) {
  await requirePermission("partner.manage");

  const id = formValue(formData, "id");
  const returnPath = formValue(formData, "returnPath") || "/admin/partners/payment-terms?show=deleted";

  if (!id) {
    redirectWithMessage(returnPath, "error", "Payment term ID is missing");
  }

  await db
    .update(paymentTerms)
    .set({
      deletedAt: null,
      deletedBy: null,
      deleteReason: null,
      updatedAt: sql`now()`,
    })
    .where(eq(paymentTerms.id, id));

  revalidatePath("/admin/partners");
  revalidatePath("/admin/partners/payment-terms");
  redirectWithMessage(returnPath, "notice", "Payment term restored");
}

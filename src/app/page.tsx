import {
  ArrowRightIcon,
  BadgeCheckIcon,
  BoxesIcon,
  CircleDollarSignIcon,
  ClipboardCheckIcon,
  DatabaseZapIcon,
  PackageCheckIcon,
  ReceiptTextIcon,
  ShieldCheckIcon,
  ShoppingBagIcon,
  WifiOffIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ComponentType } from "react";

type Module = {
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
};

const modules: Module[] = [
  {
    title: "Catalog Control",
    description: "Products, brands, units, taxes, serials, lots, and price lists stay structured from the first sale.",
    icon: BoxesIcon,
  },
  {
    title: "Inventory Authority",
    description: "Movement-led stock, warehouse locations, opening stock, serial history, and as-of reporting foundations.",
    icon: PackageCheckIcon,
  },
  {
    title: "Purchasing Flow",
    description: "RFQs, purchase orders, receipts, vendor bills, landed costs, and supplier payments connect cleanly.",
    icon: ShoppingBagIcon,
  },
  {
    title: "Expense Tracking",
    description: "Non-stock costs can be categorized, attached, paid, and excluded from normal totals when cancelled.",
    icon: ReceiptTextIcon,
  },
];

const operatingPoints = [
  "Soft-delete friendly records with active unique indexes",
  "PostgreSQL and Drizzle migrations reviewed before rollout",
  "Role, permission, and location-aware access patterns",
  "Offline-first POS direction with Dexie and sync idempotency",
];

const metrics = [
  ["53", "Designed tables"],
  ["12", "Migration steps"],
  ["4", "Core workflows active"],
  ["1", "Offline-ready roadmap"],
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f4f6f5] text-[#16201f]">
      <Hero />
      <section className="border-y border-[#d8dfdc] bg-white">
        <div className="mx-auto grid max-w-7xl gap-0 px-6 md:grid-cols-4">
          {metrics.map(([value, label]) => (
            <div key={label} className="border-[#d8dfdc] py-6 md:border-r md:px-6 first:md:border-l">
              <p className="text-3xl font-semibold text-[#0f5f54]">{value}</p>
              <p className="mt-1 text-sm text-[#5e6f6c]">{label}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="modules" className="mx-auto max-w-7xl px-6 py-16">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase text-[#7a5a13]">Built For Machinery Retail</p>
          <h2 className="mt-2 text-3xl font-semibold text-[#16201f]">One system for the counter, warehouse, purchasing desk, and manager.</h2>
          <p className="mt-4 text-base leading-7 text-[#5e6f6c]">
            syncPoS is shaped around machinery shops where serialized machines, spare parts, supplier documents, and location-based stock need to agree before sales begin.
          </p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {modules.map((module) => (
            <article key={module.title} className="rounded-lg border border-[#d8dfdc] bg-white p-5 shadow-sm">
              <div className="flex size-11 items-center justify-center rounded-md bg-[#e4efeb] text-[#0f5f54]">
                <module.icon className="size-5" />
              </div>
              <h3 className="mt-5 text-lg font-semibold">{module.title}</h3>
              <p className="mt-2 text-sm leading-6 text-[#5e6f6c]">{module.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-[#16201f] text-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-16 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="text-sm font-semibold uppercase text-[#f2c14e]">Operational Discipline</p>
            <h2 className="mt-2 text-3xl font-semibold">Designed around documents that post, trace, and reconcile.</h2>
            <p className="mt-4 text-base leading-7 text-[#c4cfcb]">
              The app follows an Odoo-inspired flow: configuration first, master data next, then controlled documents for receipts, bills, payments, stock moves, and expenses.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {operatingPoints.map((point) => (
              <div key={point} className="rounded-lg border border-white/15 bg-white/5 p-4">
                <BadgeCheckIcon className="size-5 text-[#f2c14e]" />
                <p className="mt-3 text-sm leading-6 text-[#eef4f1]">{point}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-6 py-16 lg:grid-cols-3">
        <WorkflowStep
          icon={ClipboardCheckIcon}
          title="Configure"
          description="Set companies, roles, locations, payment methods, taxes, categories, and warehouse rules before users transact."
        />
        <WorkflowStep
          icon={DatabaseZapIcon}
          title="Transact"
          description="Create products, partners, purchase orders, receipts, vendor bills, supplier payments, and expense documents."
        />
        <WorkflowStep
          icon={WifiOffIcon}
          title="Prepare Offline"
          description="Build toward controlled local POS snapshots and idempotent sync after online workflows are stable."
        />
      </section>

      <section className="border-t border-[#d8dfdc] bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-6 py-10 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase text-[#7a5a13]">Ready To Operate</p>
            <h2 className="mt-1 text-2xl font-semibold">Continue building from a clean management foundation.</h2>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[#0f5f54] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#0a4b43]"
            >
              Open Workspace
              <ArrowRightIcon className="size-4" />
            </Link>
            <Link
              href="/login"
              className="inline-flex h-11 items-center justify-center rounded-md border border-[#bfcac6] bg-white px-5 text-sm font-semibold text-[#16201f] transition-colors hover:bg-[#eef3f1]"
            >
              Sign In
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

function Hero() {
  return (
    <section className="relative min-h-[88svh] overflow-hidden">
      <Image
        src="/syncpos-machinery-hero.png"
        alt="Machinery showroom with spare parts shelves and a POS terminal"
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(8,19,18,0.88)_0%,rgba(8,19,18,0.72)_34%,rgba(8,19,18,0.25)_68%,rgba(8,19,18,0.08)_100%)]" />

      <div className="relative z-10 mx-auto flex min-h-[88svh] max-w-7xl flex-col px-6">
        <header className="flex items-center justify-between py-6 text-white">
          <Link href="/" className="text-xl font-semibold">syncPoS</Link>
          <nav className="flex items-center gap-3 text-sm">
            <Link href="/login" className="hidden font-medium text-white/85 hover:text-white sm:inline">Sign in</Link>
            <Link
              href="/admin"
              className="inline-flex h-10 items-center justify-center rounded-md bg-white px-4 font-semibold text-[#0f3834] transition-colors hover:bg-[#eef3f1]"
            >
              Open App
            </Link>
          </nav>
        </header>

        <div className="flex max-w-3xl flex-1 flex-col justify-center pb-12 pt-8 text-white">
          <p className="text-sm font-semibold uppercase text-[#f2c14e]">Machinery Retail Management</p>
          <h1 className="mt-4 text-5xl font-semibold leading-tight md:text-6xl">
            syncPoS
          </h1>
          <p className="mt-5 max-w-2xl text-xl leading-8 text-[#eef4f1]">
            A practical management system for machinery sales, spare parts inventory, purchasing, payments, expenses, and future offline POS sync.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/admin"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-[#f2c14e] px-5 text-sm font-semibold text-[#1b261f] transition-colors hover:bg-[#ffd66c]"
            >
              Enter Workspace
              <ArrowRightIcon className="size-4" />
            </Link>
            <Link
              href="#modules"
              className="inline-flex h-12 items-center justify-center rounded-md border border-white/35 bg-white/10 px-5 text-sm font-semibold text-white transition-colors hover:bg-white/20"
            >
              View Modules
            </Link>
          </div>
          <div className="mt-10 grid max-w-2xl gap-3 sm:grid-cols-3">
            <HeroBadge icon={ShieldCheckIcon} label="Role-aware" />
            <HeroBadge icon={CircleDollarSignIcon} label="Payment-ready" />
            <HeroBadge icon={WifiOffIcon} label="Offline roadmap" />
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroBadge({ icon: Icon, label }: { icon: ComponentType<{ className?: string }>; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-white/20 bg-black/20 px-3 py-2 text-sm font-medium text-white">
      <Icon className="size-4 text-[#f2c14e]" />
      {label}
    </div>
  );
}

function WorkflowStep({
  icon: Icon,
  title,
  description,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <article className="rounded-lg border border-[#d8dfdc] bg-white p-6">
      <Icon className="size-7 text-[#0f5f54]" />
      <h3 className="mt-5 text-xl font-semibold">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-[#5e6f6c]">{description}</p>
    </article>
  );
}

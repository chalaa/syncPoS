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
    <main className="min-h-screen bg-background text-foreground">
      <Hero />
      <section className="border-y border-border bg-card">
        <div className="mx-auto grid max-w-7xl gap-0 px-6 md:grid-cols-4">
          {metrics.map(([value, label]) => (
            <div key={label} className="border-border py-6 md:border-r md:px-6 first:md:border-l">
              <p className="text-3xl font-bold tracking-tight text-primary">{value}</p>
              <p className="mt-1 text-sm font-medium text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="modules" className="mx-auto max-w-7xl px-6 py-16">
        <div className="max-w-3xl">
          <p className="text-sm font-bold uppercase tracking-wider text-accent-dark">Built For Machinery Retail</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-foreground">One system for the counter, warehouse, purchasing desk, and manager.</h2>
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            syncPoS is shaped around machinery shops where serialized machines, spare parts, supplier documents, and location-based stock need to agree before sales begin.
          </p>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {modules.map((module) => (
            <article key={module.title} className="rounded-xl border border-border bg-card p-6 shadow-xs transition-shadow hover:shadow-md">
              <div className="flex size-11 items-center justify-center rounded-lg bg-secondary text-primary">
                <module.icon className="size-5" />
              </div>
              <h3 className="mt-5 text-lg font-semibold text-foreground">{module.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{module.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-dark text-dark-foreground">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-16 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="text-sm font-bold uppercase tracking-wider text-gold">Operational Discipline</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight">Designed around documents that post, trace, and reconcile.</h2>
            <p className="mt-4 text-base leading-7 text-dark-foreground/80">
              The app follows an Odoo-inspired flow: configuration first, master data next, then controlled documents for receipts, bills, payments, stock moves, and expenses.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {operatingPoints.map((point) => (
              <div key={point} className="rounded-lg border border-white/10 bg-white/5 p-4 backdrop-blur-xs">
                <BadgeCheckIcon className="size-5 text-gold" />
                <p className="mt-3 text-sm leading-6 text-dark-foreground/90">{point}</p>
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

      <section className="border-t border-border bg-card">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-6 py-10 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-wider text-accent-dark">Ready To Operate</p>
            <h2 className="mt-1 text-2xl font-bold text-foreground">Continue building from a clean management foundation.</h2>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-xs transition-colors hover:bg-dark"
            >
              Open Workspace
              <ArrowRightIcon className="size-4" />
            </Link>
            <Link
              href="/login"
              className="inline-flex h-11 items-center justify-center rounded-md border border-border bg-card px-5 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
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
              className="inline-flex h-10 items-center justify-center rounded-md bg-card px-4 font-semibold text-dark transition-colors hover:bg-secondary shadow-xs"
            >
              Open App
            </Link>
          </nav>
        </header>

        <div className="flex max-w-3xl flex-1 flex-col justify-center pb-12 pt-8 text-white">
          <p className="text-sm font-bold uppercase tracking-wider text-gold">Machinery Retail Management</p>
          <h1 className="mt-4 text-5xl font-bold leading-tight md:text-6xl tracking-tight">
            syncPoS
          </h1>
          <p className="mt-5 max-w-2xl text-xl leading-8 text-white/90">
            A practical management system for machinery sales, spare parts inventory, purchasing, payments, expenses, and future offline POS sync.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/admin"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-gold px-6 text-sm font-bold text-dark shadow-md transition-colors hover:bg-accent-dark hover:text-white"
            >
              Enter Workspace
              <ArrowRightIcon className="size-4" />
            </Link>
            <Link
              href="#modules"
              className="inline-flex h-12 items-center justify-center rounded-md border border-white/30 bg-white/10 px-6 text-sm font-semibold text-white backdrop-blur-xs transition-colors hover:bg-white/20"
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
    <div className="flex items-center gap-2 rounded-lg border border-white/15 bg-black/25 px-3.5 py-2.5 text-sm font-medium text-white backdrop-blur-xs">
      <Icon className="size-4 text-gold" />
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
    <article className="rounded-xl border border-border bg-card p-6 shadow-xs transition-shadow hover:shadow-md">
      <div className="flex size-12 items-center justify-center rounded-lg bg-secondary text-primary">
        <Icon className="size-6" />
      </div>
      <h3 className="mt-5 text-xl font-bold tracking-tight text-foreground">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p>
    </article>
  );
}

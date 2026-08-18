import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f5f7f8] text-[#172026]">
      <section className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-6 py-8">
        <header className="flex items-center justify-between border-b border-[#d7dcdf] pb-5">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-[#58706f]">
              Machinery Retail Management
            </p>
            <h1 className="mt-1 text-2xl font-semibold">syncPoS</h1>
          </div>
          <div className="rounded-md border border-[#c9d1d4] bg-white px-3 py-2 text-sm font-medium text-[#2f4a49]">
            Foundation ready
          </div>
        </header>

        <div className="grid flex-1 gap-6 py-8 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-lg border border-[#d7dcdf] bg-white p-6">
            <h2 className="text-xl font-semibold">Implementation Roadmap</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5c696e]">
              The first milestone is proving offline sales durability and sync
              idempotency before expanding into inventory, purchasing,
              transfers, expenses, and analytics.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {[
                "Offline sync proof",
                "Master data",
                "Inventory ledger",
                "Purchasing",
                "Sales and POS",
                "Transfers",
                "Expenses and accounting",
                "Analytics",
              ].map((item, index) => (
                <div
                  key={item}
                  className="rounded-md border border-[#e1e6e8] bg-[#fbfcfc] p-4"
                >
                  <span className="text-xs font-semibold text-[#58706f]">
                    Phase {index + 1}
                  </span>
                  <p className="mt-1 font-medium">{item}</p>
                </div>
              ))}
            </div>
            <div className="mt-6">
              <Link
                href="/admin/products"
                className="mr-3 inline-flex rounded-md bg-[#1f6b5c] px-4 py-2 text-sm font-semibold text-white"
              >
                Open products
              </Link>
              <Link
                href="/admin/partners"
                className="inline-flex rounded-md border border-[#c9d1d4] bg-white px-4 py-2 text-sm font-semibold text-[#1f4f46]"
              >
                Open partners
              </Link>
            </div>
          </section>

          <aside className="rounded-lg border border-[#d7dcdf] bg-white p-6">
            <h2 className="text-xl font-semibold">Selected Stack</h2>
            <dl className="mt-5 space-y-4 text-sm">
              {[
                ["App", "Next.js + TypeScript + src directory"],
                ["Database", "PostgreSQL"],
                ["ORM", "Drizzle ORM"],
                ["Offline POS", "IndexedDB with Dexie"],
                ["Validation", "Zod"],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="font-semibold text-[#58706f]">{label}</dt>
                  <dd className="mt-1 text-[#172026]">{value}</dd>
                </div>
              ))}
            </dl>
          </aside>
        </div>
      </section>
    </main>
  );
}

import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function UnauthorizedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
      <section className="w-full max-w-md rounded-lg border border-border bg-card p-6">
        <p className="text-sm font-medium uppercase tracking-wide text-destructive">Access denied</p>
        <h1 className="mt-1 text-2xl font-semibold">You do not have permission</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Your account is signed in, but this action requires a permission that is not assigned.
        </p>
        <Button asChild className="mt-5">
          <Link href="/admin/products">Back to admin</Link>
        </Button>
      </section>
    </main>
  );
}

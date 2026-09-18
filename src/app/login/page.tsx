import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Lock, ShieldCheck, User } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/server/auth/session";

import { login } from "./actions";
import { LoginClientGuard } from "./login-guard";

type LoginPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const currentUser = await getCurrentUser();
  if (currentUser) {
    redirect("/admin");
  }

  const params = await searchParams;

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-12 text-foreground sm:px-6">
      <LoginClientGuard />
      {/* Subtle brand ambient accents */}
      <div
        className="pointer-events-none absolute -top-40 left-1/2 -z-10 size-[600px] -translate-x-1/2 rounded-full bg-primary/5 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-40 right-1/4 -z-10 size-[500px] rounded-full bg-gold/5 blur-3xl"
        aria-hidden="true"
      />

      <div className="w-full max-w-md">
        {/* Return to home link */}
        <div className="mb-6 flex justify-start">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-primary"
          >
            <ArrowLeft className="size-3.5" />
            Back to Home
          </Link>
        </div>

        {/* Login Card */}
        <section className="overflow-hidden rounded-xl border border-border border-t-4 border-t-gold bg-card p-6 shadow-md sm:p-8">
          {/* Brand header */}
          <div className="mb-6 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <span className="size-2 rounded-full bg-gold" />
              Mesud Machinery Enterprise
            </div>
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Sign in to Operations
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Access your point-of-sale, ledger, and multi-shop workspace
            </p>
          </div>

          {params.error ? (
            <div className="mb-5">
              <Alert kind="error">{params.error}</Alert>
            </div>
          ) : null}

          <form action={login} className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Username
              </label>
              <div className="relative mt-1.5">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
                  <User className="size-4" />
                </div>
                <input
                  id="username"
                  name="username"
                  required
                  autoComplete="username"
                  placeholder="e.g. admin"
                  className="h-11 w-full rounded-md border border-input bg-background pl-9.5 pr-3 text-sm font-medium text-foreground transition-all placeholder:text-muted-foreground/60 focus:border-ring focus:ring-2 focus:ring-ring/20"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Password
                </label>
              </div>
              <div className="relative mt-1.5">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
                  <Lock className="size-4" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="h-11 w-full rounded-md border border-input bg-background pl-9.5 pr-3 text-sm font-medium text-foreground transition-all placeholder:text-muted-foreground/60 focus:border-ring focus:ring-2 focus:ring-ring/20"
                />
              </div>
            </div>

            <div className="pt-2">
              <Button type="submit" className="h-11 w-full text-base font-semibold shadow-sm">
                Sign in to Dashboard
              </Button>
            </div>
          </form>

          {/* Security footnote */}
          <div className="mt-6 flex items-center justify-center gap-2 border-t border-border pt-4 text-xs text-muted-foreground">
            <ShieldCheck className="size-4 text-primary" />
            <span>Encrypted Session · Role-Based Permissions</span>
          </div>
        </section>

        {/* System copyright */}
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Mesud Machinery © 2026 · Ethiopian Retail & Logistics Gateway
        </p>
      </div>
    </main>
  );
}


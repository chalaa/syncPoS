import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

import { login } from "./actions";

type LoginPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
      <section className="w-full max-w-sm rounded-lg border border-border bg-card p-6">
        <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">syncPoS</p>
        <h1 className="mt-1 text-2xl font-semibold">Sign in</h1>
        {params.error ? <Alert kind="error">{params.error}</Alert> : null}
        <form action={login} className="mt-6 grid gap-4">
          <label className="grid gap-1 text-sm font-medium">
            Username
            <input
              name="username"
              required
              autoComplete="username"
              className="h-10 rounded-md border border-input bg-background px-3 font-normal"
            />
          </label>
          <label className="grid gap-1 text-sm font-medium">
            Password
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="h-10 rounded-md border border-input bg-background px-3 font-normal"
            />
          </label>
          <Button>Sign in</Button>
        </form>
      </section>
    </main>
  );
}

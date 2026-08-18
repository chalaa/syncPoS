# syncPoS Code Standards

## Type Definitions

Keep exported TypeScript types separate from service/query files and UI components.

Preferred module structure:

```text
src/server/<module>/
  <module>.ts
  types.ts
```

Rules:

- Put shared DTOs, form record types, option types, and literal union constants in `types.ts`.
- Keep database queries, formatting helpers, and business logic in service files.
- Keep React component props in the component only when they are private to that component.
- Move props to `types.ts` when they are shared by pages, forms, actions, or tests.

## Reusable Components

Common UI should live in `src/components/ui`.

Current reusable components:

- `Button`
- `ButtonLink`
- `Alert`
- `PageShell`
- `PageHeader`

Rules:

- Prefer shadcn-style primitives and variants before writing custom markup.
- Use semantic Tailwind tokens such as `bg-background`, `bg-card`, `text-muted-foreground`, `border-border`, and `bg-primary`.
- Use reusable UI for repeated layout, alerts, buttons, and page headers.
- Keep domain-specific forms inside the route/module.
- Do not create abstractions before there are repeated patterns.
- Use `gap-*` for spacing and `cn()` from `src/lib/utils.ts` for conditional classes.

## Global State

Use Zustand for client-only global state in `src/stores`.

Current store:

- `src/stores/app-store.ts`

Rules:

- Keep request/user data on the server and pass it through props.
- Use global state for UI preferences, selected offline context, and sync indicators.
- Do not store permissions, sessions, or trusted authorization state in client global state.
- Persist only harmless preferences such as nav visibility and selected local context.

## Admin Navigation

Use an Odoo-style shell for admin workflows.

Rules:

- Main modules live in the left sidebar.
- Context submenus for the active module live in the top bar near the account actions.
- Keep navigation item types in `src/components/app/types.ts`.
- Keep navigation definitions in `src/components/app/admin-navigation.ts`.
- Keep page bodies focused on the selected workflow instead of repeating global navigation.

## Authentication

Admin pages require an active session.

Current implementation:

- login route: `/login`
- session table: `auth_sessions`
- session cookie: `syncpos_session`
- password verification: Node `scrypt`
- logout action clears and revokes the session

Temporary development login:

```text
admin / admin123
```

## Authorization

Use permission checks for protected pages and mutations.

Rules:

- Page access should call `requirePermission(...)`.
- Server actions that mutate data should call `requirePermission(...)`.
- Role permissions come from `roles`, `permissions`, `role_permissions`, and `user_roles`.
- Location permissions will be added to transaction workflows that touch stock, sales, transfers, and reports.

Examples:

```ts
await requirePermission("product.view");
await requirePermission("product.manage");
await requirePermission("partner.view");
await requirePermission("partner.manage");
```

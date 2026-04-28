# Agent Instructions

## Project Overview

Timer is an internal time tracking and invoicing platform for `timer.marques.llc`.
It is a Next.js App Router application written in TypeScript with Firebase Auth,
Firestore, Firebase Admin SDK route handlers, and a dark-first UI.

## Common Commands

- Install dependencies: `npm install`
- Start local development: `npm run dev`
- Build production output: `npm run build`
- Run lint: `npm run lint`
- Run type checking: `npm run typecheck`

Use `npm run lint` and `npm run typecheck` before handing off changes that touch
TypeScript, React, API routes, or shared library code. Use `npm run build` when
changes affect Next.js routing, server/runtime behavior, Firebase imports, or
deployment configuration.

## Repository Layout

- `src/app`: Next.js App Router pages, layouts, and route handlers.
- `src/app/api`: Server route handlers for authenticated and privileged writes.
- `src/components`: Client UI components grouped by feature.
- `src/lib`: Shared business logic, Firebase helpers, validation, billing, dates,
  and permissions.
- `src/types`: Shared TypeScript domain types.
- `firestore.rules` and `firestore.indexes.json`: Firestore security rules and
  indexes.

## Coding Conventions

- Use TypeScript with strict types. Avoid `any` unless there is no cleaner local
  type available.
- Prefer the `@/` import alias for code under `src`.
- Keep route handlers small enough to read, and move reusable business logic into
  `src/lib`.
- Validate request bodies with Zod schemas from `src/lib/validation/schemas.ts`.
- Return errors from route handlers through `jsonError` where possible.
- Use integer cents for money and integer seconds for durations.
- Keep date keys in `YYYY-MM-DD` format.
- Prefer server timestamps (`FieldValue.serverTimestamp()`) for persisted
  create/update metadata.

## Firebase And Security Notes

- Client writes to business collections are intentionally denied by Firestore
  Rules. Sensitive writes should go through Admin SDK route handlers in
  `src/app/api`.
- Route handlers that use Firebase Admin must export `runtime = "nodejs"`.
- Users sign in with usernames. Timer maps usernames to internal Firebase Auth
  emails with `NEXT_PUBLIC_TIMER_USERNAME_EMAIL_DOMAIN`; keep access bootstrap
  lists in `TIMER_ALLOWED_USERNAMES` and `TIMER_BOOTSTRAP_ADMIN_USERNAMES`.
- Use `getAuthenticatedUser` for authenticated user actions and `requireRole` for
  admin-only actions.
- Keep role checks aligned with helpers in `src/lib/permissions/roles.ts`.
- When mutating invoices, time entries, counters, or calendar summaries, use
  Firestore transactions so related documents stay consistent.
- Write audit logs for invoice actions, time entry edits, and project/task rate
  changes when introducing new sensitive mutations.

## Billing And Time Rules

- A user may have only one running timer. Preserve the transaction-based guard on
  `users/{uid}.runningTimeEntryId`.
- Running entries cannot be invoiced.
- Invoiced entries should not be edited through normal time entry flows.
- Invoice line items must snapshot historical task title, project name, duration,
  rate, and amount data.
- Voiding an invoice should release linked entries back to completed/uninvoiced
  status while retaining the void invoice snapshot.
- Recalculate invoice totals server-side; do not trust client-supplied totals.
- Keep calendar day summaries in sync when entries move between uninvoiced,
  invoiced, paid, or void buckets.

## UI Conventions

- The app uses a dark, restrained operational style with shared CSS variables in
  `src/app/globals.css`.
- Reuse existing UI primitives in `src/components/ui` before adding new ones.
- Use `lucide-react` icons for button icons and compact tool actions.
- Keep text and controls responsive; avoid layouts that overflow at mobile widths.
- Do not introduce a marketing landing page for app work. The first screen should
  remain the usable product experience.

## Environment

Local development expects Firebase browser config and Firebase Admin credentials
in `.env.local`; start from `.env.example`. Do not commit real credentials,
service account JSON, tokens, or generated secret material.

## Git Hygiene

- This repository may already contain user changes. Do not revert unrelated work.
- Keep edits scoped to the requested change.
- Avoid committing generated folders such as `.next` and `node_modules`.
- Update this file when project conventions or required verification steps change.

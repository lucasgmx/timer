# Timer

Timer is an internal, dark-first time tracking and invoicing platform for `timer.marques.llc`. It is a single-repo Next.js App Router app using TypeScript, Firebase Auth, Firestore, Firebase Admin SDK, and server route handlers for sensitive billing operations.

## Features

- Firebase username/password authentication backed by Firebase Auth.
- Role-based access for `admin` and `user`.
- One running timer per user, enforced by a Firestore transaction on the user record.
- Manual time entry creation and editing for completed, uninvoiced entries.
- Projects, tasks, active/archive state, and integer-cent hourly rates.
- Date-range reporting with duration, rate, amount, and invoice status.
- Admin-only invoice generation from completed uninvoiced entries.
- Immutable invoice line item snapshots for task title, project name, duration, rate, and amount.
- Invoice status changes: `draft`, `sent`, `paid`, `void`.
- Calendar summaries for efficient range highlighting.
- Audit logs for invoice actions, time entry edits, and project/task rate changes.

## Local Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:6001`.

## Environment Variables

Public Firebase browser config:

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_TIMER_USERNAME_EMAIL_DOMAIN=timer.local
```

Server Firebase Admin config:

```bash
FIREBASE_ADMIN_CREDENTIALS_BASE64=
FIREBASE_SERVICE_ACCOUNT_JSON=
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
```

On Google Cloud Run, prefer Application Default Credentials by giving the service account Firestore access. For local development, use `FIREBASE_ADMIN_CREDENTIALS_BASE64` or `FIREBASE_SERVICE_ACCOUNT_JSON`.

Username access bootstrap:

```bash
TIMER_ALLOWED_USERNAMES=lucas
TIMER_BOOTSTRAP_ADMIN_USERNAMES=lucas
TIMER_DEFAULT_CLIENT_NAME=Marques LLC
TIMER_TIME_ZONE=America/New_York
```

The login form accepts usernames, not email addresses. Internally, Firebase Auth still needs an email-shaped identifier, so Timer maps `lucas` to an internal auth email such as `lucas@timer.local`; users do not enter that email in the UI.

When an allowlisted user signs in, `/api/auth/session` creates the `users/{uid}` record if it does not exist. Usernames listed in `TIMER_BOOTSTRAP_ADMIN_USERNAMES` become admins.

Create or update a username account with Firebase Admin credentials loaded from `.env.local`:

```bash
TIMER_CREATE_USER_PASSWORD='replace-with-a-strong-password' npm run user:create -- --username lucas --admin
```

Use `--reset-password` with the same command to rotate the password for an existing username.

## Firestore

Deploy rules and indexes:

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

Collections used:

- `users`
- `projects`
- `tasks`
- `timeEntries`
- `invoices`
- `invoiceCounters`
- `calendarDaySummaries`
- `auditLogs`

Client writes to business collections are denied by Firestore Rules. Sensitive writes run through Firebase Admin SDK route handlers under `src/app/api`.

## Billing Rules

- Money is stored as integer cents.
- Time duration is stored as seconds.
- Invoice totals are recalculated server-side.
- Invoice line items snapshot historical task, project, duration, rate, and amount data.
- Running entries cannot be invoiced.
- Invoiced entries cannot be edited through normal time entry flows.
- Voiding an invoice releases linked entries back to completed/uninvoiced status while retaining a `void` invoice status snapshot.

## Cloud Run

The project is configured with `output: "standalone"` and includes a Dockerfile:

```bash
docker build -t timer .
docker run -p 8080:8080 --env-file .env.local timer
```

Deploy the container to Cloud Run and point `timer.marques.llc` at the service. Set all required environment variables in Cloud Run and grant the runtime service account access to Firebase Auth and Firestore.

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run typecheck
npm run lint
```

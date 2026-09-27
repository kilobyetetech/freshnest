# FreshNest Laundry — Phase 1

This is the foundation build: Firebase Auth (email/password + Google
Sign-In), custom-claims roles, `users`/`customerProfiles`/`riders`/`addresses`
collections, full default-deny Security Rules (covering the entire future
schema, not just Phase 1's four collections), Storage rules, the
`provisionStaffUser` Cloud Function with compensating rollback, and a
Next.js app shell with all six role-guarded portals plus profile/address
CRUD.

**Billing/Cloud Functions note (temporary):** the finalized architecture
specifies `provisionStaffUser` and the customer sign-up logic as Firebase
Cloud Functions. Cloud Functions require the Blaze (pay-as-you-go) plan,
which needs a card on the account — not available yet. As a documented,
temporary substitution, the exact same Admin-SDK logic instead runs as
Next.js API routes (`src/app/api/complete-signup`,
`src/app/api/provision-staff-user`), deployed on Vercel rather than
Firebase. The security properties are unchanged: server-side only, never
client-trusted, same compensating-rollback and audit-log behavior — see
`src/lib/firebase/admin.ts` for the full note. **Firestore rules deploy
and work exactly as designed on the free Spark plan — no billing needed
for Firestore or Auth, only for Storage and Cloud Functions.** Storage is
skipped entirely for now since no Phase 1 feature actually uploads a
file yet. When a card becomes available, `functions/src/*.ts` already
has the equivalent Cloud Functions ready to swap back in.

**Auth method note:** the architecture document specifies email/password
and phone/OTP as the two supported methods, designed so the app doesn't
need restructuring regardless of which methods are actually enabled. For
ease of testing from a phone, this build ships with email/password and
**Google Sign-In** instead of phone/OTP. Nothing about the roles/claims
architecture changes because of this — the `onCustomerSignUp` trigger
fires identically for any new Auth account regardless of provider, so
adding phone/OTP back later (or alongside this) is a UI-only change, not
an architecture change. Enable **Google** as a sign-in provider in
Firebase Console → Authentication → Sign-in method (in addition to or
instead of Phone).

See `REPO_INSPECTION_REPORT.md` for the pre-implementation inspection
(clean project, nothing pre-existing).

## What's NOT here (by design)

Orders, payments, pricing, pickup/delivery jobs, rider assignment, wallet,
refunds, inventory, finance reports, promotions, and AI are all
intentionally absent — see `freshnest-phase1-implementation-prompt.md`'s
"Explicitly Out of Scope" section. Nothing in this codebase should be
mistaken for those features; where a portal would eventually link to one,
there's a plain placeholder message instead of fake data.

## Getting this running (since a lot of this was built without a live
project or network access in the environment that generated it)

You'll need a computer with Node.js at some point for `npm install` and
the Firebase CLI — that part genuinely can't happen from a phone. But you
can do the next few steps from your phone if you're just getting things
set up:

1. **Create a Firebase project** (or use an existing one) at
   console.firebase.google.com. Enable: Authentication (Email/Password
   and **Google** providers), Firestore, Storage, and Cloud Functions
   (this requires the Blaze plan — Functions don't run on the free Spark
   plan). For Google Sign-In, the Console will ask for a support email —
   any address you control is fine for development.
2. **Grab your Web app config** from Project Settings → your web app (or
   create one) and copy the values into `.env.local` (copy from
   `.env.local.example`).
3. When you're at a computer:
   ```
   npm install
   npm install -g firebase-tools
   firebase login
   firebase use --add            # select your project
   cd functions && npm install && cd ..
   ```
4. **Run the tests before deploying anything:**
   ```
   # Functions unit tests (mocked, no emulator needed)
   cd functions && npm test && cd ..

   # Security Rules tests (needs the emulator suite, bundled with firebase-tools)
   npm run test:rules
   ```
5. **Local dev against the emulators:**
   ```
   firebase emulators:start
   # in another terminal, with NEXT_PUBLIC_USE_EMULATORS=true in .env.local
   npm run dev
   ```
6. **Deploy rules/functions when ready:**
   ```
   firebase deploy --only firestore:rules
   ```
   (Storage and Functions are skipped for now — see the billing note
   above. Once Blaze is available, `firebase deploy --only
   storage:rules,functions` picks those back up.)

## Setting up the Admin SDK credentials (for the API routes)

1. Firebase Console → ⚙ Project Settings → **Service Accounts** tab →
   **Generate new private key**. This downloads a JSON file — treat it
   like a password, never commit it to git.
2. Open that JSON file and copy three values into Vercel's Environment
   Variables (Vercel dashboard → your project → Settings → Environment
   Variables), matching the names in `.env.local.example`:
   - `project_id` → `FIREBASE_ADMIN_PROJECT_ID`
   - `client_email` → `FIREBASE_ADMIN_CLIENT_EMAIL`
   - `private_key` → `FIREBASE_ADMIN_PRIVATE_KEY` (paste the whole
     multi-line value, including `-----BEGIN PRIVATE KEY-----` and
     `-----END PRIVATE KEY-----`; Vercel's textarea handles the newlines
     correctly, this code converts literal `\n` back to real newlines
     either way)
3. Redeploy on Vercel (or it'll pick these up on the next deploy
   automatically) after adding them.
4. For local dev, add the same three lines to your own `.env.local`.

## Creating the first Admin account

Nothing in the app can create an Admin through the UI (by design —
`provision-staff-user` requires an existing Admin caller, and there
isn't one yet on a fresh project). To bootstrap the very first Admin,
from Cloud Shell (or anywhere Node + your service account JSON is
available) — this bootstrap step is the one deliberate exception to
"only provision-staff-user sets roles," since no Admin exists yet to
call it:
1. Register a normal account through `/register` (it will get the
   `customer` role via `/api/complete-signup`).
2. In the Firebase Console → Authentication, note that user's UID.
3. In Cloud Shell:
   ```
   cd ~/freshnest
   node -e "
   const admin = require('firebase-admin');
   admin.initializeApp({ credential: admin.credential.applicationDefault() });
   (async () => {
     const uid = 'PASTE_UID_HERE';
     await admin.auth().setCustomUserClaims(uid, { role: 'admin' });
     await admin.firestore().collection('users').doc(uid).set(
       { role: 'admin', status: 'active' }, { merge: true }
     );
     console.log('Done.');
   })();
   "
   ```
   (Cloud Shell is already authenticated as you via `firebase login`,
   so `applicationDefault()` picks that up automatically — no service
   account JSON needed for this one-off script specifically.)
4. That user must sign out and back in (or you call `refreshClaims()` in
   the app) to pick up the new claim — same rule as everywhere else in
   this app: an already-issued token does not update itself.

## Phase 2 — Core Laundry (added)

Services & pricing, orders with immutable pricing snapshots, payment
verification, pickup jobs, and rider auto-assignment are now live, per
`freshnest-phase2-implementation-prompt.md`.

**Infrastructure note (carried forward from Phase 1):** rider
auto-assignment and the payment-confirmation chain are implemented as
synchronous Vercel API routes (`/api/verify-payment`,
`/api/reassign-pickup-job`) rather than Firestore-triggered Cloud
Functions, since Cloud Functions still require Blaze. Functionally
equivalent outcome, different mechanism — see comments in
`src/app/api/verify-payment/route.ts` for the detail.

**Known gap:** payment receipts are text transaction references only —
no image upload yet, since Storage also needs Blaze. This is
intentional and documented, not a bug. When Storage becomes available,
`submitPayment`/the order-detail page can be extended to accept a
receipt image without changing anything else in the payment-confirmation
chain.

**New collections:** `services`, `serviceAreas`, `orders` (+
`statusHistory` subcollection), `payments`, `paymentAccounts`,
`pickupJobs`. All have real Firestore rules now (previously covered by
the Phase 1 default-deny catch-all) — see `firestore.rules`.

**To actually place an order end-to-end:** an Admin must first (in this
order) create at least one Service (`/admin/services`), one Service Area
(`/admin/service-areas`), one Payment Account (`/admin/payment-accounts`),
and assign at least one active Rider to that service area
(`/admin/riders`) — otherwise a customer's address has no service area
to attach to and order creation will correctly refuse with a clear error
rather than silently succeeding with bad data.

## Test coverage summary

- `functions/test/provisionStaffUser.test.ts` — permission checks,
  duplicate-email rejection, success path, and both rollback branches
  (Auth cleanup succeeds / Auth cleanup itself fails).
- `test/rules/firestore.rules.test.ts` — ownership isolation for all four
  Phase 1 collections, the required privilege-escalation test (a
  `customer`-claim user cannot write `role` on their own `users` doc or
  smuggle one into `customerProfiles`), `defaultAddressId` cross-customer
  rejection, and a default-deny check against a Phase-2 collection
  (`orders`) for every role including Admin.
- `test/rules/storage.rules.test.ts` — receipts path ownership, and
  deny-all verification on the five paths deferred to later phases.

None of these have been executed in the environment that generated this
code (no network/npm access there) — run them yourself per the steps
above before treating Phase 1 as verified.

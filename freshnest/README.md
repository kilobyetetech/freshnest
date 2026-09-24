# FreshNest Laundry — Phase 1

This is the foundation build: Firebase Auth (email/password + Google
Sign-In), custom-claims roles, `users`/`customerProfiles`/`riders`/`addresses`
collections, full default-deny Security Rules (covering the entire future
schema, not just Phase 1's four collections), Storage rules, the
`provisionStaffUser` Cloud Function with compensating rollback, and a
Next.js app shell with all six role-guarded portals plus profile/address
CRUD.

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
   firebase deploy --only firestore:rules,storage:rules,functions
   ```

## Creating the first Admin account

Nothing in the app can create an Admin through the UI (by design —
`provisionStaffUser` requires an existing Admin caller, and there isn't
one yet on a fresh project). To bootstrap the very first Admin:
1. Register a normal account through `/register` (it will get the
   `customer` role via the sign-up trigger).
2. In the Firebase Console → Authentication, note that user's UID.
3. Run this once, from a trusted machine with the Admin SDK
   (`firebase functions:shell` or a one-off script), to set the claim and
   `users` doc directly — this bootstrap step is the one deliberate
   exception to "only provisionStaffUser sets roles," since no Admin
   exists yet to call it:
   ```js
   await admin.auth().setCustomUserClaims(uid, { role: "admin" });
   await admin.firestore().collection("users").doc(uid).set(
     { role: "admin", status: "active" }, { merge: true }
   );
   ```
4. That user must sign out and back in (or you call `refreshClaims()` in
   the app) to pick up the new claim — same rule as everywhere else in
   this app: an already-issued token does not update itself.

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

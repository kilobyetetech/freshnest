/**
 * Firestore Security Rules unit tests.
 * Requires the Firebase emulator suite. Run with:
 *   npm run test:rules
 * (this wraps `firebase emulators:exec --only firestore,storage 'jest test/rules'`)
 */
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { readFileSync } from "fs";
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from "firebase/firestore";

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "freshnest-rules-test",
    firestore: {
      rules: readFileSync("firestore.rules", "utf8"),
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

afterEach(async () => {
  await testEnv.clearFirestore();
});

// Seed helper: writes directly with admin privileges, bypassing rules,
// to set up preconditions for a test.
async function seed(fn: (adminDb: any) => Promise<void>) {
  const adminCtx = testEnv.withSecurityRulesDisabled();
  const adminDb = adminCtx.firestore();
  await fn(adminDb);
  await adminCtx.cleanup();
}

describe("users/{uid}", () => {
  it("denies all access to an unauthenticated client", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, "users/alice")));
  });

  it("allows a user to read their own user doc", async () => {
    await seed((adminDb) =>
      setDoc(doc(adminDb, "users/alice"), { role: "customer", displayName: "Alice" })
    );
    const db = testEnv.authenticatedContext("alice", { role: "customer" }).firestore();
    await assertSucceeds(getDoc(doc(db, "users/alice")));
  });

  it("denies a user reading another user's doc", async () => {
    await seed((adminDb) => setDoc(doc(adminDb, "users/bob"), { role: "customer" }));
    const db = testEnv.authenticatedContext("alice", { role: "customer" }).firestore();
    await assertFails(getDoc(doc(db, "users/bob")));
  });

  it("allows Admin to read any user doc", async () => {
    await seed((adminDb) => setDoc(doc(adminDb, "users/bob"), { role: "customer" }));
    const db = testEnv.authenticatedContext("admin1", { role: "admin" }).firestore();
    await assertSucceeds(getDoc(doc(db, "users/bob")));
  });

  it("allows a user to update their own displayName/phone", async () => {
    await seed((adminDb) =>
      setDoc(doc(adminDb, "users/alice"), {
        role: "customer",
        displayName: "Alice",
        phone: "111",
      })
    );
    const db = testEnv.authenticatedContext("alice", { role: "customer" }).firestore();
    await assertSucceeds(updateDoc(doc(db, "users/alice"), { displayName: "Alice Updated" }));
  });

  // ---- REQUIRED SECURITY INVARIANT ----
  it("PRIVILEGE ESCALATION: denies a customer promoting themself to admin via users/{uid}.role", async () => {
    await seed((adminDb) =>
      setDoc(doc(adminDb, "users/mallory"), { role: "customer", displayName: "Mallory" })
    );
    const db = testEnv.authenticatedContext("mallory", { role: "customer" }).firestore();
    await assertFails(updateDoc(doc(db, "users/mallory"), { role: "admin" }));
    await assertFails(updateDoc(doc(db, "users/mallory"), { role: "finance" }));
    await assertFails(updateDoc(doc(db, "users/mallory"), { role: "staff" }));
    await assertFails(updateDoc(doc(db, "users/mallory"), { role: "rider" }));
  });

  it("PRIVILEGE ESCALATION: denies a customer creating their own users doc with an elevated role", async () => {
    const db = testEnv.authenticatedContext("mallory2", { role: "customer" }).firestore();
    await assertFails(setDoc(doc(db, "users/mallory2"), { role: "admin", displayName: "Mallory" }));
  });

  it("denies any client-side delete of a users doc, including by Admin", async () => {
    await seed((adminDb) => setDoc(doc(adminDb, "users/bob"), { role: "customer" }));
    const db = testEnv.authenticatedContext("admin1", { role: "admin" }).firestore();
    await assertFails(deleteDoc(doc(db, "users/bob")));
  });
});

describe("customerProfiles/{uid}", () => {
  it("PRIVILEGE ESCALATION: denies smuggling a role field into a customerProfiles update", async () => {
    await seed((adminDb) =>
      setDoc(doc(adminDb, "customerProfiles/mallory"), { name: "Mallory", defaultAddressId: null })
    );
    const db = testEnv.authenticatedContext("mallory", { role: "customer" }).firestore();
    await assertFails(updateDoc(doc(db, "customerProfiles/mallory"), { role: "admin" } as any));
  });

  it("denies setting defaultAddressId to an address owned by a different customer", async () => {
    await seed(async (adminDb) => {
      await setDoc(doc(adminDb, "customerProfiles/alice"), { name: "Alice", defaultAddressId: null });
      await setDoc(doc(adminDb, "addresses/addr-bob-1"), { customerId: "bob", label: "Bob's house" });
    });
    const db = testEnv.authenticatedContext("alice", { role: "customer" }).firestore();
    await assertFails(
      updateDoc(doc(db, "customerProfiles/alice"), { defaultAddressId: "addr-bob-1" })
    );
  });

  it("allows setting defaultAddressId to the customer's own address", async () => {
    await seed(async (adminDb) => {
      await setDoc(doc(adminDb, "customerProfiles/alice"), { name: "Alice", defaultAddressId: null });
      await setDoc(doc(adminDb, "addresses/addr-alice-1"), { customerId: "alice", label: "Home" });
    });
    const db = testEnv.authenticatedContext("alice", { role: "customer" }).firestore();
    await assertSucceeds(
      updateDoc(doc(db, "customerProfiles/alice"), { defaultAddressId: "addr-alice-1" })
    );
  });

  it("allows Finance to read a customerProfiles doc", async () => {
    await seed((adminDb) => setDoc(doc(adminDb, "customerProfiles/alice"), { name: "Alice" }));
    const db = testEnv.authenticatedContext("fin1", { role: "finance" }).firestore();
    await assertSucceeds(getDoc(doc(db, "customerProfiles/alice")));
  });
});

describe("addresses/{addressId}", () => {
  it("allows a customer to create their own address", async () => {
    const db = testEnv.authenticatedContext("alice", { role: "customer" }).firestore();
    await assertSucceeds(
      setDoc(doc(db, "addresses/addr1"), { customerId: "alice", label: "Home" })
    );
  });

  it("denies creating an address with someone else's customerId", async () => {
    const db = testEnv.authenticatedContext("alice", { role: "customer" }).firestore();
    await assertFails(setDoc(doc(db, "addresses/addr2"), { customerId: "bob", label: "Fake" }));
  });

  it("denies a customer reading another customer's address", async () => {
    await seed((adminDb) => setDoc(doc(adminDb, "addresses/addr-bob"), { customerId: "bob" }));
    const db = testEnv.authenticatedContext("alice", { role: "customer" }).firestore();
    await assertFails(getDoc(doc(db, "addresses/addr-bob")));
  });

  it("denies changing the customerId (ownership transfer) on update", async () => {
    await seed((adminDb) =>
      setDoc(doc(adminDb, "addresses/addr1"), { customerId: "alice", label: "Home" })
    );
    const db = testEnv.authenticatedContext("alice", { role: "customer" }).firestore();
    await assertFails(updateDoc(doc(db, "addresses/addr1"), { customerId: "bob" }));
  });

  it("allows the owner to delete their own address", async () => {
    await seed((adminDb) =>
      setDoc(doc(adminDb, "addresses/addr1"), { customerId: "alice", label: "Home" })
    );
    const db = testEnv.authenticatedContext("alice", { role: "customer" }).firestore();
    await assertSucceeds(deleteDoc(doc(db, "addresses/addr1")));
  });
});

describe("riders/{riderId}", () => {
  it("allows a rider to toggle their own `active` field only", async () => {
    await seed((adminDb) =>
      setDoc(doc(adminDb, "riders/rider1"), { name: "R1", active: false, currentWorkload: 0 })
    );
    const db = testEnv.authenticatedContext("rider1", { role: "rider" }).firestore();
    await assertSucceeds(updateDoc(doc(db, "riders/rider1"), { active: true }));
  });

  it("denies a rider changing currentWorkload directly", async () => {
    await seed((adminDb) =>
      setDoc(doc(adminDb, "riders/rider1"), { name: "R1", active: false, currentWorkload: 0 })
    );
    const db = testEnv.authenticatedContext("rider1", { role: "rider" }).firestore();
    await assertFails(updateDoc(doc(db, "riders/rider1"), { currentWorkload: 99 }));
  });

  it("denies one rider from reading another rider's profile", async () => {
    await seed((adminDb) => setDoc(doc(adminDb, "riders/rider2"), { name: "R2" }));
    const db = testEnv.authenticatedContext("rider1", { role: "rider" }).firestore();
    await assertFails(getDoc(doc(db, "riders/rider2")));
  });
});

describe("default-deny catch-all (future-phase collections)", () => {
  it("denies everyone, including Admin, on collections with no Phase 1 rule block yet", async () => {
    const adminClientDb = testEnv.authenticatedContext("admin1", { role: "admin" }).firestore();
    await assertFails(getDoc(doc(adminClientDb, "orders/order1")));
    await assertFails(setDoc(doc(adminClientDb, "orders/order1"), { total: 1000 }));

    const financeDb = testEnv.authenticatedContext("fin1", { role: "finance" }).firestore();
    await assertFails(getDoc(doc(financeDb, "wallets/alice")));

    const customerDb = testEnv.authenticatedContext("alice", { role: "customer" }).firestore();
    await assertFails(getDoc(doc(customerDb, "auditLogs/log1")));
  });
});

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
  await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
    await fn(adminCtx.firestore());
  });
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
    await assertFails(getDoc(doc(adminClientDb, "wallets/alice")));

    const financeDb = testEnv.authenticatedContext("fin1", { role: "finance" }).firestore();
    await assertFails(getDoc(doc(financeDb, "refundRequests/req1")));

    const customerDb = testEnv.authenticatedContext("alice", { role: "customer" }).firestore();
    await assertFails(getDoc(doc(customerDb, "auditLogs/log1")));
  });
});

describe("Phase 2 — services & serviceAreas", () => {
  it("allows public read of an active service, denies an inactive one to non-admins", async () => {
    await seed((adminDb) => setDoc(doc(adminDb, "services/svc1"), { name: "Wash", active: true }));
    const anon = testEnv.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(anon, "services/svc1")));

    await seed((adminDb) => setDoc(doc(adminDb, "services/svc2"), { name: "Old", active: false }));
    await assertFails(getDoc(doc(anon, "services/svc2")));
  });

  it("denies a customer writing to services", async () => {
    const db = testEnv.authenticatedContext("alice", { role: "customer" }).firestore();
    await assertFails(setDoc(doc(db, "services/svc3"), { name: "Hack", active: true }));
  });

  it("allows public read of serviceAreas", async () => {
    await seed((adminDb) => setDoc(doc(adminDb, "serviceAreas/area1"), { name: "Lekki", active: true }));
    const anon = testEnv.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(anon, "serviceAreas/area1")));
  });
});

describe("Phase 2 — orders (PRIVILEGE ESCALATION focus)", () => {
  it("denies a customer creating their own order document directly", async () => {
    const db = testEnv.authenticatedContext("alice", { role: "customer" }).firestore();
    await assertFails(
      setDoc(doc(db, "orders/order1"), {
        customerId: "alice",
        orderStatus: "Pending",
        paymentStatus: "Unpaid",
        pricingSnapshot: { total: 1 },
      })
    );
  });

  it("PRIVILEGE ESCALATION: denies a customer overwriting their own order's pricingSnapshot or paymentStatus", async () => {
    await seed((adminDb) =>
      setDoc(doc(adminDb, "orders/order1"), {
        customerId: "alice",
        orderStatus: "Pending",
        paymentStatus: "Unpaid",
        pricingSnapshot: { total: 5000 },
      })
    );
    const db = testEnv.authenticatedContext("alice", { role: "customer" }).firestore();
    await assertFails(updateDoc(doc(db, "orders/order1"), { "pricingSnapshot.total": 1 }));
    await assertFails(updateDoc(doc(db, "orders/order1"), { paymentStatus: "Confirmed" }));
    await assertFails(updateDoc(doc(db, "orders/order1"), { orderStatus: "Completed" }));
  });

  it("allows the owning customer to read their own order, denies another customer", async () => {
    await seed((adminDb) =>
      setDoc(doc(adminDb, "orders/order1"), { customerId: "alice", orderStatus: "Pending" })
    );
    const aliceDb = testEnv.authenticatedContext("alice", { role: "customer" }).firestore();
    await assertSucceeds(getDoc(doc(aliceDb, "orders/order1")));

    const bobDb = testEnv.authenticatedContext("bob", { role: "customer" }).firestore();
    await assertFails(getDoc(doc(bobDb, "orders/order1")));
  });

  it("denies a rider reading an order document directly (riders use pickupJobs instead)", async () => {
    await seed((adminDb) =>
      setDoc(doc(adminDb, "orders/order1"), { customerId: "alice", orderStatus: "Pending" })
    );
    const riderDb = testEnv.authenticatedContext("rider1", { role: "rider" }).firestore();
    await assertFails(getDoc(doc(riderDb, "orders/order1")));
  });
});

describe("Phase 2 — payments (financial isolation)", () => {
  it("RIDER FINANCIAL ISOLATION: denies a rider reading a payment document", async () => {
    await seed((adminDb) =>
      setDoc(doc(adminDb, "payments/pay1"), { customerId: "alice", amountExpected: 5000 })
    );
    const riderDb = testEnv.authenticatedContext("rider1", { role: "rider" }).firestore();
    await assertFails(getDoc(doc(riderDb, "payments/pay1")));
  });

  it("denies a customer creating a payment document directly (must go through submit-payment route)", async () => {
    const db = testEnv.authenticatedContext("alice", { role: "customer" }).firestore();
    await assertFails(setDoc(doc(db, "payments/pay1"), { customerId: "alice", status: "confirmed" }));
  });

  it("allows Finance to read any payment", async () => {
    await seed((adminDb) => setDoc(doc(adminDb, "payments/pay1"), { customerId: "alice" }));
    const finDb = testEnv.authenticatedContext("fin1", { role: "finance" }).firestore();
    await assertSucceeds(getDoc(doc(finDb, "payments/pay1")));
  });
});

describe("Phase 2 — pickupJobs (rider isolation and allowed self-updates)", () => {
  it("RIDER FINANCIAL ISOLATION: pickupJobs documents carry no financial fields, and a rider cannot smuggle one in via update", async () => {
    await seed((adminDb) =>
      setDoc(doc(adminDb, "pickupJobs/job1"), {
        riderId: "rider1",
        jobStatus: "Assigned",
        customerName: "Alice",
      })
    );
    const riderDb = testEnv.authenticatedContext("rider1", { role: "rider" }).firestore();
    await assertFails(updateDoc(doc(riderDb, "pickupJobs/job1"), { amountExpected: 5000 } as any));
  });

  it("allows the assigned rider to update jobStatus and its timestamp field", async () => {
    await seed((adminDb) =>
      setDoc(doc(adminDb, "pickupJobs/job1"), { riderId: "rider1", jobStatus: "Assigned" })
    );
    const riderDb = testEnv.authenticatedContext("rider1", { role: "rider" }).firestore();
    await assertSucceeds(
      updateDoc(doc(riderDb, "pickupJobs/job1"), { jobStatus: "Accepted", acceptedAt: new Date() })
    );
  });

  it("denies a different rider from updating a job not assigned to them", async () => {
    await seed((adminDb) =>
      setDoc(doc(adminDb, "pickupJobs/job1"), { riderId: "rider1", jobStatus: "Assigned" })
    );
    const otherRiderDb = testEnv.authenticatedContext("rider2", { role: "rider" }).firestore();
    await assertFails(updateDoc(doc(otherRiderDb, "pickupJobs/job1"), { jobStatus: "Accepted" }));
  });

  it("denies a customer reading a pickupJob even if it's for their own order", async () => {
    await seed((adminDb) =>
      setDoc(doc(adminDb, "pickupJobs/job1"), { riderId: "rider1", orderId: "order1" })
    );
    const customerDb = testEnv.authenticatedContext("alice", { role: "customer" }).firestore();
    await assertFails(getDoc(doc(customerDb, "pickupJobs/job1")));
  });
});

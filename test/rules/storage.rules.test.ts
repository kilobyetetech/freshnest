/**
 * Storage Security Rules unit tests. Run with the emulator suite via
 * `npm run test:rules` (fired alongside the Firestore rules tests).
 */
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { readFileSync } from "fs";
import { ref, uploadBytes, getBytes } from "firebase/storage";

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "freshnest-rules-test",
    storage: {
      rules: readFileSync("storage.rules", "utf8"),
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

const bytes = new Uint8Array([1, 2, 3]);

describe("receipts/{customerId}/{orderId}/{fileName}", () => {
  it("allows a customer to upload their own receipt", async () => {
    const storage = testEnv.authenticatedContext("alice", { role: "customer" }).storage();
    await assertSucceeds(
      uploadBytes(ref(storage, "receipts/alice/order1/receipt.jpg"), bytes)
    );
  });

  it("denies a customer uploading a receipt under a different customerId", async () => {
    const storage = testEnv.authenticatedContext("alice", { role: "customer" }).storage();
    await assertFails(uploadBytes(ref(storage, "receipts/bob/order1/receipt.jpg"), bytes));
  });

  it("denies an unauthenticated upload", async () => {
    const storage = testEnv.unauthenticatedContext().storage();
    await assertFails(uploadBytes(ref(storage, "receipts/alice/order1/receipt.jpg"), bytes));
  });

  it("allows Finance to read a customer's receipt", async () => {
    const ownerStorage = testEnv.authenticatedContext("alice", { role: "customer" }).storage();
    await uploadBytes(ref(ownerStorage, "receipts/alice/order1/receipt.jpg"), bytes);

    const financeStorage = testEnv.authenticatedContext("fin1", { role: "finance" }).storage();
    await assertSucceeds(getBytes(ref(financeStorage, "receipts/alice/order1/receipt.jpg")));
  });

  it("denies a rider reading a customer's receipt", async () => {
    const ownerStorage = testEnv.authenticatedContext("alice", { role: "customer" }).storage();
    await uploadBytes(ref(ownerStorage, "receipts/alice/order1/receipt.jpg"), bytes);

    const riderStorage = testEnv.authenticatedContext("rider1", { role: "rider" }).storage();
    await assertFails(getBytes(ref(riderStorage, "receipts/alice/order1/receipt.jpg")));
  });
});

describe("deferred paths (proofOfDelivery, signatures, incidentPhotos, expenseReceipts, refundEvidence)", () => {
  it("denies all access on paths not yet implemented, even for Admin", async () => {
    const adminStorage = testEnv.authenticatedContext("admin1", { role: "admin" }).storage();
    await assertFails(
      uploadBytes(ref(adminStorage, "proofOfDelivery/order1/photo.jpg"), bytes)
    );
    await assertFails(uploadBytes(ref(adminStorage, "signatures/order1/sig.png"), bytes));
    await assertFails(
      uploadBytes(ref(adminStorage, "incidentPhotos/incident1/photo.jpg"), bytes)
    );
    await assertFails(
      uploadBytes(ref(adminStorage, "expenseReceipts/expense1/receipt.jpg"), bytes)
    );
    await assertFails(
      uploadBytes(ref(adminStorage, "refundEvidence/refund1/evidence.jpg"), bytes)
    );
  });
});

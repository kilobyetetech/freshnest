/**
 * Unit tests for provisionStaffUser, run against mocked firebase-admin
 * (no live project / emulator required for these). Run with:
 *   cd functions && npm install && npm test
 */

const mockCreateUser = jest.fn();
const mockGetUserByEmail = jest.fn();
const mockSetCustomUserClaims = jest.fn();
const mockDeleteUser = jest.fn();
const mockBatchSet = jest.fn();
const mockBatchCommit = jest.fn();
const mockAdd = jest.fn();

jest.mock("firebase-admin/auth", () => ({
  getAuth: () => ({
    createUser: mockCreateUser,
    getUserByEmail: mockGetUserByEmail,
    setCustomUserClaims: mockSetCustomUserClaims,
    deleteUser: mockDeleteUser,
  }),
}));

jest.mock("firebase-admin/firestore", () => ({
  getFirestore: () => ({
    batch: () => ({ set: mockBatchSet, commit: mockBatchCommit }),
    collection: () => ({ doc: () => ({}), add: mockAdd }),
  }),
  FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP" },
}));

import { provisionStaffUser } from "../src/provisionStaffUser";

// The v2 onCall wrapper exposes the underlying handler at .run in some
// versions; to keep this test independent of that internal detail, we
// invoke provisionStaffUser as a callable-shaped function directly, which
// firebase-functions-test would normally wrap. Here we call the exported
// handler's request-processing logic through its public callable
// interface by casting, which mirrors how firebase-functions-test's
// `wrap()` helper is used in a full integration test.
const callHandler = provisionStaffUser as unknown as (req: any) => Promise<any>;

const adminRequest = (data: any) => ({
  auth: { uid: "admin-uid-1", token: { role: "admin" } },
  data,
});

const customerRequest = (data: any) => ({
  auth: { uid: "customer-uid-1", token: { role: "customer" } },
  data,
});

describe("provisionStaffUser", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUserByEmail.mockRejectedValue({ code: "auth/user-not-found" });
    mockCreateUser.mockResolvedValue({ uid: "new-staff-uid" });
    mockSetCustomUserClaims.mockResolvedValue(undefined);
    mockBatchCommit.mockResolvedValue(undefined);
    mockAdd.mockResolvedValue(undefined);
  });

  it("rejects a caller without the admin claim", async () => {
    await expect(
      callHandler(
        customerRequest({
          email: "new@freshnest.test",
          displayName: "New Staff",
          role: "staff",
        })
      )
    ).rejects.toThrow(/Only an Admin/);
    expect(mockCreateUser).not.toHaveBeenCalled();
  });

  it("rejects an unauthenticated caller", async () => {
    await expect(
      callHandler({
        auth: null,
        data: { email: "x@freshnest.test", displayName: "X", role: "staff" },
      })
    ).rejects.toThrow(/Only an Admin/);
  });

  it("rejects when the email already exists", async () => {
    mockGetUserByEmail.mockResolvedValueOnce({ uid: "existing-uid" });
    await expect(
      callHandler(
        adminRequest({
          email: "dup@freshnest.test",
          displayName: "Dup",
          role: "staff",
        })
      )
    ).rejects.toThrow(/already exists/);
    expect(mockCreateUser).not.toHaveBeenCalled();
  });

  it("creates the Auth user, sets the claim, and writes Firestore docs on success", async () => {
    const result = await callHandler(
      adminRequest({
        email: "rider1@freshnest.test",
        displayName: "Rider One",
        role: "rider",
      })
    );

    expect(mockCreateUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: "rider1@freshnest.test" })
    );
    expect(mockSetCustomUserClaims).toHaveBeenCalledWith("new-staff-uid", { role: "rider" });
    // Two docs written for a rider: users + riders.
    expect(mockBatchSet).toHaveBeenCalledTimes(2);
    expect(mockBatchCommit).toHaveBeenCalledTimes(1);
    expect(mockDeleteUser).not.toHaveBeenCalled();
    expect(result).toEqual({ uid: "new-staff-uid", role: "rider" });
  });

  it("rolls back the Auth user if the Firestore write fails, and does not report success", async () => {
    mockBatchCommit.mockRejectedValueOnce(new Error("firestore write failed"));
    mockDeleteUser.mockResolvedValueOnce(undefined);

    await expect(
      callHandler(
        adminRequest({
          email: "finance1@freshnest.test",
          displayName: "Finance One",
          role: "finance",
        })
      )
    ).rejects.toThrow(/rolled back/);

    expect(mockDeleteUser).toHaveBeenCalledWith("new-staff-uid");
    // An audit entry must exist for the rollback outcome.
    expect(mockAdd).toHaveBeenCalledWith(
      expect.objectContaining({ action: "provisionStaffUser.rolledBack" })
    );
  });

  it("surfaces a distinct error, not a false success, if rollback itself fails", async () => {
    mockBatchCommit.mockRejectedValueOnce(new Error("firestore write failed"));
    mockDeleteUser.mockRejectedValueOnce(new Error("auth delete failed"));

    await expect(
      callHandler(
        adminRequest({
          email: "staff2@freshnest.test",
          displayName: "Staff Two",
          role: "staff",
        })
      )
    ).rejects.toThrow(/rollback ALSO failed/);

    expect(mockAdd).toHaveBeenCalledWith(
      expect.objectContaining({ action: "provisionStaffUser.rollbackFailed" })
    );
  });
});

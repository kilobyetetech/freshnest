import { initializeApp } from "firebase-admin/app";

initializeApp();

// Phase 1 exports only. Do not add order/payment/refund/wallet/etc.
// functions here until their respective phases are implemented and
// reviewed — see freshnest-phase1-implementation-prompt.md.
export { provisionStaffUser } from "./provisionStaffUser";
export { onCustomerSignUp } from "./onCustomerSignUp";

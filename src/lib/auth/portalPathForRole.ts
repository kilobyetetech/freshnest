import type { Role } from "@/types/models";

/**
 * Single source of truth for "which portal does this role land on".
 * Used right after sign-in/sign-up so people don't have to know or type
 * the right URL themselves.
 */
export function portalPathForRole(role: Role | null | undefined): string {
  switch (role) {
    case "admin":
      return "/admin";
    case "finance":
      return "/finance";
    case "staff":
      return "/staff";
    case "rider":
      return "/rider";
    case "customer":
      return "/customer";
    default:
      // No role claim yet (shouldn't normally happen post-login, but
      // fail safe to the public home page rather than a broken route).
      return "/";
  }
}

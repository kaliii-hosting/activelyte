// Unit tests for the pure authorization policy (lib/authz.ts).
// Run with Vitest: `npm run test` (add: npm i -D vitest, "test": "vitest run").
// These functions are the single source of truth for role management and are
// also exercised end-to-end by the members-management integration tests.

import { describe, it, expect } from "vitest";
import { assignableRoles, canManageUser, canAssignRole } from "@/lib/authz";
import { hasAtLeast } from "@/lib/types/roles";

describe("hasAtLeast", () => {
  it("respects the hierarchy", () => {
    expect(hasAtLeast("founder", "admin")).toBe(true);
    expect(hasAtLeast("admin", "admin")).toBe(true);
    expect(hasAtLeast("bartender", "admin")).toBe(false);
    expect(hasAtLeast(undefined, "client")).toBe(false);
  });
});

describe("assignableRoles (no privilege escalation)", () => {
  it("founder can grant everything below founder", () => {
    const r = assignableRoles("founder");
    expect(r).toContain("super_admin");
    expect(r).toContain("bartender");
    expect(r).not.toContain("founder");
  });
  it("admin can only grant below admin", () => {
    const r = assignableRoles("admin");
    expect(r).toEqual(expect.arrayContaining(["shop_owner", "bartender", "client"]));
    expect(r).not.toContain("admin");
    expect(r).not.toContain("super_admin");
  });
  it("non-admin roles can grant nothing", () => {
    expect(assignableRoles("bartender")).toEqual([]);
    expect(assignableRoles("client")).toEqual([]);
    expect(assignableRoles(undefined)).toEqual([]);
  });
});

describe("canManageUser", () => {
  it("only allows acting on strictly-lower ranks", () => {
    expect(canManageUser("admin", "bartender")).toBe(true);
    expect(canManageUser("admin", "admin")).toBe(false); // peers
    expect(canManageUser("admin", "founder")).toBe(false); // superiors
    expect(canManageUser("bartender", "client")).toBe(false); // not admin-tier
  });
});

describe("canAssignRole", () => {
  it("blocks escalation and out-of-range grants", () => {
    expect(canAssignRole("founder", "bartender", "admin")).toBe(true);
    expect(canAssignRole("admin", "bartender", "super_admin")).toBe(false);
    expect(canAssignRole("admin", "admin", "bartender")).toBe(false); // can't touch peer
    expect(canAssignRole("super_admin", "bartender", "admin")).toBe(true);
  });
});

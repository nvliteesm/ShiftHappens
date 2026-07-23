/**
 * Tests for department-scope helpers (pure functions).
 *
 * Company admins are unrestricted (null scope). Every other role is scoped to
 * the departments they belong to. A resource is in scope only when its
 * department is one the member belongs to; unscoped (null) means "all".
 */
import { describe, it, expect } from "vitest";
import {
  departmentScopeFor,
  isDepartmentInScope,
} from "@/lib/department-scope";

describe("departmentScopeFor", () => {
  it("returns null (unrestricted) for a company admin", () => {
    expect(
      departmentScopeFor({
        role: "company_admin",
        departmentMemberships: [{ department: { id: "d1" } }],
      })
    ).toBeNull();
  });

  it("returns the department ids for a manager", () => {
    expect(
      departmentScopeFor({
        role: "manager",
        departmentMemberships: [
          { department: { id: "kitchen" } },
          { department: { id: "bar" } },
        ],
      })
    ).toEqual(["kitchen", "bar"]);
  });

  it("returns an empty array for a manager with no departments", () => {
    expect(departmentScopeFor({ role: "manager" })).toEqual([]);
  });

  it("scopes staff to their departments too", () => {
    expect(
      departmentScopeFor({
        role: "staff",
        departmentMemberships: [{ department: { id: "kitchen" } }],
      })
    ).toEqual(["kitchen"]);
  });
});

describe("isDepartmentInScope", () => {
  it("allows anything when scope is null (admin)", () => {
    expect(isDepartmentInScope("kitchen", null)).toBe(true);
    expect(isDepartmentInScope(null, null)).toBe(true);
  });

  it("allows a department that is in scope", () => {
    expect(isDepartmentInScope("kitchen", ["kitchen", "bar"])).toBe(true);
  });

  it("blocks a department that is not in scope", () => {
    expect(isDepartmentInScope("bar", ["kitchen"])).toBe(false);
  });

  it("blocks a task with no department for a scoped member", () => {
    expect(isDepartmentInScope(null, ["kitchen"])).toBe(false);
    expect(isDepartmentInScope(undefined, ["kitchen"])).toBe(false);
  });

  it("blocks everything for a member with an empty scope", () => {
    expect(isDepartmentInScope("kitchen", [])).toBe(false);
  });
});

import { describe, it, expect } from "vitest";
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  createOrganizationSchema,
  updateProfileSchema,
} from "@/lib/validations";

describe("registerSchema", () => {
  it("accepts valid registration data", () => {
    const result = registerSchema.safeParse({
      name: "John Doe",
      email: "john@example.com",
      password: "SecurePass1!",
      confirmPassword: "SecurePass1!",
    });
    expect(result.success).toBe(true);
  });

  it("rejects mismatched passwords", () => {
    const result = registerSchema.safeParse({
      name: "John Doe",
      email: "john@example.com",
      password: "SecurePass1!",
      confirmPassword: "DifferentPass1!",
    });
    expect(result.success).toBe(false);
  });

  it("rejects weak passwords", () => {
    const result = registerSchema.safeParse({
      name: "John Doe",
      email: "john@example.com",
      password: "weak",
      confirmPassword: "weak",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email", () => {
    const result = registerSchema.safeParse({
      name: "John Doe",
      email: "not-an-email",
      password: "SecurePass1!",
      confirmPassword: "SecurePass1!",
    });
    expect(result.success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("accepts valid login data", () => {
    const result = loginSchema.safeParse({
      email: "john@example.com",
      password: "SecurePass1!",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty password", () => {
    const result = loginSchema.safeParse({
      email: "john@example.com",
      password: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("forgotPasswordSchema", () => {
  it("accepts valid email", () => {
    const result = forgotPasswordSchema.safeParse({
      email: "john@example.com",
    });
    expect(result.success).toBe(true);
  });
});

describe("resetPasswordSchema", () => {
  it("accepts valid reset data", () => {
    const result = resetPasswordSchema.safeParse({
      token: "valid-token",
      password: "NewSecure1!",
      confirmPassword: "NewSecure1!",
    });
    expect(result.success).toBe(true);
  });

  it("rejects mismatched passwords", () => {
    const result = resetPasswordSchema.safeParse({
      token: "valid-token",
      password: "NewSecure1!",
      confirmPassword: "Different1!",
    });
    expect(result.success).toBe(false);
  });
});

describe("createOrganizationSchema", () => {
  it("accepts valid organization data", () => {
    const result = createOrganizationSchema.safeParse({
      name: "Acme Corp",
      industry: "Technology",
      description: "A tech company",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = createOrganizationSchema.safeParse({
      name: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("updateProfileSchema", () => {
  it("accepts valid profile update", () => {
    const result = updateProfileSchema.safeParse({
      name: "Jane Doe",
    });
    expect(result.success).toBe(true);
  });

  it("accepts password change with matching passwords", () => {
    const result = updateProfileSchema.safeParse({
      name: "Jane Doe",
      currentPassword: "OldPass1!",
      newPassword: "NewPass1!",
      confirmNewPassword: "NewPass1!",
    });
    expect(result.success).toBe(true);
  });

  it("rejects password change without current password", () => {
    const result = updateProfileSchema.safeParse({
      name: "Jane Doe",
      newPassword: "NewPass1!",
      confirmNewPassword: "NewPass1!",
    });
    expect(result.success).toBe(false);
  });
});
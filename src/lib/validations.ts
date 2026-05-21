import { z } from "zod";

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character");

export const registerSchema = z
  .object({
    name: z.string().min(1, "Name is required").max(100),
    email: z.string().email("Invalid email address"),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, "Token is required"),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const createOrganizationSchema = z.object({
  name: z.string().min(1, "Organization name is required").max(100),
  industry: z.string().max(100).optional(),
  description: z.string().max(500).optional(),
});

export const updateProfileSchema = z
  .object({
    name: z.string().min(1, "Name is required").max(100).optional(),
    currentPassword: z.string().optional(),
    newPassword: passwordSchema.optional(),
    confirmNewPassword: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.newPassword && !data.currentPassword) return false;
      return true;
    },
    {
      message: "Current password is required to set a new password",
      path: ["currentPassword"],
    }
  )
  .refine(
    (data) => {
      if (data.newPassword && data.newPassword !== data.confirmNewPassword)
        return false;
      return true;
    },
    {
      message: "Passwords do not match",
      path: ["confirmNewPassword"],
    }
  );

export const createDepartmentSchema = z.object({
  name: z.string().min(1, "Department name is required").max(100),
  description: z.string().max(500).optional(),
});

export const updateDepartmentSchema = z.object({
  name: z.string().min(1, "Department name is required").max(100).optional(),
  description: z.string().max(500).optional(),
});

export const inviteUserSchema = z.object({
  email: z.string().email("Invalid email address"),
  role: z.enum(["manager", "staff"]),
  departmentId: z.string().optional(),
});

export const updateUserRoleSchema = z.object({
  role: z.enum(["company_admin", "manager", "staff"]),
  departmentIds: z.array(z.string()).optional(),
});

export const updateOrganizationSchema = z.object({
  name: z.string().min(1, "Organization name is required").max(100).optional(),
  industry: z.string().max(100).optional(),
  description: z.string().max(500).optional(),
  logo: z.string().url("Invalid URL").optional().or(z.literal("")),
  address: z.string().max(500).optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>;
export type UpdateDepartmentInput = z.infer<typeof updateDepartmentSchema>;
export type InviteUserInput = z.infer<typeof inviteUserSchema>;
export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
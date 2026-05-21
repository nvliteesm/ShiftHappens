/**
 * Profile API Endpoint (Boundary Layer)
 * PATCH /api/profile — Update user profile (name and/or password)
 * GET /api/profile — Get current user's profile
 * 
 * Both endpoints require authentication.
 * Password change requires current password verification.
 * 
 * NOTE: This route currently imports UserRepository directly,
 * which violates BCE (Boundary → Entity). This will be refactored
 * to use a ProfileService in a future update.
 * 
 * Returns:
 * - 200: Profile data (GET) or updated profile (PATCH)
 * - 400: Validation failed or incorrect current password
 * - 401: Unauthorized
 * - 500: Internal server error
 */
import { NextRequest, NextResponse } from "next/server";
import { UserRepository } from "@/repositories/user.repository";
import { updateProfileSchema } from "@/lib/validations";
import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/auth-guard";
import bcrypt from "bcryptjs";

// TODO: Replace with ProfileService to fix BCE violation
const userRepo = new UserRepository();

export async function PATCH(request: NextRequest) {
  try {
    const sessionUser = await getAuthenticatedUser();
    if (!sessionUser) return unauthorizedResponse();

    const body = await request.json();
    const parsed = updateProfileSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const updateData: { name?: string; hashedPassword?: string } = {};

    if (parsed.data.name) {
      updateData.name = parsed.data.name;
    }

    // Password change requires verifying current password first
    if (parsed.data.newPassword && parsed.data.currentPassword) {
      const user = await userRepo.findById(sessionUser.id);
      if (!user) return unauthorizedResponse();

      const isValid = await bcrypt.compare(
        parsed.data.currentPassword,
        user.hashedPassword
      );
      if (!isValid) {
        return NextResponse.json(
          { error: "Current password is incorrect" },
          { status: 400 }
        );
      }

      updateData.hashedPassword = await bcrypt.hash(parsed.data.newPassword, 12);
    }

    const updated = await userRepo.updateProfile(sessionUser.id, updateData);

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      email: updated.email,
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const sessionUser = await getAuthenticatedUser();
    if (!sessionUser) return unauthorizedResponse();

    const user = await userRepo.findById(sessionUser.id);
    if (!user) return unauthorizedResponse();

    // Return safe user data — never expose hashedPassword
    return NextResponse.json({
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      image: user.image,
      createdAt: user.createdAt,
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
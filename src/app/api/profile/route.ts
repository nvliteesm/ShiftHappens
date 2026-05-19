import { NextRequest, NextResponse } from "next/server";
import { UserRepository } from "@/repositories/user.repository";
import { updateProfileSchema } from "@/lib/validations";
import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/auth-guard";
import bcrypt from "bcryptjs";

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
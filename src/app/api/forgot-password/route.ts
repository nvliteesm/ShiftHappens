import { NextRequest, NextResponse } from "next/server";
import { AuthService } from "@/services/auth.service";
import { forgotPasswordSchema } from "@/lib/validations";

const authService = new AuthService();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = forgotPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    await authService.requestPasswordReset(parsed.data.email);

    return NextResponse.json({
      message: "If an account exists with this email, a password reset link has been sent.",
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
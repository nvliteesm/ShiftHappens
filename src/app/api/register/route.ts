import { NextRequest, NextResponse } from "next/server";
import { AuthService } from "@/services/auth.service";
import { registerSchema } from "@/lib/validations";

const authService = new AuthService();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { user } = await authService.register(parsed.data);

    return NextResponse.json(
      { message: "Registration successful. Please check your email to verify your account.", userId: user.id },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === "Email already registered") {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
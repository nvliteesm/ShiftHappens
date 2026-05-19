import { NextRequest, NextResponse } from "next/server";
import { AuthService } from "@/services/auth.service";

const authService = new AuthService();

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();

    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    await authService.verifyEmail(token);

    return NextResponse.json({ message: "Email verified successfully" });
  } catch (error) {
    if (error instanceof Error && error.message === "Invalid or expired token") {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
/**
 * API Utility Functions (Boundary Layer)
 * 
 * Shared helpers for API route handlers including
 * consistent error logging and response formatting.
 */
import { NextResponse } from "next/server";

/**
 * Logs and returns a 500 error response.
 * Ensures all API errors are visible in server logs.
 */
export function handleApiError(error: unknown, context: string) {
  console.error(`[API Error] ${context}:`, error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
/**
 * Mark All Read API Endpoint (Boundary Layer)
 * POST /api/notifications/mark-all-read
 *
 * Marks all unread notifications as read for the authenticated user.
 */
import { NextResponse } from "next/server";
import { NotificationService } from "@/services/notification.service";
import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/auth-guard";

const notificationService = new NotificationService();

export async function POST() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return unauthorizedResponse();

    await notificationService.markAllAsRead(user.id);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
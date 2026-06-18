/**
 * Unread Count API Endpoint (Boundary Layer)
 * GET /api/notifications/unread-count
 *
 * Lightweight endpoint returning just the unread count.
 * Polled every 30 seconds by the sidebar bell icon.
 */
import { NextResponse } from "next/server";
import { NotificationService } from "@/services/notification.service";
import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/auth-guard";

const notificationService = new NotificationService();

export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return unauthorizedResponse();

    const count = await notificationService.getUnreadCount(user.id);
    return NextResponse.json({ count });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
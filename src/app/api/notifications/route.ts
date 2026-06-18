/**
 * Notifications List API Endpoint (Boundary Layer)
 * GET /api/notifications — List authenticated user's notifications
 *
 * Query params: limit (default 20), offset (default 0)
 * Returns newest first with unread count.
 */
import { NextRequest, NextResponse } from "next/server";
import { NotificationService } from "@/services/notification.service";
import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/auth-guard";

const notificationService = new NotificationService();

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return unauthorizedResponse();

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);
    const offset = parseInt(searchParams.get("offset") || "0");

    const [notifications, unreadCount] = await Promise.all([
      notificationService.getNotifications(user.id, limit, offset),
      notificationService.getUnreadCount(user.id),
    ]);

    return NextResponse.json({ notifications, unreadCount });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
/**
 * Mark Notification Read API Endpoint (Boundary Layer)
 * PATCH /api/notifications/[id]/read
 *
 * Marks a single notification as read.
 * Verifies the notification belongs to the authenticated user.
 */
import { NextRequest, NextResponse } from "next/server";
import { NotificationService } from "@/services/notification.service";
import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/auth-guard";

const notificationService = new NotificationService();

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return unauthorizedResponse();

    const { id } = await params;
    await notificationService.markAsRead(id, user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";

    if (message === "Notification not found") {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    if (message === "Not authorized") {
      return NextResponse.json({ error: message }, { status: 403 });
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
/**
 * Platform Template Detail API (Boundary Layer)
 * GET    /api/platform/templates/[templateId] — Get single template
 * PATCH  /api/platform/templates/[templateId] — Update template
 * DELETE /api/platform/templates/[templateId] — Toggle active status (soft delete)
 *
 * Platform admin only.
 */
import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/auth-guard";
import { IndustryTemplateService } from "@/services/industry-template.service";
import { prisma } from "@/lib/prisma";

const templateService = new IndustryTemplateService();

async function verifyPlatformAdmin(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isPlatformAdmin: true },
  });
  return user?.isPlatformAdmin === true;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ templateId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return unauthorizedResponse();

    if (!(await verifyPlatformAdmin(user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { templateId } = await params;
    const template = await templateService.getTemplateById(templateId);
    return NextResponse.json(template);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Internal server error";

    if (message === "Template not found") {
      return NextResponse.json({ error: message }, { status: 404 });
    }

    console.error("[GET /api/platform/templates/[templateId]]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ templateId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return unauthorizedResponse();

    if (!(await verifyPlatformAdmin(user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { templateId } = await params;
    const body = await req.json();

    const updated = await templateService.updateTemplate(templateId, {
      name: body.name,
      icon: body.icon,
      description: body.description,
      departments: body.departments,
      workRules: body.workRules,
      certifications: body.certifications,
      isActive: body.isActive,
    });

    return NextResponse.json(updated);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Internal server error";

    if (message === "Template not found") {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    if (
      message.includes("already exists") ||
      message.includes("is required") ||
      message.includes("Maximum") ||
      message.includes("Invalid")
    ) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    console.error("[PATCH /api/platform/templates/[templateId]]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ templateId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return unauthorizedResponse();

    if (!(await verifyPlatformAdmin(user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { templateId } = await params;
    const toggled = await templateService.toggleStatus(templateId);

    return NextResponse.json(toggled);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Internal server error";

    if (message === "Template not found") {
      return NextResponse.json({ error: message }, { status: 404 });
    }

    console.error("[DELETE /api/platform/templates/[templateId]]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
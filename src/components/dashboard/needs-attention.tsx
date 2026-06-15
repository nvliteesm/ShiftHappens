/**
 * Needs Attention Component (Boundary Layer)
 *
 * Shared alert list used by both Admin and Manager dashboards.
 * Renders color-coded items (danger/warning/info) with action buttons.
 * Each item links to the relevant page for resolution.
 */
"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export interface NeedsAttentionItem {
  type: string;
  severity: "danger" | "warning" | "info";
  message: string;
  actionLabel: string;
  actionUrl: string;
  entityId?: string;
  isAiInsight?: boolean;
}

const severityStyles: Record<string, string> = {
  danger: "bg-red-50 text-red-800",
  warning: "bg-amber-50 text-amber-800",
  info: "bg-blue-50 text-blue-800",
};

const buttonVariants: Record<string, string> = {
  danger: "border-red-200 text-red-700 hover:bg-red-100",
  warning: "border-amber-200 text-amber-700 hover:bg-amber-100",
  info: "border-blue-200 text-blue-700 hover:bg-blue-100",
};

export function NeedsAttention({ items }: { items: NeedsAttentionItem[] }) {
  if (items.length === 0) return null;

  return (
    <div className="mb-6">
      <h3 className="mb-2 text-sm font-medium text-muted-foreground">
        Needs attention
      </h3>
      <div className="space-y-1.5">
        {items.map((item, i) => (
          <div
            key={`${item.type}-${item.entityId ?? i}`}
            className={`flex items-center justify-between rounded-lg px-4 py-3 text-sm ${severityStyles[item.severity]}`}
          >
            <span className="mr-4 leading-snug">
              {item.isAiInsight && (
                <span className="mr-1.5 inline-flex items-center rounded bg-white/60 px-1.5 py-0.5 text-xs font-medium">
                  ✦ AI Insight
                </span>
              )}
              {item.message}
            </span>
            <Link href={item.actionUrl}>
              <Button
                variant="outline"
                size="sm"
                className={`shrink-0 ${buttonVariants[item.severity]}`}
              >
                {item.actionLabel}
              </Button>
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}

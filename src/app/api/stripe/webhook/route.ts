/**
 * Stripe Webhook Endpoint (Boundary Layer)
 * POST /api/stripe/webhook — Receive and process Stripe events
 *
 * This route is intentionally unauthenticated (Stripe calls it server-to-server)
 * but every request is verified against STRIPE_WEBHOOK_SECRET using the raw
 * request body and the `stripe-signature` header. Unverified payloads are
 * rejected with 400 so forged requests can't change any org's tier.
 *
 * The raw body is read with `request.text()` — signature verification requires
 * the exact bytes Stripe sent, so the body must NOT be parsed as JSON first.
 */
import { NextRequest, NextResponse } from "next/server";
import { BillingService } from "@/services/billing.service";

export const runtime = "nodejs";

const billingService = new BillingService();

export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event;
  try {
    const rawBody = await request.text();
    event = await billingService.constructEvent(rawBody, signature);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid payload";
    console.error("[Stripe Webhook] signature verification failed:", message);
    return NextResponse.json({ error: `Webhook error: ${message}` }, { status: 400 });
  }

  try {
    await billingService.handleEvent(event);
  } catch (error) {
    // Return 500 so Stripe retries later; the event was authentic.
    console.error(`[Stripe Webhook] failed to handle ${event.type}:`, error);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

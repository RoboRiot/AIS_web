import { NextResponse } from "next/server";
import { isTrustedOrigin, readJsonBody } from "@/app/data/requestSecurity";
import { normalizeFormType, normalizeLeadId } from "@/app/data/leadAnalytics.mjs";
import { createFormSession, MIN_FORM_AGE_MS } from "@/app/data/formTiming.mjs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request) {
  if (!isTrustedOrigin(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  try {
    const payload = await readJsonBody(request, 1_024);
    const formType = normalizeFormType(payload.formType);
    const leadId = normalizeLeadId(payload.leadId);
    if (!formType || !leadId) return NextResponse.json({ error: "Invalid form session." }, { status: 400 });
    const formSession = createFormSession({ formType, leadId, secret: process.env.RECAPTCHA_SECRET_KEY });
    return NextResponse.json({ ok: true, formSession, waitMs: MIN_FORM_AGE_MS + 100 }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json({ error: "Could not refresh the form. Please try again." }, { status: error.statusCode || 503 });
  }
}

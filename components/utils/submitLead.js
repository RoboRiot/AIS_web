import { shouldTrackLeadConversion } from "@/app/data/leadAnalytics.mjs";
import {
  createLeadId,
  getLeadAnalyticsContext,
  trackWebsiteEvent,
} from "@/components/utils/analytics";

export const submitLead = async ({
  token,
  action,
  formType,
  name,
  email,
  partNumber,
  message,
  startedAt,
  website = "",
  context = "",
  leadId = "",
}) => {
  const resolvedLeadId = leadId || createLeadId();
  const response = await fetch("/api/lead", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      token,
      action,
      formType,
      name,
      email,
      partNumber,
      startedAt,
      website,
      sourcePage: typeof window === "undefined" ? "/" : window.location.pathname,
      context,
      message,
      analytics: getLeadAnalyticsContext(resolvedLeadId),
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || "Submission failed. Please try again.");
    error.status = response.status;
    throw error;
  }

  if (shouldTrackLeadConversion(data)) {
    trackWebsiteEvent(
      "form_submit",
      {
        form_type: formType,
        context,
        lead_id: resolvedLeadId,
      },
      { recordInternally: false }
    );
  }

  return data;
};

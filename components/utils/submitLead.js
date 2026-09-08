import { shouldTrackLeadConversion } from "@/app/data/leadAnalytics.mjs";
import { postLeadWithRetry } from "@/app/data/leadSubmission.mjs";
import { executeRecaptcha } from "./recaptcha";
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
  const data = await postLeadWithRetry({
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
    }, {
      refreshToken: () => executeRecaptcha(process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY, action),
  });

  if (shouldTrackLeadConversion(data)) {
    trackWebsiteEvent(
      "form_submit",
      {
        form_type: formType,
        form_source: context,
        lead_category: formType.replace(/_request$|_form$/g, ""),
        lead_id: data.analyticsLeadId || resolvedLeadId,
      },
      { recordInternally: false }
    );
  }

  return data;
};

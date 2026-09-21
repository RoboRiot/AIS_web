import { redactAnalyticsText } from "./analyticsPrivacy.mjs";
import { getBusinessFormType } from "./leadIntent.mjs";

export function buildChannelReport(events, qualifications = {}) {
  const groups = new Map();
  for (const event of events) {
    const utm = event.utm || {};
    const properties = event.properties || {};
    const channel = event.acquisitionSource || properties.acquisition_source || "unknown";
    const referrer = properties.referrer_host || event.referrerHost || "";
    const externalReferrer = /(^|\.)advancedimagingparts\.com$/i.test(referrer) ? "" : referrer;
    const dimension = {
      channel,
      source: utm.source || properties.utm_source || (channel === "direct" ? "direct" : externalReferrer) || "unattributed",
      medium: utm.medium || properties.utm_medium || "untagged",
      campaign: utm.campaign || properties.utm_campaign || "untagged",
      placement: utm.content || properties.utm_content || "untagged",
    };
    for (const key of Object.keys(dimension)) dimension[key] = redactAnalyticsText(dimension[key], 120);
    const key = JSON.stringify(dimension);
    if (!groups.has(key)) groups.set(key, { ...dimension, visitors: new Set(), pageViews: 0,
      phoneClicks: 0, emailClicks: 0, accepted: new Set(), qualified: new Set(), unreviewed: new Set(),
      trailerInquiries: 0, otherInquiries: 0, reviewedNotQualified: 0 });
    const row = groups.get(key);
    if (event.eventType === "page_view") {
      row.pageViews++;
      if (event.visitorHash) row.visitors.add(event.visitorHash);
    }
    if (event.eventType === "phone_click") row.phoneClicks++;
    if (event.eventType === "email_click") row.emailClicks++;
    const leadId = properties.lead_id;
    // Only deterministic server-written lead events count, not client-reported form events.
    if (event.eventType !== "form_submit" || !leadId || event.id !== `lead-${leadId}` ||
        !["lead_api", "service_request_api"].includes(properties.confirmed_by) || row.accepted.has(leadId)) continue;
    row.accepted.add(leadId);
    if (getBusinessFormType(event) === "trailer_request") row.trailerInquiries++;
    else row.otherInquiries++;
    const qualification = qualifications[leadId];
    if (["qualified", "quoted", "won"].includes(qualification)) row.qualified.add(leadId);
    else if (["spam", "unqualified", "duplicate", "disqualified"].includes(qualification)) row.reviewedNotQualified++;
    else row.unreviewed.add(leadId);
  }
  return [...groups.values()].map(({ visitors, accepted, qualified, unreviewed, ...row }) => ({
    ...row, trackedVisitors: visitors.size, acceptedInquiries: accepted.size,
    qualifiedLeads: qualified.size, unreviewedInquiries: unreviewed.size,
  })).sort((a, b) => b.qualifiedLeads - a.qualifiedLeads || b.acceptedInquiries - a.acceptedInquiries || b.trackedVisitors - a.trackedVisitors);
}

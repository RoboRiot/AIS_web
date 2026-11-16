"use client";

import { useEffect, useRef, useState } from "react";
import RecaptchaStatus from "@/components/forms/RecaptchaStatus";
import useLocalFormPreview from "@/components/forms/useLocalFormPreview";
import { evaluateBotSignals } from "@/components/utils/antiBot";
import { announceFormOpen, createLeadId, trackWebsiteEvent } from "@/components/utils/analytics";
import { FORM_LIMITS, sanitizeLeadForm, sanitizeServiceCallback } from "@/components/utils/formSecurity";
import { ensureRecaptchaScript, executeRecaptcha } from "@/components/utils/recaptcha";
import { submitLead } from "@/components/utils/submitLead";
import styles from "@/app/services/landingPage.module.scss";
import { BUSINESS_PHONE, BUSINESS_PHONE_HREF } from "@/app/data/businessContact.mjs";

// The focus tracker reads this same attribute. Allocate the ID in the browser
// so a statically rendered page cannot reuse one visitor's ID for the next.
function getFormLeadId(form) {
  if (!form.dataset.leadId) form.dataset.leadId = createLeadId();
  return form.dataset.leadId;
}

export default function QuickInquiryForm({
  formType,
  source,
  title,
  intro,
  detailsLabel,
  detailsPlaceholder,
  submitLabel,
  compact = false,
  callback = false,
}) {
  const localPreview = useLocalFormPreview();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [details, setDetails] = useState("");
  const [website, setWebsite] = useState("");
  const formRef = useRef(null);
  const [startedAt] = useState(() => Date.now());
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [confirmationId, setConfirmationId] = useState("");
  const [feedback, setFeedback] = useState("");
  const recaptchaSiteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
  const nextSteps = formType === "trailer_request"
    ? [
        "We review location, dates, configuration, and current fleet timing.",
        "An imaging specialist follows up to confirm practical options and next steps.",
        "Call now when downtime or deployment timing is urgent.",
      ]
    : [
        "Remote support is the first step for urgent scanner issues.",
        "If remote recovery is not enough, we coordinate field service and parts.",
        "Call now when the scanner is down or patient schedules are at risk.",
      ];

  useEffect(() => {
    ensureRecaptchaScript(recaptchaSiteKey);
    if (formRef.current) announceFormOpen(formType, source, getFormLeadId(formRef.current));
  }, [formType, recaptchaSiteKey, source]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting || submitted || localPreview) return;
    const leadId = getFormLeadId(event.currentTarget);
    const recordError = (stage, reason = "") => {
      trackWebsiteEvent("form_error", {
        form_type: formType,
        error_stage: stage,
        error_reason: reason,
        lead_id: leadId,
      });
    };

    const botSignals = evaluateBotSignals({ honeypotValue: website, startedAt });
    if (botSignals.blocked) {
      setFeedback("Submission blocked. Please refresh the page and try again.");
      recordError("bot_check", botSignals.reason);
      return;
    }
    if (!callback && phone.replace(/\D/g, "").length < 7) {
      setFeedback("Please enter a valid phone number.");
      recordError("validation", "phone");
      return;
    }

    const { sanitized, errors } = callback
      ? sanitizeServiceCallback({ name, callbackPhone: phone, email, message: details })
      : sanitizeLeadForm({ name, email, message: [`Phone: ${phone}`, "", details].join("\n") });
    if (errors.length) {
      setFeedback(errors[0]);
      recordError("validation");
      return;
    }

    setSubmitting(true);
    setFeedback("");
    try {
      const token = await executeRecaptcha(recaptchaSiteKey, formType);
      if (!token) {
        const error = new Error(`The security check could not finish. Please reload and try again, or call ${BUSINESS_PHONE}.`);
        error.code = "recaptcha_token";
        throw error;
      }

      const result = await submitLead({
        ...sanitized,
        ...(callback && { requestMode: "callback" }),
        token,
        action: formType,
        formType,
        startedAt,
        website,
        context: source,
        leadId,
      });
      setConfirmationId(
        String(result.leadId || "").split("-").pop().slice(0, 10).toUpperCase()
      );
      setSubmitted(true);
    } catch (error) {
      recordError(error?.code === "recaptcha_token" ? "recaptcha_token" : "lead_request",
        String(error?.code || error?.status || "request_failed"));
      setFeedback(error?.message || "We could not send your request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const emailField = (
    <label>
      {callback ? "Work email (optional)" : "Work email"}
      <input
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        maxLength={FORM_LIMITS.email}
        autoComplete="email"
        placeholder="you@company.com"
        required={!callback}
      />
    </label>
  );
  const detailsField = (
    <label className={styles.quickInquiryDetails}>
      {callback ? "Scanner or issue (optional)" : detailsLabel}
      <textarea
        value={details}
        onChange={(event) => setDetails(event.target.value)}
        maxLength={1600}
        rows={compact || callback ? 3 : 4}
        placeholder={callback ? "For example, the scanner model or error code" : detailsPlaceholder}
        required={!callback}
      />
    </label>
  );

  return (
    <section id="request" className={`${styles.quickInquirySection} ${compact ? styles.quickInquiryCompact : ""} ${callback ? styles.callbackSection : ""}`} aria-label={title}>
      <div className="container">
        <div className={styles.quickInquiryLayout}>
          <div className={styles.quickInquiryIntro}>
            {!callback && <span>{compact ? "Facility rental inquiries" : "Direct response from our imaging team"}</span>}
            <h2>{title}</h2>
            {intro && <p>{intro}</p>}
            {!callback && <a href={BUSINESS_PHONE_HREF}>Call {BUSINESS_PHONE}</a>}
            {!compact && !callback && <ul className="list-none">
              {nextSteps.map((step) => <li key={step}>{step}</li>)}
            </ul>}
          </div>
          {submitted ? (
            <div className={styles.quickInquirySuccess} role="status">
              <strong>{callback ? "Callback requested" : "Request received"}</strong>
              <p>{callback ? "Our service team will call the number you provided." : "Our team will review the details and follow up as quickly as possible."}</p>
              {confirmationId ? <small>Reference {confirmationId}</small> : null}
              <a
                href={BUSINESS_PHONE_HREF}
                data-analytics="quick-inquiry-phone"
                data-analytics-source={source}
              >
                Need immediate help? Call {BUSINESS_PHONE}
              </a>
            </div>
          ) : (
            <form
              ref={formRef}
              className={styles.quickInquiryForm}
              onSubmit={handleSubmit}
              data-form-type={formType}
              data-form-source={source}
            >
              <div className="bot-field" aria-hidden="true">
                <label htmlFor={`${source}-website`}>Website</label>
                <input
                  id={`${source}-website`}
                  value={website}
                  onChange={(event) => setWebsite(event.target.value)}
                  tabIndex={-1}
                  autoComplete="off"
                />
              </div>
              <label>
                Name
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={FORM_LIMITS.name}
                  autoComplete="name"
                  placeholder="Your name"
                  required
                />
              </label>
              {!callback && emailField}
              <label>
                {callback ? "Callback number" : "Phone"}
                <input
                  type="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  maxLength={callback ? FORM_LIMITS.callbackPhone : 30}
                  autoComplete="tel"
                  placeholder={callback ? "Number with area code" : "Your phone number"}
                  required
                />
              </label>
              {callback ? (
                <details className={styles.callbackDetails}>
                  <summary>Add details (optional)</summary>
                  {emailField}
                  {detailsField}
                </details>
              ) : detailsField}
              {feedback ? <p className={styles.quickInquiryError} role="alert">{feedback}</p> : null}
              <RecaptchaStatus />
              <button
                type="submit"
                className="simple-btn"
                disabled={submitting || localPreview}
                data-analytics="quick-inquiry-submit"
                data-analytics-label={submitLabel}
                data-analytics-source={source}
              >
                {submitting ? "Sending..." : submitLabel}
              </button>
              {!callback && <small>Protected by reCAPTCHA and secure server validation.</small>}
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

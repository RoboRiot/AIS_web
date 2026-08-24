"use client";

import { useEffect, useState } from "react";
import { evaluateBotSignals } from "@/components/utils/antiBot";
import { announceFormOpen, createLeadId, trackWebsiteEvent } from "@/components/utils/analytics";
import { FORM_LIMITS, sanitizeLeadForm } from "@/components/utils/formSecurity";
import { ensureRecaptchaScript, executeRecaptcha } from "@/components/utils/recaptcha";
import { submitLead } from "@/components/utils/submitLead";
import styles from "@/app/services/landingPage.module.scss";

export default function QuickInquiryForm({
  formType,
  source,
  title,
  intro,
  detailsLabel,
  detailsPlaceholder,
  submitLabel,
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [details, setDetails] = useState("");
  const [website, setWebsite] = useState("");
  const [leadId] = useState(createLeadId);
  const [startedAt] = useState(() => Date.now());
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [confirmationId, setConfirmationId] = useState("");
  const [feedback, setFeedback] = useState("");
  const recaptchaSiteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

  useEffect(() => {
    ensureRecaptchaScript(recaptchaSiteKey);
    announceFormOpen(formType, source, leadId);
  }, [formType, leadId, recaptchaSiteKey, source]);

  const recordError = (stage, reason = "") => {
    trackWebsiteEvent("form_error", {
      form_type: formType,
      error_stage: stage,
      error_reason: reason,
      lead_id: leadId,
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting || submitted) return;

    const botSignals = evaluateBotSignals({ honeypotValue: website, startedAt });
    if (botSignals.blocked) {
      setFeedback("Submission blocked. Please refresh the page and try again.");
      recordError("bot_check", botSignals.reason);
      return;
    }
    if (phone.replace(/\D/g, "").length < 7) {
      setFeedback("Please enter a valid phone number.");
      recordError("validation", "phone");
      return;
    }

    const message = [`Phone: ${phone}`, "", details].join("\n");
    const { sanitized, errors } = sanitizeLeadForm({ name, email, message });
    if (errors.length) {
      setFeedback(errors[0]);
      recordError("validation");
      return;
    }

    setSubmitting(true);
    setFeedback("");
    try {
      const token = await executeRecaptcha(recaptchaSiteKey, formType);
      if (!token) throw new Error("reCAPTCHA could not verify this request. Please try again.");

      const result = await submitLead({
        ...sanitized,
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
      recordError("lead_request", String(error?.status || "request_failed"));
      setFeedback(error?.message || "We could not send your request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section id="request" className={styles.quickInquirySection}>
      <div className="container">
        <div className={styles.quickInquiryLayout}>
          <div className={styles.quickInquiryIntro}>
            <span>Direct response from our imaging team</span>
            <h2>{title}</h2>
            <p>{intro}</p>
            <a href="tel:+15595376851">Call (559) 537-6851</a>
            <ul className="list-none">
              <li>Remote support starts immediately for urgent service needs.</li>
              <li>Trailer requests are reviewed for timing, location, and configuration.</li>
              <li>Your information is used only to respond to this request.</li>
            </ul>
          </div>
          {submitted ? (
            <div className={styles.quickInquirySuccess} role="status">
              <strong>Request received</strong>
              <p>Our team will review the details and follow up as quickly as possible.</p>
              {confirmationId ? <small>Reference {confirmationId}</small> : null}
              <a
                href="tel:+15595376851"
                data-analytics="quick-inquiry-phone"
                data-analytics-source={source}
              >
                Need immediate help? Call (559) 537-6851
              </a>
            </div>
          ) : (
            <form
              className={styles.quickInquiryForm}
              onSubmit={handleSubmit}
              data-form-type={formType}
              data-form-source={source}
              data-lead-id={leadId}
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
              <label>
                Work email
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  maxLength={FORM_LIMITS.email}
                  autoComplete="email"
                  placeholder="you@company.com"
                  required
                />
              </label>
              <label>
                Phone
                <input
                  type="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  maxLength={30}
                  autoComplete="tel"
                  placeholder="Your phone number"
                  required
                />
              </label>
              <label className={styles.quickInquiryDetails}>
                {detailsLabel}
                <textarea
                  value={details}
                  onChange={(event) => setDetails(event.target.value)}
                  maxLength={1600}
                  rows={4}
                  placeholder={detailsPlaceholder}
                  required
                />
              </label>
              {feedback ? <p className={styles.quickInquiryError} role="alert">{feedback}</p> : null}
              <button
                type="submit"
                className="simple-btn"
                disabled={submitting}
                data-analytics="quick-inquiry-submit"
                data-analytics-label={submitLabel}
              >
                {submitting ? "Sending..." : submitLabel}
              </button>
              <small>Protected by reCAPTCHA and secure server validation.</small>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

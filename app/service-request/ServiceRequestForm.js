"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { executeRecaptcha, ensureRecaptchaScript } from "@/components/utils/recaptcha";
import { evaluateBotSignals } from "@/components/utils/antiBot";
import { announceFormOpen, trackWebsiteEvent } from "@/components/utils/analytics";
import { COUNTRIES } from "./countries";
import styles from "./serviceRequest.module.scss";

const MANUFACTURERS = [
  "GE Healthcare",
  "Siemens Healthineers",
  "Philips Healthcare",
  "Toshiba",
];

const MODALITIES = [
  "MRI",
  "Computed Tomography CT",
  "Mammography",
  "X-ray",
  "PETCT",
  "Nucmed",
];

const URGENCY_OPTIONS = [
  {
    value: "hard_down",
    label: "Hard down",
    description: "The system is unusable or scanning has stopped.",
  },
  {
    value: "asap",
    label: "ASAP",
    description: "Service is needed as quickly as possible.",
  },
  {
    value: "soon",
    label: "Soon",
    description: "The issue should be scheduled in the near term.",
  },
  {
    value: "anytime",
    label: "Anytime",
    description: "The work can be completed when convenient.",
  },
];

const ACCEPTED_FILE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
  "text/plain",
]);
const MAX_FILES = 5;
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_TOTAL_FILE_BYTES = 25 * 1024 * 1024;

const today = () => new Date().toISOString().slice(0, 10);

const initialForm = () => ({
  companyName: "",
  requestedServiceDate: today(),
  streetAddress: "",
  addressLine2: "",
  city: "",
  region: "",
  postalCode: "",
  country: "United States",
  urgency: "",
  manufacturer: "",
  modality: "",
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  purchaseOrderNumber: "",
  issueTitle: "",
  systemModel: "",
  requestedTiming: "",
  description: "",
});

function Field({ id, label, required, hint, children, className = "" }) {
  return (
    <div className={`${styles.field} ${className}`}>
      <label htmlFor={id}>
        {label}
        {required ? <span aria-hidden="true">*</span> : null}
      </label>
      {hint ? <small>{hint}</small> : null}
      {children}
    </div>
  );
}

export default function ServiceRequestForm() {
  const [form, setForm] = useState(initialForm);
  const [files, setFiles] = useState([]);
  const [honeypot, setHoneypot] = useState("");
  const [formStartedAt, setFormStartedAt] = useState(() => Date.now());
  const [dragActive, setDragActive] = useState(false);
  const [feedback, setFeedback] = useState({ type: "", message: "" });
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef(null);
  const recaptchaSiteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

  useEffect(() => {
    ensureRecaptchaScript(recaptchaSiteKey);
    announceFormOpen("service_request", "service_request_page");
  }, [recaptchaSiteKey]);

  const fileSummary = useMemo(
    () =>
      files.reduce(
        (total, file) => total + Number(file.size || 0),
        0
      ),
    [files]
  );

  const update = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const addFiles = (incoming) => {
    const next = Array.from(incoming || []);
    if (!next.length) return;
    const accepted = [];
    let error = "";
    for (const file of next) {
      if (files.length + accepted.length >= MAX_FILES) {
        error = `You can attach up to ${MAX_FILES} files.`;
        break;
      }
      const type = String(file.type || "").toLowerCase();
      if (!ACCEPTED_FILE_TYPES.has(type)) {
        error = `${file.name} is not a supported image, PDF, or text file.`;
        continue;
      }
      if (file.size > MAX_FILE_BYTES) {
        error = `${file.name} is larger than 8 MB.`;
        continue;
      }
      const selectedBytes = [...files, ...accepted].reduce(
        (sum, selectedFile) => sum + Number(selectedFile.size || 0),
        0
      );
      if (selectedBytes + file.size > MAX_TOTAL_FILE_BYTES) {
        error = "Attachments can total no more than 25 MB.";
        continue;
      }
      const duplicate = [...files, ...accepted].some(
        (existing) =>
          existing.name === file.name &&
          existing.size === file.size &&
          existing.lastModified === file.lastModified
      );
      if (!duplicate) accepted.push(file);
    }
    if (accepted.length) setFiles((current) => [...current, ...accepted]);
    if (error) setFeedback({ type: "error", message: error });
  };

  const removeFile = (index) => {
    setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;

    const botSignals = evaluateBotSignals({
      honeypotValue: honeypot,
      startedAt: formStartedAt,
    });
    if (botSignals.blocked) {
      setFeedback({
        type: "error",
        message: "Submission blocked. Please refresh the page and try again.",
      });
      return;
    }

    if (!form.urgency) {
      setFeedback({ type: "error", message: "Please select the request urgency." });
      return;
    }

    setSubmitting(true);
    setFeedback({ type: "", message: "" });

    try {
      const token = await executeRecaptcha(recaptchaSiteKey, "service_request");
      if (!token) {
        throw new Error("reCAPTCHA could not verify this request. Please try again.");
      }

      const payload = new FormData();
      Object.entries(form).forEach(([key, value]) => payload.append(key, value));
      payload.append("token", token);
      payload.append("action", "service_request");
      payload.append("startedAt", String(formStartedAt));
      payload.append("website", honeypot);
      files.forEach((file) => payload.append("files", file, file.name));

      const response = await fetch("/api/service-requests", {
        method: "POST",
        body: payload,
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || "We could not submit your request.");
      }

      trackWebsiteEvent(
        "form_submit",
        { form_type: "service_request", context: "service_request_page" },
        { recordInternally: false }
      );
      setFeedback({
        type: "success",
        message: `Request ${result.requestNumber} received. Our service team will review it and contact you shortly.`,
      });
      setForm(initialForm());
      setFiles([]);
      setHoneypot("");
      setFormStartedAt(Date.now());
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      trackWebsiteEvent("form_error", {
        form_type: "service_request",
        error_stage: "request_submission",
      });
      setFeedback({
        type: "error",
        message: error?.message || "We could not submit your request. Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className="container">
          <div className={styles.heroContent}>
            <span className={styles.eyebrow}>Nationwide imaging equipment support</span>
            <h1>
              Request <span>Service</span>
            </h1>
            <p>
              Give our service team the system details, current symptoms, and site
              information we need to begin planning the right response.
            </p>
            <div className={styles.heroNotes}>
              <span>Secure intake</span>
              <span>Photos &amp; error logs</span>
              <span>Fast service review</span>
            </div>
          </div>
          <aside className={styles.emergencyCard}>
            <span>Scanner down now?</span>
            <strong>Call for immediate remote support</strong>
            <a href="tel:+18002003583">(800) 200-3583</a>
            <small>Available for urgent MRI, CT, and PET/CT issues.</small>
          </aside>
        </div>
      </section>

      <section className={styles.formSection}>
        <div className="container">
          <div className={styles.formIntro}>
            <div>
              <span>Service intake</span>
              <h2>Tell us what is happening</h2>
            </div>
            <p>
              Fields marked <strong>*</strong> are required. Accurate system and
              operational details help us route your request faster.
            </p>
          </div>

          {feedback.message ? (
            <div
              className={`${styles.feedback} ${
                feedback.type === "success" ? styles.success : styles.error
              }`}
              role="status"
              aria-live="polite"
            >
              <span aria-hidden="true">{feedback.type === "success" ? "✓" : "!"}</span>
              {feedback.message}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className="bot-field" aria-hidden="true">
              <label htmlFor="service-website">Website</label>
              <input
                id="service-website"
                name="website"
                value={honeypot}
                onChange={(event) => setHoneypot(event.target.value)}
                tabIndex={-1}
                autoComplete="off"
              />
            </div>

            <fieldset className={styles.card}>
              <legend>
                <span>01</span>
                Company &amp; location
              </legend>
              <div className={styles.grid}>
                <Field id="company-name" label="Company Name" required className={styles.full}>
                  <input
                    id="company-name"
                    value={form.companyName}
                    onChange={update("companyName")}
                    maxLength={120}
                    autoComplete="organization"
                    placeholder="Facility or organization name"
                    required
                  />
                </Field>
                <Field id="service-date" label="Date of Service Request" required>
                  <input
                    id="service-date"
                    type="date"
                    value={form.requestedServiceDate}
                    onChange={update("requestedServiceDate")}
                    required
                  />
                </Field>
                <Field id="country" label="Country" required>
                  <select
                    id="country"
                    value={form.country}
                    onChange={update("country")}
                    required
                  >
                    {COUNTRIES.map((country) => (
                      <option key={country} value={country}>
                        {country}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field
                  id="street-address"
                  label="Location of equipment needed to be repaired"
                  required
                  className={styles.full}
                >
                  <input
                    id="street-address"
                    value={form.streetAddress}
                    onChange={update("streetAddress")}
                    maxLength={160}
                    autoComplete="street-address"
                    placeholder="Street address"
                    required
                  />
                </Field>
                <Field id="address-line-2" label="Address Line 2">
                  <input
                    id="address-line-2"
                    value={form.addressLine2}
                    onChange={update("addressLine2")}
                    maxLength={120}
                    placeholder="Suite, department, building"
                  />
                </Field>
                <Field id="city" label="City" required>
                  <input
                    id="city"
                    value={form.city}
                    onChange={update("city")}
                    maxLength={80}
                    autoComplete="address-level2"
                    required
                  />
                </Field>
                <Field id="region" label="State / Province / Region" required>
                  <input
                    id="region"
                    value={form.region}
                    onChange={update("region")}
                    maxLength={80}
                    autoComplete="address-level1"
                    required
                  />
                </Field>
                <Field id="postal-code" label="Postal / Zip Code" required>
                  <input
                    id="postal-code"
                    value={form.postalCode}
                    onChange={update("postalCode")}
                    maxLength={20}
                    autoComplete="postal-code"
                    required
                  />
                </Field>
              </div>
            </fieldset>

            <fieldset className={styles.card}>
              <legend>
                <span>02</span>
                Equipment &amp; urgency
              </legend>
              <div className={styles.equipmentLayout}>
                <Field
                  id="urgency"
                  label="Urgency"
                  required
                  hint="Select the timing that most accurately reflects the current need."
                  className={styles.full}
                >
                  <div className={styles.urgencyGrid}>
                    {URGENCY_OPTIONS.map((option) => (
                      <label
                        key={option.value}
                        className={form.urgency === option.value ? styles.selectedUrgency : ""}
                      >
                        <input
                          type="radio"
                          name="urgency"
                          value={option.value}
                          checked={form.urgency === option.value}
                          onChange={update("urgency")}
                          required
                        />
                        <strong>{option.label}</strong>
                        <span>{option.description}</span>
                      </label>
                    ))}
                  </div>
                </Field>
                <div className={styles.equipmentDetails}>
                  <Field id="manufacturer" label="Manufacture" required>
                    <select
                      id="manufacturer"
                      value={form.manufacturer}
                      onChange={update("manufacturer")}
                      required
                    >
                      <option value="">Select manufacturer</option>
                      {MANUFACTURERS.map((manufacturer) => (
                        <option key={manufacturer}>{manufacturer}</option>
                      ))}
                    </select>
                  </Field>
                  <Field id="modality" label="Modality" required>
                    <select
                      id="modality"
                      value={form.modality}
                      onChange={update("modality")}
                      required
                    >
                      <option value="">Select modality</option>
                      {MODALITIES.map((modality) => (
                        <option key={modality}>{modality}</option>
                      ))}
                    </select>
                  </Field>
                  <Field id="system-model" label="System / model">
                    <input
                      id="system-model"
                      value={form.systemModel}
                      onChange={update("systemModel")}
                      maxLength={160}
                      placeholder="Example: GE Signa Explorer"
                    />
                  </Field>
                  <Field
                    id="requested-timing"
                    label="Requested timing or known schedule"
                  >
                    <input
                      id="requested-timing"
                      value={form.requestedTiming}
                      onChange={update("requestedTiming")}
                      maxLength={240}
                      placeholder="Example: Monday after 9 AM"
                    />
                  </Field>
                </div>
              </div>
            </fieldset>

            <fieldset className={styles.card}>
              <legend>
                <span>03</span>
                Contact info
              </legend>
              <div className={styles.grid}>
                <Field id="first-name" label="First name" required>
                  <input
                    id="first-name"
                    value={form.firstName}
                    onChange={update("firstName")}
                    maxLength={60}
                    autoComplete="given-name"
                    required
                  />
                </Field>
                <Field id="last-name" label="Last name" required>
                  <input
                    id="last-name"
                    value={form.lastName}
                    onChange={update("lastName")}
                    maxLength={60}
                    autoComplete="family-name"
                    required
                  />
                </Field>
                <Field id="phone" label="Contact number" required>
                  <input
                    id="phone"
                    type="tel"
                    value={form.phone}
                    onChange={update("phone")}
                    maxLength={30}
                    autoComplete="tel"
                    placeholder="(555) 555-0123"
                    required
                  />
                </Field>
                <Field id="email" label="Email" required>
                  <input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={update("email")}
                    maxLength={120}
                    autoComplete="email"
                    placeholder="you@company.com"
                    required
                  />
                </Field>
                <Field
                  id="purchase-order"
                  label="Purchase order number if applicable"
                  className={styles.full}
                >
                  <input
                    id="purchase-order"
                    value={form.purchaseOrderNumber}
                    onChange={update("purchaseOrderNumber")}
                    maxLength={50}
                  />
                </Field>
              </div>
            </fieldset>

            <fieldset className={styles.card}>
              <legend>
                <span>04</span>
                Issue that needs to be resolved
              </legend>
              <div className={styles.grid}>
                <Field
                  id="issue-title"
                  label="Short issue title"
                  hint="A brief, understandable summary for our dispatch team."
                  required
                  className={styles.full}
                >
                  <input
                    id="issue-title"
                    value={form.issueTitle}
                    onChange={update("issueTitle")}
                    maxLength={100}
                    placeholder="Example: MRI cannot connect to the imager"
                    required
                  />
                </Field>
                <Field
                  id="description"
                  label="Please give a description of the issues so we can make an assessment."
                  required
                  className={styles.full}
                >
                  <textarea
                    id="description"
                    value={form.description}
                    onChange={update("description")}
                    maxLength={4000}
                    rows={7}
                    placeholder="Include symptoms, error codes, when the issue began, troubleshooting already attempted, and any access limitations."
                    required
                  />
                </Field>
                <Field
                  id="service-files"
                  label="Upload pictures of damage or error logs if applicable"
                  hint="Up to 5 JPG, PNG, WEBP, HEIC, PDF, or text files. Maximum 8 MB each."
                  className={styles.full}
                >
                  <div
                    className={`${styles.dropzone} ${dragActive ? styles.dragActive : ""}`}
                    onDragEnter={(event) => {
                      event.preventDefault();
                      setDragActive(true);
                    }}
                    onDragOver={(event) => event.preventDefault()}
                    onDragLeave={(event) => {
                      event.preventDefault();
                      if (event.currentTarget === event.target) setDragActive(false);
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      setDragActive(false);
                      addFiles(event.dataTransfer.files);
                    }}
                  >
                    <input
                      ref={fileInputRef}
                      id="service-files"
                      type="file"
                      accept=".jpg,.jpeg,.png,.webp,.heic,.heif,.pdf,.txt"
                      multiple
                      onChange={(event) => {
                        addFiles(event.target.files);
                        event.target.value = "";
                      }}
                    />
                    <div className={styles.uploadIcon} aria-hidden="true">↑</div>
                    <strong>Drop files here</strong>
                    <span>or</span>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Browse files
                    </button>
                  </div>
                  {files.length ? (
                    <div className={styles.fileList}>
                      <div className={styles.fileListHeader}>
                        <span>{files.length} attached</span>
                        <span>{(fileSummary / (1024 * 1024)).toFixed(1)} MB total</span>
                      </div>
                      {files.map((file, index) => (
                        <div className={styles.fileItem} key={`${file.name}-${file.lastModified}`}>
                          <span className={styles.fileType}>
                            {file.type.startsWith("image/") ? "IMG" : file.type === "application/pdf" ? "PDF" : "TXT"}
                          </span>
                          <div>
                            <strong>{file.name}</strong>
                            <small>{(file.size / (1024 * 1024)).toFixed(1)} MB</small>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeFile(index)}
                            aria-label={`Remove ${file.name}`}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </Field>
              </div>
            </fieldset>

            <div className={styles.submitBar}>
              <div>
                <strong>Ready to send?</strong>
                <span>Your request is protected by reCAPTCHA and secure server validation.</span>
              </div>
              <button type="submit" disabled={submitting}>
                {submitting ? "Submitting request…" : "Submit service request"}
                <span aria-hidden="true">→</span>
              </button>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}

export const FORM_LIMITS = {
  name: 80,
  email: 120,
  callbackPhone: 50,
  partNumber: 120,
  message: 2000,
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Allow a dialable number and an optional switchboard extension. Keep the
// customer's formatting so the recipient can read the number as submitted.
const isCallbackPhone = (value) => {
  if (value.length > FORM_LIMITS.callbackPhone) return false;
  const parts = /^(\+?[\d(). -]+?)(?: *(?:ext(?:ension)?\.?|x|#) *\d{1,8})?$/i.exec(value);
  if (!parts) return false;
  const digits = parts[1].replace(/\D/g, "");
  return parts[1].startsWith("+")
    ? /^[1-9]\d{7,14}$/.test(digits)
    : /^1?\d{10}$/.test(digits);
};

export const normalizeInput = (value, maxLength) =>
  (value || "")
    .toString()
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);

export const normalizeMessage = (value) =>
  (value || "")
    .toString()
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim()
    .slice(0, FORM_LIMITS.message);

export const escapeHtml = (value) =>
  (value || "")
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const renderEmailRow = (label, value) => `
  <tr>
    <th align="left" style="font-size:13px;border:none;font-family:'Segoe UI',sans-serif,Arial,Helvetica,Lato;color:#000;width:30%;padding:10px 20px">${escapeHtml(label)}:</th>
    <td align="left" style="font-size:13px;border:none;font-family:'Segoe UI',sans-serif,Arial,Helvetica,Lato;color:#000;padding:10px 20px;white-space:pre-line">${escapeHtml(value)}</td>
  </tr>
`;

export const sanitizeLeadForm = (values = {}, options = {}) => {
  const { name, email, message, partNumber = "" } = values;
  const partNumberRequired = Object.prototype.hasOwnProperty.call(values, "partNumber");
  const messageRequired = options.messageRequired !== false;

  const sanitized = {
    name: normalizeInput(name, FORM_LIMITS.name),
    email: normalizeInput(email, FORM_LIMITS.email).toLowerCase(),
    partNumber: normalizeInput(partNumber, FORM_LIMITS.partNumber),
    message: normalizeMessage(message),
  };

  const errors = [];
  if (sanitized.name.length < 3) errors.push("Please enter a valid name.");
  if (!EMAIL_PATTERN.test(sanitized.email)) errors.push("Please enter a valid email address.");
  if (messageRequired && !sanitized.message) errors.push("Please enter a message.");
  if (partNumberRequired && !sanitized.partNumber) {
    errors.push("Please enter a part number.");
  }

  return { sanitized, errors };
};

export const sanitizeServiceCallback = ({ name, callbackPhone, email, message } = {}) => {
  const sanitized = {
    name: typeof name === "string" ? normalizeInput(name, FORM_LIMITS.name) : "",
    callbackPhone: typeof callbackPhone === "string" ? callbackPhone.trim() : "",
    email: typeof email === "string" ? normalizeInput(email, FORM_LIMITS.email).toLowerCase() : "",
    message: typeof message === "string" ? normalizeMessage(message) : "",
  };
  const errors = [];
  if (!sanitized.name) errors.push("Please enter your name.");
  if (!isCallbackPhone(sanitized.callbackPhone)) {
    errors.push("Please enter a phone number with its area code or country code.");
  }
  if ((email != null && typeof email !== "string") || (sanitized.email && !EMAIL_PATTERN.test(sanitized.email))) {
    errors.push("Please enter a valid email address or leave it blank.");
  }
  return { sanitized, errors };
};

export const buildLeadText = ({
  name,
  email,
  callbackPhone,
  message,
  partNumber,
  leadType,
  sourcePage,
  context,
  trafficCountry,
  reviewFlag,
}) =>
  [
    `Source: AIS website - ${leadType || "Website inquiry"}`,
    sourcePage ? `Page: ${sourcePage}` : null,
    context ? `Context: ${context}` : null,
    trafficCountry && trafficCountry !== "unknown" ? `Traffic Country: ${trafficCountry}` : null,
    reviewFlag ? `Review Flag: ${reviewFlag}` : null,
    `Name: ${name}`,
    callbackPhone ? `Callback phone: ${callbackPhone}` : null,
    email ? `Email: ${email}` : null,
    partNumber ? `Part Number: ${partNumber}` : null,
    "",
    "Message:",
    message || "No additional details provided.",
  ]
    .filter((line) => line !== null)
    .join("\n");

export const buildLeadEmailHtml = ({
  name,
  email,
  callbackPhone,
  message,
  partNumber,
  leadType,
  sourcePage,
  context,
  trafficCountry,
  reviewFlag,
}) => {
  const rows = [
    renderEmailRow("Submission Source", `AIS website - ${leadType || "Website inquiry"}`),
    sourcePage ? renderEmailRow("Page", sourcePage) : "",
    context ? renderEmailRow("Context", context) : "",
    trafficCountry && trafficCountry !== "unknown"
      ? renderEmailRow("Traffic Country", trafficCountry)
      : "",
    reviewFlag ? renderEmailRow("Review Flag", reviewFlag) : "",
    renderEmailRow("Name", name),
    callbackPhone ? renderEmailRow("Callback phone", callbackPhone) : "",
    email ? renderEmailRow("Email Address", email) : "",
    partNumber ? renderEmailRow("Part Number", partNumber) : "",
    renderEmailRow("Message", message || "No additional details provided."),
  ].join("");

  return `<table align="center" border="0" cellpadding="0" cellspacing="0" width="100%"><tr><td height="50"></td></tr><tr><td align="center"><table align="center" bgcolor="#f7f7f7" cellpadding="0" cellspacing="0" width="600" style="border-radius:10px"><tr><td><table align="center" border="0" cellpadding="0" cellspacing="0" width="500"><tr><td height="30"></td></tr><tr><td align="center" width="100%" style="padding:0 15px"><a target="_blank" rel="noopener noreferrer" href="https://advancedimagingparts.com/"><img width="250" src="https://advancedimagingparts.com/assets/images/logo.svg" alt="Advanced Imaging Parts"></a></td></tr><tr><td height="30"></td></tr><tr><td align="left" style="color:#000;font-family:'Segoe UI',sans-serif,Arial,Helvetica,Lato;letter-spacing:1px"><table align="left" border="1" cellpadding="0" cellspacing="0" width="500" style="border-radius:10px;padding:10px 0">${rows}</table></td></tr></table></td></tr><tr><td height="40"></td></tr></table></td></tr></table>`;
};

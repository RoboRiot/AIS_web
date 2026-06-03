export const FORM_LIMITS = {
  name: 80,
  email: 120,
  partNumber: 120,
  message: 2000,
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

export const sanitizeLeadForm = ({ name, email, message, partNumber = "" }) => {
  const sanitized = {
    name: normalizeInput(name, FORM_LIMITS.name),
    email: normalizeInput(email, FORM_LIMITS.email).toLowerCase(),
    partNumber: normalizeInput(partNumber, FORM_LIMITS.partNumber),
    message: normalizeMessage(message),
  };

  const errors = [];
  if (sanitized.name.length < 3) errors.push("Please enter a valid name.");
  if (!EMAIL_PATTERN.test(sanitized.email)) errors.push("Please enter a valid email address.");
  if (!sanitized.message) errors.push("Please enter a message.");
  if (partNumber !== undefined && partNumber !== null && !sanitized.partNumber) {
    errors.push("Please enter a part number.");
  }

  return { sanitized, errors };
};

export const buildLeadText = ({ name, email, message, partNumber }) =>
  [
    `Name: ${name}`,
    `Email: ${email}`,
    partNumber ? `Part Number: ${partNumber}` : null,
    "",
    "Message:",
    message,
  ]
    .filter((line) => line !== null)
    .join("\n");

export const buildLeadEmailHtml = ({ name, email, message, partNumber }) => {
  const rows = [
    renderEmailRow("Name", name),
    renderEmailRow("Email Address", email),
    partNumber ? renderEmailRow("Part Number", partNumber) : "",
    renderEmailRow("Message", message),
  ].join("");

  return `<table align="center" border="0" cellpadding="0" cellspacing="0" width="100%"><tr><td height="50"></td></tr><tr><td align="center"><table align="center" bgcolor="#f7f7f7" cellpadding="0" cellspacing="0" width="600" style="border-radius:10px"><tr><td><table align="center" border="0" cellpadding="0" cellspacing="0" width="500"><tr><td height="30"></td></tr><tr><td align="center" width="100%" style="padding:0 15px"><a target="_blank" rel="noopener noreferrer" href="https://advancedimagingparts.com/"><img width="250" src="https://advancedimagingparts.com/assets/images/logo.svg" alt="Advanced Imaging Parts"></a></td></tr><tr><td height="30"></td></tr><tr><td align="left" style="color:#000;font-family:'Segoe UI',sans-serif,Arial,Helvetica,Lato;letter-spacing:1px"><table align="left" border="1" cellpadding="0" cellspacing="0" width="500" style="border-radius:10px;padding:10px 0">${rows}</table></td></tr></table></td></tr><tr><td height="40"></td></tr></table></td></tr></table>`;
};

export const submitLead = async ({ token, action, formType, name, email, partNumber, message }) => {
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
      message,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Submission failed. Please try again.");
  }

  return data;
};

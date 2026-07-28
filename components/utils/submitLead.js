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
}) => {
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
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || "Submission failed. Please try again.");
    error.status = response.status;
    throw error;
  }

  return data;
};

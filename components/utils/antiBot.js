export const MIN_SUBMIT_DELAY_MS = 2500;

export const evaluateBotSignals = ({ honeypotValue, startedAt }) => {
  const honeypotFilled = Boolean((honeypotValue || "").trim());
  if (honeypotFilled) {
    return { blocked: true, reason: "honeypot" };
  }

  const submittedTooFast = !startedAt || Date.now() - startedAt < MIN_SUBMIT_DELAY_MS;
  if (submittedTooFast) {
    return { blocked: true, reason: "timing" };
  }

  return { blocked: false, reason: null };
};

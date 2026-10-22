const timestamp = (event) => {
  const value = event.createdAt?.toMillis?.() ?? Date.parse(event.clientOccurredAt || event.date || "");
  return Number.isFinite(value) ? value : 0;
};

// These are script-load observations, not people, accepted inquiries, or Google receipt.
export function summarizeGoogleTagHealth(events) {
  const groups = new Map();
  let rawObservations = 0;
  for (const event of events) {
    if (event.eventType !== "google_tag_status") continue;
    rawObservations++;
    const props = event.properties || {};
    const explicitId = props.tag_load_id;
    // Historical reports have no document ID. Never merge different paths or unidentified events.
    const key = explicitId ? `load:${explicitId}` : event.sessionHash
      ? `legacy:${event.sessionHash}:${event.path || ""}` : `event:${rawObservations}`;
    const current = groups.get(key);
    const order = explicitId ? Number(props.tag_load_sequence) || 0 : timestamp(event);
    const failedBefore = current?.failedBefore || props.tag_state === "failed";
    if (!current || order >= current.order) groups.set(key, { props, order, failedBefore, legacy: !explicitId });
    else current.failedBefore = failedBefore;
  }
  const summary = {
    rawObservations, observedLoadGroups: groups.size, loaded: 0, recovered: 0,
    finalFailed: 0, unresolvedError: 0, offlinePending: 0, pending: 0, unknown: 0,
    legacyGroups: 0, finalFailureReasons: {},
    interpretation: "Script status only; legacy groups approximate session/path, not unique page loads. Missing later observations do not prove permanent failure or lost leads.",
  };
  for (const { props, failedBefore, legacy } of groups.values()) {
    if (legacy) summary.legacyGroups++;
    if (props.tag_state === "loaded") {
      summary.loaded++;
      if (failedBefore) summary.recovered++;
    } else if (props.tag_state === "failed") {
      const final = props.tag_load_final === true || (legacy &&
        (props.tag_load_error === "csp_blocked" || Number(props.tag_load_attempts) >= 3));
      if (final) {
        summary.finalFailed++;
        const reason = props.tag_load_error || "unknown";
        summary.finalFailureReasons[reason] = (summary.finalFailureReasons[reason] || 0) + 1;
      } else summary.unresolvedError++;
    } else if (props.tag_load_error === "offline") summary.offlinePending++;
    else if (props.tag_state === "queued") summary.pending++;
    else summary.unknown++;
  }
  return summary;
}

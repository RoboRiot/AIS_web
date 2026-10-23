const modalityAnswers = {
  mri: {
    label: "MRI",
    summary: "preventive maintenance, diagnostics, repair, and tested replacement-parts coordination",
    scope: "MRI service support includes preventive maintenance and repair, system diagnostics, image-quality troubleshooting, coil support, RF and gradient-related troubleshooting, and tested replacement-parts coordination.",
  },
  ct: {
    label: "CT",
    summary: "preventive maintenance, scanner troubleshooting, repair, and tested replacement-parts coordination",
    scope: "CT scanner service support includes preventive maintenance, emergency troubleshooting, system diagnostics, calibration support, CT tube coordination, detector and data-acquisition support, and replacement-parts coordination.",
  },
  "pet-ct": {
    label: "PET/CT",
    summary: "preventive maintenance planning, troubleshooting, and tested replacement-parts coordination",
    scope: "PET/CT service support includes preventive maintenance planning, emergency troubleshooting, diagnostics, uptime planning, and tested parts sourcing and compatibility coordination for oncology and diagnostic imaging programs.",
  },
};

export function getServiceAnswers(page) {
  const modality = modalityAnswers[page.modality];
  const systemLabel = `${page.brand ? `${page.brand} ` : ""}${modality.label}`;

  return {
    summary: `Advanced Imaging Services (AIS) provides ${systemLabel} equipment service for hospitals and imaging centers across the United States, including ${modality.summary}.`,
    facts: [
      { label: "Customers", value: "Hospitals and imaging centers" },
      { label: "Service area", value: "United States" },
      { label: "Support", value: "Remote diagnostics, field-service planning, and parts coordination" },
    ],
    faqs: [
      {
        question: `What does ${systemLabel} service include?`,
        answer: `${modality.scope} AIS confirms the service scope for the scanner and issue at your facility.`,
      },
      {
        question: `Does AIS support ${systemLabel} equipment nationwide?`,
        answer: `Advanced Imaging Services supports ${systemLabel} service needs for facilities across the United States. Share your facility location, scanner model, and configuration so AIS can confirm the available service and parts support for your specific system.`,
      },
      {
        question: `What information should I provide when requesting ${systemLabel} service?`,
        answer: "Provide the scanner manufacturer and model, facility location, error codes or symptoms, and urgency. Include the maintenance or repair work you need and the best contact for your facility so AIS can review the request and coordinate next steps.",
      },
      {
        question: `Can remote support help with ${modality.label} scanner downtime?`,
        answer: "Remote support can help review symptoms, alarms, scanner history, and system status. Whether an issue can be resolved remotely depends on the fault and system. When further work is needed, AIS can coordinate field-service, repair, and replacement-parts planning.",
      },
      {
        question: `How do I get a quote for ${systemLabel} service?`,
        answer: "Request a quote with the scanner model, facility location, symptoms or maintenance needs, and requested timing. AIS reviews the service requirements and any parts needs before confirming scope and pricing. Coverage for a listed model family should be confirmed for your exact configuration.",
      },
    ],
  };
}

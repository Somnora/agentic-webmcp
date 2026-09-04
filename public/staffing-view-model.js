function formatMoney(amount, currencyCode = "USD") {
  const numeric = Number(amount ?? 0);
  const formatted = numeric.toLocaleString("en-US", {
    minimumFractionDigits: numeric % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return `$${formatted} ${currencyCode}`;
}

export function adaptStaffingResult(result) {
  if (!result || typeof result !== "object") {
    throw new TypeError("Staffing result must be an object.");
  }
  if (!Array.isArray(result.crews)) {
    throw new TypeError("Staffing result must contain a crews array.");
  }

  const providerSourceReview = result.staffing?.providerSourceReview ?? "human-only";
  const actionEligible = Boolean(result.staffing?.actionEligible);
  const status = result.status ?? (actionEligible ? "planned" : "needs-attention");
  const warning = typeof result.warning === "string" ? result.warning : null;

  const crews = result.crews.map((crew) => {
    const assignments = (crew.assignments ?? []).map((assignment) => {
      const providerName = assignment.providerName ?? "";
      const role = assignment.role ?? "";
      const offerHandle = assignment.offerHandle ?? "";
      const offerTitle = assignment.offerTitle ?? "";
      const sourceUrl = assignment.sourceReview?.url ?? "";
      const transmittedInformation = assignment.sourceReview?.transmittedInformation ?? "";
      const sourceAction = assignment.sourceReview?.action ?? "human-only";

      const quoteMode = assignment.price?.quoteMode ?? "estimate-only";
      const quoteModeLabel = quoteMode === "published-rate" ? "Published rate" : "Estimate only";
      const publishedAmount = assignment.price?.published?.amount ?? "0";
      const currencyCode = assignment.price?.published?.currencyCode ?? "USD";
      const basis = assignment.price?.basis ?? "hourly";
      const publishedFormatted = formatMoney(publishedAmount, currencyCode);
      const priceDisplay = `${quoteModeLabel} | ${publishedFormatted} (${basis})`;

      const credentials = (assignment.credentialEvidence ?? []).map((cred) => ({
        id: cred.id ?? "",
        label: cred.label ?? "",
        status: cred.status ?? "unverified",
        issuer: cred.issuer ?? null,
        verificationLabel: cred.verificationLabel ?? "",
        checkedAt: cred.checkedAt ?? "",
        expiresAt: cred.expiresAt ?? null,
        isControlledVerified: cred.status === "controlled-verified",
      }));

      const verifiedCredentials = credentials.filter((cred) => cred.isControlledVerified);
      const otherCredentials = credentials.filter((cred) => !cred.isControlledVerified);

      const equipment = Array.isArray(assignment.equipment) ? [...assignment.equipment] : [];

      const serviceAreaLabel = assignment.serviceArea?.label ?? "";
      const proximityFit = assignment.serviceArea?.proximityFit ?? "local-match";
      const proximityLabel = proximityFit === "local-match" ? "Local subregion match" : "Cross-subregion service";

      return {
        role,
        roleLabel: role,
        providerName,
        offerHandle,
        offerTitle,
        sourceUrl,
        transmittedInformation,
        sourceAction,
        quoteMode,
        quoteModeLabel,
        priceDisplay,
        pricePublished: publishedFormatted,
        priceBasis: basis,
        credentials,
        verifiedCredentials,
        otherCredentials,
        equipment,
        serviceAreaLabel,
        proximityFit,
        proximityLabel,
      };
    });

    const missingRoles = (crew.missingRoles ?? []).map((gap) => ({
      role: gap.role ?? "",
      reason: gap.reason ?? "",
      requiredCredentials: Array.isArray(gap.requiredCredentials) ? [...gap.requiredCredentials] : [],
      requiredEquipment: Array.isArray(gap.requiredEquipment) ? [...gap.requiredEquipment] : [],
    }));

    const scheduleGaps = (crew.scheduleGaps ?? []).map((gap) => ({
      role: gap.role ?? "",
      date: gap.date ?? "",
      reason: gap.reason ?? "",
    }));

    const publishedSubtotal = formatMoney(crew.costs?.publishedSubtotal?.amount ?? "0", crew.costs?.publishedSubtotal?.currencyCode ?? "USD");
    const planningHigh = formatMoney(crew.costs?.planningHigh?.amount ?? "0", crew.costs?.planningHigh?.currencyCode ?? "USD");
    const budgetCeiling = formatMoney(crew.budgetCeiling?.amount ?? "0", crew.budgetCeiling?.currencyCode ?? "USD");
    const withinBudget = Boolean(crew.costs?.withinBudget);

    return {
      id: crew.id ?? "",
      label: crew.label ?? "",
      title: crew.title ?? "",
      status: crew.status ?? "needs-attention",
      score: typeof crew.score === "number" ? crew.score : 0,
      projectDate: crew.projectDate ?? "",
      estimatedHours: typeof crew.estimatedHours === "number" ? crew.estimatedHours : 0,
      assignments,
      missingRoles,
      scheduleGaps,
      budgetCeiling,
      publishedSubtotal,
      planningHigh,
      withinBudget,
      quoteAccounting: {
        publishedRateAssignments: crew.quoteAccounting?.publishedRateAssignments ?? 0,
        estimateOnlyAssignments: crew.quoteAccounting?.estimateOnlyAssignments ?? 0,
        unknownCosts: Array.isArray(crew.quoteAccounting?.unknownCosts) ? [...crew.quoteAccounting.unknownCosts] : [],
      },
      why: crew.why ?? "",
      tradeoff: crew.tradeoff ?? "",
      evidenceConfidence: crew.evidenceConfidence ?? "",
      providerSourceReview,
    };
  });

  return {
    status,
    warning,
    providerSourceReview,
    actionEligible,
    crews,
  };
}

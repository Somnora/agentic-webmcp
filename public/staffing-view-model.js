function formatMoney(amount, currencyCode = "USD") {
  const numeric = Number(amount ?? 0);
  const formatted = numeric.toLocaleString("en-US", {
    minimumFractionDigits: numeric % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return `$${formatted} ${currencyCode}`;
}

export function isControlledServicesHttpsUrl(urlString) {
  if (typeof urlString !== "string" || !urlString.trim()) return false;
  try {
    const url = new URL(urlString);
    return (
      url.protocol === "https:" &&
      url.hostname === "agentic-webmcp-origin.somnora.workers.dev" &&
      url.pathname.startsWith("/services/")
    );
  } catch {
    return false;
  }
}

export function adaptStaffingResult(result, handoffAction = null) {
  if (!result || typeof result !== "object") {
    throw new TypeError("Staffing result must be an object.");
  }
  if (!Array.isArray(result.crews)) {
    throw new TypeError("Staffing result must contain a crews array.");
  }
  if (!result.staffing || typeof result.staffing !== "object") {
    throw new TypeError("Staffing result must contain a staffing metadata object.");
  }
  if (handoffAction !== undefined && handoffAction !== null && typeof handoffAction !== "object") {
    throw new TypeError("handoffAction must be an object when provided.");
  }

  const providerSourceReview = typeof result.staffing.providerSourceReview === "string"
    ? result.staffing.providerSourceReview
    : null;
  const actionEligible = typeof result.staffing.actionEligible === "boolean"
    ? result.staffing.actionEligible
    : false;
  const status = result.status ?? (actionEligible ? "planned" : "needs-attention");
  const warning = typeof result.warning === "string" ? result.warning : null;

  const envelopeHandoffEligible = Boolean(
    handoffAction &&
    handoffAction.available === true &&
    handoffAction.requiresHumanApproval === true &&
    actionEligible === true &&
    providerSourceReview === "human-only"
  );

  const crews = result.crews.map((crew) => {
    const assignments = (crew.assignments ?? []).map((assignment) => {
      if (!assignment || typeof assignment !== "object") {
        throw new TypeError("Assignment must be an object.");
      }
      if (!assignment.sourceReview || typeof assignment.sourceReview !== "object") {
        throw new TypeError(`Staffing assignment for role "${assignment.role || "unknown"}" is missing sourceReview.`);
      }

      const providerName = typeof assignment.providerName === "string" ? assignment.providerName : "";
      const role = typeof assignment.role === "string" ? assignment.role : "";
      const offerHandle = typeof assignment.offerHandle === "string" ? assignment.offerHandle : "";
      const offerTitle = typeof assignment.offerTitle === "string" ? assignment.offerTitle : "";

      const sourceUrl = typeof assignment.sourceReview.url === "string" ? assignment.sourceReview.url : null;
      const transmittedInformation = typeof assignment.sourceReview.transmittedInformation === "string"
        ? assignment.sourceReview.transmittedInformation
        : null;
      const sourceAction = typeof assignment.sourceReview.action === "string" ? assignment.sourceReview.action : null;

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

      const rawProximityFit = assignment.serviceArea?.proximityFit;
      let proximityFit = null;
      let proximityLabel = null;
      if (rawProximityFit === "local-match") {
        proximityFit = "local-match";
        proximityLabel = "Local subregion match";
      } else if (rawProximityFit === "cross-subregion-service") {
        proximityFit = "cross-subregion-service";
        proximityLabel = "Cross-subregion service";
      }

      const serviceAreaLabel = typeof assignment.serviceArea?.label === "string" ? assignment.serviceArea.label : "";

      const isControlledUrl = isControlledServicesHttpsUrl(sourceUrl);
      const sourceReviewEligible = Boolean(
        envelopeHandoffEligible &&
        sourceAction === "human-only" &&
        isControlledUrl &&
        transmittedInformation &&
        proximityFit !== null
      );

      return {
        role,
        roleLabel: role,
        providerName,
        offerHandle,
        offerTitle,
        sourceUrl,
        transmittedInformation,
        sourceAction,
        isControlledUrl,
        sourceReviewEligible,
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
    envelopeHandoffEligible,
    crews,
  };
}

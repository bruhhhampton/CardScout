// CardScout assessment rules. Plain code, no AI. Same inputs always give the same result.
// Combines the owner's shop limits with the owner's CERF-style player judgement.
// It never buys anything; "eligible" still needs a person to confirm.

export const OUTCOMES = {
  eligible: 'Eligible',
  decline: 'Decline',
  counteroffer: 'Counteroffer',
  owner_review: 'Owner review',
};

const aud = (n) => `$${Number(n).toFixed(2)}`;
const floorCents = (n) => Math.floor((n + 1e-9) * 100) / 100;

export function excludedList(text) {
  return String(text ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

// CERF total (0-100) and category, using the owner's weights and thresholds.
export function cerf(scores, s) {
  const total =
    (scores.football * s.w_football +
      scores.career * s.w_career +
      scores.collector * s.w_collector +
      scores.card * s.w_card +
      scores.valuation * s.w_valuation) /
    100;
  let category;
  let reason;
  if (scores.football < s.reject_football_below) {
    category = 'REJECT';
    reason = `Football quality ${scores.football} is below your reject level of ${s.reject_football_below}`;
  } else if (scores.football < s.speculative_football_below || scores.career < s.speculative_career_below) {
    category = 'SPECULATIVE';
    reason =
      scores.football < s.speculative_football_below
        ? `Football quality ${scores.football} is below your proven level of ${s.speculative_football_below}`
        : `Career path ${scores.career} is below your level of ${s.speculative_career_below}`;
  } else if (scores.valuation < s.expensive_valuation_below) {
    category = 'EXPENSIVE';
    reason = `Valuation score ${scores.valuation} is below your level of ${s.expensive_valuation_below}`;
  } else if (total >= s.attractive_total_min && scores.valuation >= s.attractive_valuation_min) {
    category = 'ATTRACTIVE';
    reason = `CERF total ${total.toFixed(1)} meets your attractive level of ${s.attractive_total_min}`;
  } else {
    category = 'WATCH';
    reason = `CERF total ${total.toFixed(1)} is below your attractive level of ${s.attractive_total_min}, or valuation is below ${s.attractive_valuation_min}`;
  }
  return { total: Math.round(total * 10) / 10, category, reason };
}

// offer: { set_name, asking_price_aud }
// input: { stock_count, condition, rookie_card, first_team ('yes'|'no'|'unsure'), sales_count,
//          median_sold_aud (number|null), scores:{football,career,collector,card,valuation} }
// s: shop settings row
export function assess(offer, input, s) {
  const reasons = [];
  const result = (outcome, extra = {}) => ({ outcome, reasons, ...extra });
  const asking = Number(offer.asking_price_aud);
  const c = cerf(input.scores, s);
  const median = input.median_sold_aud == null ? null : Number(input.median_sold_aud);
  const ceiling =
    median == null
      ? null
      : floorCents(Math.min(Number(s.offer_fraction) * median, (1 - Number(s.min_margin)) * median - Number(s.selling_costs_aud)));
  const extra = { cerf_total: c.total, cerf_category: c.category, offer_ceiling_aud: ceiling };

  // 1. Hard shop rules: decline straight away.
  if (excludedList(s.excluded_sets).includes(String(offer.set_name).trim().toLowerCase())) {
    reasons.push(`The set "${offer.set_name}" is on your excluded list`);
    return result('decline', extra);
  }
  if (input.condition === 'not_acceptable') {
    reasons.push('Condition does not meet your standard');
    return result('decline', extra);
  }
  // Cerf's two gates from his CERF model.
  if (input.rookie_card === 'no') {
    reasons.push('Not a recognised rookie card; your rule is to buy recognised rookie cards only');
    return result('decline', extra);
  }
  if (input.first_team === 'no') {
    reasons.push('The player has no first-team chance; your rule is to decline these');
    return result('decline', extra);
  }
  if (input.stock_count + 1 > s.max_copies) {
    reasons.push(`You already hold ${input.stock_count}; buying one more passes your limit of ${s.max_copies}`);
    return result('decline', extra);
  }

  // 2. Missing information: the owner decides.
  if (input.condition === 'unsure') reasons.push('Condition has not been confirmed');
  if (input.rookie_card === 'unsure') reasons.push('Rookie card status has not been confirmed');
  if (input.first_team === 'unsure') reasons.push('First-team chance has not been confirmed');
  if (input.sales_count < s.min_sales || median == null) {
    reasons.push(
      `Only ${input.sales_count} matching sale(s) in the last ${s.sales_window_days} days; you need at least ${s.min_sales}`
    );
  }
  if (reasons.length) return result('owner_review', extra);

  // 3. Owner's player judgement (CERF).
  if (c.category === 'REJECT') {
    reasons.push(`CERF: ${c.reason}`);
    return result('decline', extra);
  }
  if (c.category === 'SPECULATIVE' || c.category === 'WATCH') {
    reasons.push(`CERF ${c.category.toLowerCase()}: ${c.reason}`);
    return result('owner_review', extra);
  }

  // 4. Price against the ceiling and the staff limit.
  if (ceiling < 0) {
    reasons.push(`Selling costs leave no room for a fair offer (ceiling ${aud(ceiling)})`);
    return result('decline', extra);
  }
  if (asking > ceiling) {
    if (ceiling > Number(s.staff_limit_aud)) {
      reasons.push(`Asking ${aud(asking)} is above the ceiling ${aud(ceiling)}, and a counteroffer would pass your staff limit of ${aud(s.staff_limit_aud)}`);
      return result('owner_review', extra);
    }
    reasons.push(`Asking ${aud(asking)} is above your offer ceiling of ${aud(ceiling)}; counteroffer up to ${aud(ceiling)}`);
    if (c.category === 'EXPENSIVE') reasons.push(`CERF expensive: ${c.reason}`);
    return result('counteroffer', extra);
  }
  if (c.category === 'EXPENSIVE') {
    reasons.push(`CERF expensive: ${c.reason}`);
    return result('owner_review', extra);
  }
  if (asking > Number(s.staff_limit_aud)) {
    reasons.push(`Asking ${aud(asking)} is above your staff limit of ${aud(s.staff_limit_aud)}`);
    return result('owner_review', extra);
  }
  reasons.push(`CERF attractive: ${c.reason}`);
  reasons.push(`Asking ${aud(asking)} is within your ceiling of ${aud(ceiling)} and staff limit of ${aud(s.staff_limit_aud)}`);
  reasons.push('A person must still confirm before buying');
  return result('eligible', extra);
}

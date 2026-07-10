// GST QRMP scheme (CGST Notification 85/2020) fixes two due-date categories
// by registered state — Category 1 files GSTR-3B by the 22nd, Category 2 by
// the 24th. This list is also recorded on compliance_rules.applicable_states
// for the GSTR-3B_QRMP_CAT1/CAT2 rows (see the qrmp_gstr1_rule_and_state_docs
// migration); it's duplicated here as a static lookup because picking which
// filing_type row applies happens before the DB is queried, not after.
const CATEGORY_1_STATES = new Set([
  "Chhattisgarh", "Madhya Pradesh", "Gujarat", "Maharashtra", "Karnataka",
  "Goa", "Kerala", "Tamil Nadu", "Telangana", "Andhra Pradesh",
  "Daman and Diu", "Dadra and Nagar Haveli", "Puducherry",
  "Andaman and Nicobar", "Lakshadweep",
]);

export function qrmpCategory(state: string): "CAT1" | "CAT2" {
  return CATEGORY_1_STATES.has(state) ? "CAT1" : "CAT2";
}

// Months in which a QRMP (quarterly) client actually has a GSTR-1/3B return
// due — the manual bulk generator lets a user pick arbitrary months, and a
// QRMP client only files at quarter-end, not every month.
export const QRMP_QUARTER_END_MONTHS = new Set(["June", "September", "December", "March"]);

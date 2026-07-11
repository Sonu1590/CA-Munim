import { describe, expect, it } from "vitest";
import { dscExpiryStatus } from "@/data/ClientCredentials";

describe("dscExpiryStatus", () => {
  const asOf = new Date("2026-07-10");

  it("returns unknown when no expiry date is set", () => {
    expect(dscExpiryStatus("", asOf)).toBe("unknown");
  });

  it("returns expired for a past date", () => {
    expect(dscExpiryStatus("2026-01-01", asOf)).toBe("expired");
  });

  it("returns expiring_soon within 30 days", () => {
    expect(dscExpiryStatus("2026-07-25", asOf)).toBe("expiring_soon");
    expect(dscExpiryStatus("2026-08-09", asOf)).toBe("expiring_soon");
  });

  it("returns valid beyond 30 days", () => {
    expect(dscExpiryStatus("2026-08-15", asOf)).toBe("valid");
    expect(dscExpiryStatus("2027-01-01", asOf)).toBe("valid");
  });

  it("treats today itself as expiring_soon, not expired", () => {
    expect(dscExpiryStatus("2026-07-10", asOf)).toBe("expiring_soon");
  });
});

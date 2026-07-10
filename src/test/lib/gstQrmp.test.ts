import { describe, expect, it } from "vitest";
import { qrmpCategory, QRMP_QUARTER_END_MONTHS } from "@/lib/gstQrmp";

describe("qrmpCategory", () => {
  it("classifies known Category 1 states", () => {
    expect(qrmpCategory("Maharashtra")).toBe("CAT1");
    expect(qrmpCategory("Tamil Nadu")).toBe("CAT1");
  });

  it("classifies known Category 2 states", () => {
    expect(qrmpCategory("Delhi")).toBe("CAT2");
    expect(qrmpCategory("Uttar Pradesh")).toBe("CAT2");
  });

  it("defaults an unrecognized/empty state to Category 2", () => {
    expect(qrmpCategory("")).toBe("CAT2");
    expect(qrmpCategory("Not A State")).toBe("CAT2");
  });
});

describe("QRMP_QUARTER_END_MONTHS", () => {
  it("contains exactly the four quarter-end months", () => {
    expect([...QRMP_QUARTER_END_MONTHS].sort()).toEqual(["December", "June", "March", "September"]);
  });
});

import { describe, expect, it } from "vitest";
import {
  downloadCsv,
  downloadHtmlReport,
  formatDateIN,
  formatINR,
  slugifyFileName,
  type CsvColumn,
  type HtmlTableColumn,
} from "@/lib/downloads";

// downloadCsv/downloadHtmlReport ultimately call downloadTextFile, which does
// `new Blob([content], {type})` then clicks an <a>. jsdom's Blob has no
// readable .text() and no URL.createObjectURL, so wrap the Blob constructor to
// record the raw content/type, and stub the URL + anchor-click side effects.
function capture(run: () => void): { fileName: string; text: string; type: string } {
  const result = { fileName: "", text: "", type: "" };
  const OriginalBlob = globalThis.Blob;
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;
  const originalClick = HTMLAnchorElement.prototype.click;

  globalThis.Blob = class extends OriginalBlob {
    constructor(parts: any[] = [], options: any = {}) {
      super(parts, options);
      result.text = parts.map((p) => String(p)).join("");
      result.type = options?.type ?? "";
    }
  } as never;
  URL.createObjectURL = (() => "blob:mock") as never;
  URL.revokeObjectURL = (() => {}) as never;
  HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
    result.fileName = this.download;
  } as never;

  try {
    run();
  } finally {
    globalThis.Blob = OriginalBlob;
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
    HTMLAnchorElement.prototype.click = originalClick;
  }
  return result;
}

function blobText(run: () => void): string {
  return capture(run).text;
}

describe("formatINR", () => {
  it("groups amounts in the Indian lakh/crore system with 2 decimals", () => {
    expect(formatINR(125000)).toBe("Rs. 1,25,000.00");
    expect(formatINR(10000000)).toBe("Rs. 1,00,00,000.00");
  });

  it("treats null/undefined as zero rather than crashing", () => {
    expect(formatINR(null)).toBe("Rs. 0.00");
    expect(formatINR(undefined)).toBe("Rs. 0.00");
  });
});

describe("formatDateIN", () => {
  it("formats a date as DD Mon YYYY", () => {
    expect(formatDateIN("2026-01-05")).toMatch(/^05 Jan 2026$/);
  });

  it("returns a dash for empty input", () => {
    expect(formatDateIN(null)).toBe("-");
    expect(formatDateIN(undefined)).toBe("-");
    expect(formatDateIN("")).toBe("-");
  });

  it("echoes an unparseable string back instead of NaN", () => {
    expect(formatDateIN("not-a-date")).toBe("not-a-date");
  });
});

describe("slugifyFileName", () => {
  it("lowercases, collapses non-alphanumerics to single hyphens, and trims edges", () => {
    expect(slugifyFileName("  Receivables Aging Report (FY 2025-26)  ")).toBe("receivables-aging-report-fy-2025-26");
  });

  it("falls back to 'download' when nothing usable remains", () => {
    expect(slugifyFileName("!!!")).toBe("download");
    expect(slugifyFileName("   ")).toBe("download");
  });

  it("caps the slug length at 80 characters", () => {
    const long = "a".repeat(200);
    expect(slugifyFileName(long).length).toBe(80);
  });
});

interface Row {
  name: string;
  amount: number;
}

const csvColumns: CsvColumn<Row>[] = [
  { header: "Name", value: (r) => r.name },
  { header: "Amount", value: (r) => r.amount },
];

describe("downloadCsv", () => {
  it("quotes every field, escapes embedded quotes, and prepends a BOM", () => {
    const text = blobText(() =>
      downloadCsv<Row>("out.csv", [{ name: 'Ltd "A"', amount: 1000 }], csvColumns),
    );
    expect(text.startsWith("﻿")).toBe(true);
    expect(text).toContain('"Name","Amount"');
    // The embedded double-quote is doubled per RFC 4180.
    expect(text).toContain('"Ltd ""A""","1000"');
    // CRLF line endings.
    expect(text).toContain("\r\n");
  });

  it("emits only a header row for an empty dataset", () => {
    const text = blobText(() => downloadCsv<Row>("out.csv", [], csvColumns));
    expect(text).toBe('﻿"Name","Amount"');
  });

  it("scales to a large dataset without truncating rows", () => {
    const rows: Row[] = Array.from({ length: 500 }, (_, i) => ({ name: `Client ${i}`, amount: i }));
    const text = blobText(() => downloadCsv<Row>("out.csv", rows, csvColumns));
    // 1 header + 500 data rows.
    expect(text.split("\r\n")).toHaveLength(501);
    expect(text).toContain('"Client 499","499"');
  });
});

const htmlColumns: HtmlTableColumn<Row>[] = [
  { header: "Name", value: (r) => r.name },
  { header: "Amount", value: (r) => r.amount, align: "right" },
];

describe("downloadHtmlReport", () => {
  it("escapes HTML-significant characters in headers and cells (no injection)", () => {
    const html = blobText(() =>
      downloadHtmlReport<Row>("r.html", "Report", [{ name: "<script>x</script>", amount: 5 }], htmlColumns),
    );
    expect(html).toContain("&lt;script&gt;x&lt;/script&gt;");
    expect(html).not.toContain("<script>x</script>");
    expect(html).toContain('class="right"');
  });

  it("renders a 'No records found' row for an empty report", () => {
    const html = blobText(() => downloadHtmlReport<Row>("r.html", "Report", [], htmlColumns));
    expect(html).toContain("No records found");
    expect(html).toContain('colspan="2"');
  });

  it("sets the download blob mime type to text/html", () => {
    const captured = capture(() =>
      downloadHtmlReport<Row>("r.html", "Report", [{ name: "A", amount: 1 }], htmlColumns),
    );
    expect(captured.fileName).toBe("r.html");
    expect(captured.type).toContain("text/html");
  });
});

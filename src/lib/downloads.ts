type CsvValue = string | number | boolean | null | undefined;

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => CsvValue;
}

export interface HtmlTableColumn<T> {
  header: string;
  value: (row: T) => CsvValue;
  align?: "left" | "right" | "center";
}

export function formatINR(amount: number | null | undefined) {
  return `Rs. ${(amount ?? 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatDateIN(date: string | Date | null | undefined) {
  if (!date) return "-";
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return String(date);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function slugifyFileName(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "download";
}

export function downloadTextFile(fileName: string, content: string, type = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type });
  downloadBlob(fileName, blob);
}

export function downloadBlob(fileName: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function downloadUrl(fileName: string, url: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export async function downloadRemoteFile(fileName: string, url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Download failed (${response.status})`);
  }
  const blob = await response.blob();
  downloadBlob(fileName, blob);
}

export function downloadCsv<T>(fileName: string, rows: T[], columns: CsvColumn<T>[]) {
  const csv = [
    columns.map((c) => escapeCsv(c.header)).join(","),
    ...rows.map((row) => columns.map((c) => escapeCsv(c.value(row))).join(",")),
  ].join("\r\n");

  downloadTextFile(fileName, `\uFEFF${csv}`, "text/csv;charset=utf-8");
}

export function downloadExcelTable<T>(
  fileName: string,
  title: string,
  rows: T[],
  columns: HtmlTableColumn<T>[],
  meta: Record<string, string> = {},
) {
  const html = buildHtmlReport({ title, rows, columns, meta, compact: true });
  downloadTextFile(fileName, html, "application/vnd.ms-excel;charset=utf-8");
}

export function downloadHtmlReport<T>(
  fileName: string,
  title: string,
  rows: T[],
  columns: HtmlTableColumn<T>[],
  meta: Record<string, string> = {},
) {
  const html = buildHtmlReport({ title, rows, columns, meta });
  downloadTextFile(fileName, html, "text/html;charset=utf-8");
}

export function downloadHtmlDocument(fileName: string, title: string, body: string, meta: Record<string, string> = {}) {
  downloadTextFile(fileName, wrapHtmlDocument(title, body, meta), "text/html;charset=utf-8");
}

export function openHtmlDocument(title: string, body: string, meta: Record<string, string> = {}) {
  const blob = new Blob([wrapHtmlDocument(title, body, meta)], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export function openUrl(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}

function buildHtmlReport<T>({
  title,
  rows,
  columns,
  meta,
  compact = false,
}: {
  title: string;
  rows: T[];
  columns: HtmlTableColumn<T>[];
  meta: Record<string, string>;
  compact?: boolean;
}) {
  const body = `
    <table>
      <thead>
        <tr>${columns.map((c) => `<th class="${c.align ?? "left"}">${escapeHtml(c.header)}</th>`).join("")}</tr>
      </thead>
      <tbody>
        ${
          rows.length
            ? rows
                .map(
                  (row) =>
                    `<tr>${columns
                      .map((c) => `<td class="${c.align ?? "left"}">${escapeHtml(c.value(row))}</td>`)
                      .join("")}</tr>`,
                )
                .join("")
            : `<tr><td colspan="${columns.length}" class="center muted">No records found</td></tr>`
        }
      </tbody>
    </table>
  `;

  return wrapHtmlDocument(title, body, meta, compact);
}

function wrapHtmlDocument(title: string, body: string, meta: Record<string, string> = {}, compact = false) {
  const generatedAt = formatDateIN(new Date());
  const metaRows = { ...meta, "Generated on": generatedAt };
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: ${compact ? "16px" : "28px"}; color: #172033; font-family: Arial, Helvetica, sans-serif; }
    .header { border-bottom: 2px solid #172033; margin-bottom: 18px; padding-bottom: 12px; }
    h1 { margin: 0 0 8px; font-size: ${compact ? "20px" : "24px"}; letter-spacing: 0; }
    .meta { display: grid; grid-template-columns: repeat(2, minmax(180px, 1fr)); gap: 6px 24px; color: #4b5563; font-size: 12px; }
    .meta span { color: #172033; font-weight: 700; }
    table { border-collapse: collapse; width: 100%; table-layout: auto; font-size: ${compact ? "12px" : "13px"}; }
    th, td { border: 1px solid #d7dde8; padding: 8px 10px; vertical-align: top; }
    th { background: #eef3f8; color: #172033; font-weight: 700; }
    tbody tr:nth-child(even) { background: #f8fafc; }
    .left { text-align: left; }
    .right { text-align: right; }
    .center { text-align: center; }
    .muted { color: #6b7280; }
    .section-title { margin: 22px 0 8px; font-size: 15px; font-weight: 700; }
    .summary { display: grid; grid-template-columns: repeat(2, minmax(180px, 1fr)); gap: 10px; margin: 16px 0; }
    .summary div { border: 1px solid #d7dde8; padding: 10px; background: #f8fafc; }
    .summary strong { display: block; margin-bottom: 4px; font-size: 12px; color: #4b5563; }
    @media print {
      body { padding: 16mm; }
      button { display: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${escapeHtml(title)}</h1>
    <div class="meta">
      ${Object.entries(metaRows)
        .map(([key, value]) => `<div><span>${escapeHtml(key)}:</span> ${escapeHtml(value)}</div>`)
        .join("")}
    </div>
  </div>
  ${body}
</body>
</html>`;
}

function escapeCsv(value: CsvValue) {
  const text = value == null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function escapeHtml(value: CsvValue) {
  return (value == null ? "" : String(value))
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  compileTemplateForClient,
  defaultTemplates,
  fetchMessageTemplatesFromSupabase,
  type MessageTemplate,
} from "@/data/WhatsappApi";
import { supabase } from "@/lib/supabase";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

// WhatsappApi imports Settings, which imports supabase — the mock above covers
// the whole chain since only fetchMessageTemplatesFromSupabase touches the DB.
const mockSupabase = vi.mocked(supabase, true);

const template = (overrides: Partial<MessageTemplate> = {}): MessageTemplate => ({
  id: "t1",
  name: "Test Template",
  category: "General",
  body: "",
  variables: [],
  isDefault: false,
  ...overrides,
});

const client = { name: "Amit Sharma", pendingFees: 125000, servicesSubscribed: ["GST Returns", "ITR Filing"] };

describe("compileTemplateForClient", () => {
  it("substitutes client_name and firm_name in the compiled text (H7)", () => {
    const t = template({
      body: "Hello {{client_name}}, regards {{firm_name}}",
      variables: ["client_name", "firm_name"],
    });

    const { text, parameters } = compileTemplateForClient(t, client, "FY 2025-26", {
      firmName: "Verma & Associates",
    });

    expect(text).toBe("Hello Amit Sharma, regards Verma & Associates");
    expect(parameters).toEqual(["Amit Sharma", "Verma & Associates"]);
  });

  it("falls back to generic firm/CA labels when no firm profile is supplied", () => {
    const t = template({
      body: "{{firm_name}} / {{ca_name}} / {{ca_phone}}",
      variables: ["firm_name", "ca_name", "ca_phone"],
    });

    const { text } = compileTemplateForClient(t, client, "FY 2025-26");

    expect(text).toBe("Your CA Firm / Your CA / N/A");
  });

  it("strips the 'FY ' prefix from financial_year", () => {
    const t = template({ body: "Year {{financial_year}}", variables: ["financial_year"] });

    const { text, parameters } = compileTemplateForClient(t, client, "FY 2025-26");

    expect(text).toBe("Year 2025-26");
    expect(parameters).toEqual(["2025-26"]);
  });

  it("groups pendingFees as an Indian-formatted amount, or '0' when absent", () => {
    const t = template({ body: "Amt {{amount}}", variables: ["amount"] });

    expect(compileTemplateForClient(t, client, "FY 2025-26").text).toBe("Amt 1,25,000");
    expect(
      compileTemplateForClient(t, { name: "No Fees" }, "FY 2025-26").text,
    ).toBe("Amt 0");
  });

  it("resolves invoice_number to 'N/A' unless overridden (M26)", () => {
    const t = template({ body: "Inv {{invoice_number}}", variables: ["invoice_number"] });

    expect(compileTemplateForClient(t, client, "FY 2025-26").text).toBe("Inv N/A");
    // A real invoice number passed through overrides wins.
    expect(
      compileTemplateForClient(t, client, "FY 2025-26", undefined, { invoice_number: "INV-042" }).text,
    ).toBe("Inv INV-042");
  });

  it("replaces an unknown placeholder with 'N/A' rather than leaving it raw", () => {
    const t = template({ body: "X {{totally_unknown_var}} Y", variables: [] });

    expect(compileTemplateForClient(t, client, "FY 2025-26").text).toBe("X N/A Y");
  });

  it("derives filing_type and service_description from the client's subscribed services", () => {
    const t = template({
      body: "{{filing_type}} | {{service_description}}",
      variables: ["filing_type", "service_description"],
    });

    const { text } = compileTemplateForClient(t, client, "FY 2025-26");

    expect(text).toBe("GST Returns | GST Returns, ITR Filing");
  });

  it("uses sensible defaults for filing_type/service_description with no services", () => {
    const t = template({
      body: "{{filing_type}} | {{service_description}}",
      variables: ["filing_type", "service_description"],
    });

    const { text } = compileTemplateForClient(t, { name: "Bare Client" }, "FY 2025-26");

    expect(text).toBe("Compliance filing | Professional services");
  });

  it("returns parameters in the exact order of template.variables (Meta positional args)", () => {
    const t = template({
      body: "irrelevant",
      variables: ["firm_name", "client_name", "financial_year"],
    });

    const { parameters } = compileTemplateForClient(t, client, "FY 2025-26", { firmName: "Verma & Co" });

    expect(parameters).toEqual(["Verma & Co", "Amit Sharma", "2025-26"]);
  });

  it("compiles a large batch of the same template consistently across many clients", () => {
    const t = template({ body: "Hi {{client_name}} from {{firm_name}}", variables: ["client_name", "firm_name"] });
    const clients = Array.from({ length: 100 }, (_, i) => ({ name: `Client ${i}` }));

    const compiled = clients.map((c) => compileTemplateForClient(t, c, "FY 2025-26", { firmName: "Verma & Co" }));

    expect(compiled).toHaveLength(100);
    expect(compiled[0].text).toBe("Hi Client 0 from Verma & Co");
    expect(compiled[99].text).toBe("Hi Client 99 from Verma & Co");
    expect(compiled.every((r) => r.parameters.length === 2)).toBe(true);
  });
});

describe("fetchMessageTemplatesFromSupabase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps DB rows into MessageTemplate, parsing a JSON-string variables column", async () => {
    const order = vi.fn().mockResolvedValue({
      data: [
        {
          id: "db-1",
          name: "Custom Reminder",
          category: "GST",
          body: "Hello {{client_name}}",
          variables: '["client_name"]',
          is_default: false,
        },
      ],
      error: null,
    });
    mockSupabase.from.mockReturnValue({ select: vi.fn().mockReturnThis(), order } as never);

    const [tpl] = await fetchMessageTemplatesFromSupabase();

    expect(mockSupabase.from).toHaveBeenCalledWith("message_templates");
    expect(tpl).toMatchObject({ id: "db-1", name: "Custom Reminder", category: "GST" });
    // The stringified JSON array is parsed back into a real array.
    expect(tpl.variables).toEqual(["client_name"]);
  });

  // Bug-class 2 (CLAUDE.md): `if (error || !data) return defaultTemplates`
  // silently masks a failed query as a "success" of built-in templates. This
  // pins the documented behaviour so a change to it is a conscious one.
  it("silently falls back to the built-in default templates on query error", async () => {
    const order = vi.fn().mockResolvedValue({ data: null, error: { message: "table missing" } });
    mockSupabase.from.mockReturnValue({ select: vi.fn().mockReturnThis(), order } as never);

    const result = await fetchMessageTemplatesFromSupabase();

    expect(result).toBe(defaultTemplates);
  });
});

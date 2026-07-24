import { supabase } from "@/lib/supabase";
import { fetchFirmProfileFromSupabase } from "@/data/Settings";

export type TemplateCategory = "GST" | "Income Tax" | "TDS" | "ROC" | "Billing" | "General";

export interface MessageTemplate {
  id: string;
  name: string;
  category: TemplateCategory;
  body: string;
  variables: string[];
  isDefault: boolean;
}

/**
 * Fills a template's {{variable}} placeholders for one client, and returns
 * both the human-readable compiled text (for previews / DB logging) and the
 * ordered parameter values matching template.variables (for Meta's
 * positional {{1}}, {{2}}... template parameters). Shared by BulkSender's
 * send flow and DeliveryStatus's retry, so a failed/resent message is
 * recompiled identically to how it was originally built.
 */
export function compileTemplateForClient(
  template: MessageTemplate,
  client: { name: string; pendingFees?: number; servicesSubscribed?: string[] },
  financialYear: string,
  firm?: { firmName?: string; caName?: string; phone?: string }
): { text: string; parameters: string[] } {
  const replacements: Record<string, string> = {
    client_name: client.name,
    firm_name: firm?.firmName || "Your CA Firm",
    ca_name: firm?.caName || "Your CA",
    ca_phone: firm?.phone || "N/A",
    due_date: new Date().toLocaleDateString("en-IN"),
    filing_type: client.servicesSubscribed?.[0] ?? "Compliance filing",
    doc_name: "N/A",
    document_list: "N/A",
    upload_link: "N/A",
    amount: client.pendingFees ? client.pendingFees.toLocaleString("en-IN") : "0",
    financial_year: financialYear.replace("FY ", ""),
    invoice_number: "N/A",
    service_description: client.servicesSubscribed?.join(", ") || "Professional services",
    upi_id: "N/A",
    ack_number: "N/A",
    filing_date: new Date().toLocaleDateString("en-IN"),
    payment_date: new Date().toLocaleDateString("en-IN"),
    receipt_number: "N/A",
    instalment_number: "N/A",
    percentage: "N/A",
    year: String(new Date().getFullYear()),
  };

  const text = template.body.replace(/\{\{(\w+)\}\}/g, (_match, key) => replacements[key] ?? "N/A");
  const parameters = template.variables.map((key) => replacements[key] ?? "N/A");
  return { text, parameters };
}

/**
 * One-click "remind this single client" used by the Fees Dashboard and
 * Pending Documents pages — picks a live template by (partial) name match,
 * compiles it for this one client with the real firm profile, and sends via
 * the same Meta path as the Bulk Sender. Throws with a clear message rather
 * than silently no-op'ing if the client has no phone or no matching
 * template exists, so the caller's catch block can show a real error
 * instead of a fake success toast (ISSUES.md C6).
 */
export async function sendQuickReminder(
  client: { id: string; name: string; phone: string; pendingFees?: number; servicesSubscribed?: string[] },
  templateNameContains: string,
  financialYear: string
): Promise<void> {
  if (!client.phone) throw new Error(`${client.name} has no phone number on file.`);

  const [templates, firm] = await Promise.all([
    fetchMessageTemplatesFromSupabase(),
    fetchFirmProfileFromSupabase().catch(() => null),
  ]);

  const template = templates.find((t) => t.name.toLowerCase().includes(templateNameContains.toLowerCase()));
  if (!template) throw new Error(`No "${templateNameContains}" template found — create one in WhatsApp > Templates first.`);

  const { text, parameters } = compileTemplateForClient(template, client, financialYear, firm ?? undefined);

  await sendBulkWhatsAppMessages(
    [{ id: client.id, name: client.name, phone: client.phone }],
    template,
    { [client.id]: text },
    { [client.id]: parameters }
  );
}

export interface SentMessage {
  id: string;
  clientId: string;
  clientName: string;
  phone: string;
  templateName: string;
  message: string;
  sentAt: string;
  status: "sent" | "delivered" | "read" | "failed";
  failReason?: string;
}

export interface ReceivedMessage {
  id: string;
  clientId: string;
  clientName: string;
  phone: string;
  message: string;
  receivedAt: string;
  isRead: boolean;
}

export const defaultTemplates: MessageTemplate[] = [
  {
    id: "t1",
    name: "Deadline Reminder (General)",
    category: "General",
    body: "Hello {{client_name}}, This is a reminder from {{firm_name}} that your {{filing_type}} is due on {{due_date}}. Please share the required documents at the earliest so we can file on time. For any queries, call us: {{ca_phone}}",
    variables: ["client_name", "firm_name", "filing_type", "due_date", "ca_phone"],
    isDefault: true,
  },
  {
    id: "t2",
    name: "Document Request",
    category: "General",
    body: "Hello {{client_name}}, For your {{filing_type}} filing, we need the following documents: {{document_list}} Please upload them here: {{upload_link}} Kindly submit by: {{due_date}} — {{firm_name}}",
    variables: ["client_name", "filing_type", "document_list", "upload_link", "due_date", "firm_name"],
    isDefault: true,
  },
  {
    id: "t3",
    name: "Filing Completed",
    category: "General",
    body: "Dear {{client_name}}, Your {{filing_type}} has been successfully filed. Acknowledgement Number: {{ack_number}} Date of Filing: {{filing_date}} The acknowledgement PDF is attached. Please save it for your records. — {{firm_name}}",
    variables: ["client_name", "filing_type", "ack_number", "filing_date", "firm_name"],
    isDefault: true,
  },
  {
    id: "t4",
    name: "Invoice / Fee Reminder",
    category: "Billing",
    body: "Hello {{client_name}}, Please find your invoice from {{firm_name}}: Invoice No: {{invoice_number}} Amount: ₹{{amount}} (+ GST as applicable) Services: {{service_description}} Due Date: {{due_date}} UPI: {{upi_id}} | Bank details attached. — {{ca_name}}, {{firm_name}}",
    variables: ["client_name", "firm_name", "invoice_number", "amount", "service_description", "due_date", "upi_id", "ca_name"],
    isDefault: true,
  },
  {
    id: "t5",
    name: "Payment Received Confirmation",
    category: "Billing",
    body: "Dear {{client_name}}, Thank you! We have received your payment of ₹{{amount}}. Receipt No: {{receipt_number}} | Date: {{payment_date}} — {{firm_name}}",
    variables: ["client_name", "amount", "receipt_number", "payment_date", "firm_name"],
    isDefault: true,
  },
  {
    id: "t6",
    name: "GST Annual Return Reminder (GSTR-9)",
    category: "GST",
    body: "Hello {{client_name}}, Your GST Annual Return (GSTR-9) for FY {{financial_year}} needs to be filed. Due Date: 31st December {{year}} Please keep all your purchase and sale invoices for FY {{financial_year}} ready. — {{firm_name}}",
    variables: ["client_name", "financial_year", "year", "firm_name"],
    isDefault: true,
  },
  {
    id: "t7",
    name: "ITR Season Reminder",
    category: "Income Tax",
    body: "Income Tax Filing Reminder\nHello {{client_name}}, It is time to file your Income Tax Return for FY {{financial_year}}. Due Date: {{due_date}}\nPlease arrange the following documents:\n- Form 16 (for salaried individuals)\n- Bank statements (April to March)\n- Investment proofs (LIC, PPF, ELSS, NSC, etc.)\n- Home loan interest certificate (if applicable)\n- Any capital gains statements\n— {{firm_name}}",
    variables: ["client_name", "financial_year", "due_date", "firm_name"],
    isDefault: true,
  },
  {
    id: "t8",
    name: "Advance Tax Reminder",
    category: "Income Tax",
    body: "Advance Tax Payment Reminder\nHello {{client_name}}, Your advance tax instalment is due.\nInstalment: {{instalment_number}} ({{percentage}}% of estimated annual tax)\nDue Date: {{due_date}}\nPlease pay the challan on time. Late payment attracts interest under Section 234B / 234C at 1% per month.\n— {{firm_name}}",
    variables: ["client_name", "instalment_number", "percentage", "due_date", "firm_name"],
    isDefault: true,
  },
  {
    id: "t9",
    name: "New Financial Year Welcome",
    category: "General",
    body: "Hello {{client_name}}, Wishing you a very productive Financial Year {{financial_year}}! {{firm_name}} will continue to handle all your compliance needs. If there are any changes in your business — new income sources, GST turnover change, director change, etc. — please inform us so we can update your filings accordingly. — {{ca_name}}",
    variables: ["client_name", "financial_year", "firm_name", "ca_name"],
    isDefault: true,
  },
];

const parseVariables = (value: any): string[] => {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

export async function fetchMessageTemplatesFromSupabase(): Promise<MessageTemplate[]> {
  const { data, error } = await supabase
    .from("message_templates")
    .select(`id, name, category, body, variables, is_default`)
    .order("name", { ascending: true });

  if (error || !data) return defaultTemplates;

  return data.map((row: any) => ({
    id: row.id,
    name: row.name,
    category: row.category as TemplateCategory,
    body: row.body,
    variables: parseVariables(row.variables),
    isDefault: Boolean(row.is_default),
  }));
}

export async function saveMessageTemplateToSupabase(template: Omit<MessageTemplate, "id"> & { id?: string }): Promise<MessageTemplate> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: staffRow, error: staffErr } = await supabase
    .from("staff")
    .select("firm_id")
    .eq("auth_user_id", user.id)
    .single();
  if (staffErr || !staffRow?.firm_id) throw new Error("Unable to identify firm for current user");

  const payload: Record<string, any> = {
    firm_id: staffRow.firm_id,
    name: template.name,
    category: template.category,
    body: template.body,
    variables: template.variables,
    is_default: template.isDefault,
    user_id: user.id,
  };

  if (template.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(template.id)) {
    payload.id = template.id;
  }

  const { data, error } = await supabase
    .from("message_templates")
    .upsert(payload, { onConflict: "id" })
    .select()
    .single();

  if (error || !data) throw error;

  return {
    id: data.id,
    name: data.name,
    category: data.category as TemplateCategory,
    body: data.body,
    variables: parseVariables(data.variables),
    isDefault: Boolean(data.is_default),
  };
}

export async function deleteMessageTemplateFromSupabase(id: string): Promise<void> {
  const { error } = await supabase.from("message_templates").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchSentMessagesFromSupabase(): Promise<SentMessage[]> {
  const { data, error } = await supabase
    .from("whatsapp_sent_messages")
    .select(`id, client_id, phone, template_name, message, sent_at, status, clients(name)`)
    .order("sent_at", { ascending: false });

  if (error) {
    console.warn("fetchSentMessagesFromSupabase:", error.message);
    return [];
  }

  return (data ?? []).map((row: any) => ({
    id: row.id,
    clientId: row.client_id,
    clientName: row.clients?.name ?? "Unknown Client",
    phone: row.phone,
    templateName: row.template_name,
    message: row.message,
    sentAt: row.sent_at,
    status: row.status,
    failReason: undefined,
  }));
}

export async function fetchReceivedMessagesFromSupabase(): Promise<ReceivedMessage[]> {
  const { data, error } = await supabase
    .from("whatsapp_received_messages")
    .select(`id, client_id, phone, message, received_at, is_read, clients(name)`)
    .order("received_at", { ascending: false });

  if (error) {
    console.warn("fetchReceivedMessagesFromSupabase:", error.message);
    return [];
  }

  return (data ?? []).map((row: any) => ({
    id: row.id,
    clientId: row.client_id,
    clientName: row.clients?.name ?? "Unknown Client",
    phone: row.phone,
    message: row.message,
    receivedAt: row.received_at,
    isRead: Boolean(row.is_read),
  }));
}

export async function markReceivedMessageRead(id: string): Promise<void> {
  const { error } = await supabase
    .from("whatsapp_received_messages")
    .update({ is_read: true })
    .eq("id", id);
  if (error) throw error;
}

/**
 * Meta requires WhatsApp template names in lowercase snake_case, matching
 * whatever the firm registered and got approved in Meta Business Manager.
 * This derives that name from the internal display name (e.g. "GST Filing
 * Reminder" -> "gst_filing_reminder") — the firm must register a template
 * with this exact name and body parameters matching `template.variables`
 * (same count and order) before bulk sends will deliver the real content.
 * Until that registration exists, Meta will reject the send and the error
 * will surface to the user rather than silently sending placeholder text.
 */
interface WhatsAppSendResult {
  phone: string;
  success: boolean;
  error?: string;
  wamid?: string;
}

function toMetaTemplateName(displayName: string): string {
  return displayName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * LIVE META API INTEGRATION
 * This function calls the secure Supabase Edge Function to dispatch
 * the messages via WhatsApp Cloud API, then logs the outbound messages
 * to your database so the Delivery Status UI updates instantly.
 */
export async function sendBulkWhatsAppMessages(
  clients: { id: string; name: string; phone: string }[],
  template: MessageTemplate,
  compiledMessages: Record<string, string>, // Map of clientId -> final text (for DB logging)
  parametersByClientId: Record<string, string[]> // Map of clientId -> ordered values matching template.variables (for the Meta API call)
): Promise<void> {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Authentication required to send messages.");

  // STEP 1: Dispatch to Meta via Secure Edge Function, using the template the
  // user actually selected and that client's real compiled parameter values.
  const { data: edgeData, error: edgeError } = await supabase.functions.invoke('send-whatsapp', {
    body: {
      templateName: toMetaTemplateName(template.name),
      languageCode: "en_US",
      recipients: clients.map(c => ({
        phone: c.phone,
        parameters: parametersByClientId[c.id] ?? [],
      })),
    }
  });

  if (edgeError) {
    console.error("Edge Function Error:", edgeError);
    let detail = "Failed to communicate with WhatsApp API.";
    const response = (edgeError as any)?.context;
    if (response instanceof Response) {
      const body = await response.clone().json().catch(() => null);
      if (body?.error) detail = body.error;
    }
    throw new Error(detail);
  }

  const results: WhatsAppSendResult[] = Array.isArray(edgeData?.results) ? edgeData.results : [];
  const resultByPhone = new Map<string, WhatsAppSendResult>(results.map((result) => [result.phone, result]));

  // STEP 2: Log the dispatched messages to the database to update the UI
  const logsToInsert = clients.map(client => ({
    client_id: client.id,
    phone: client.phone,
    template_name: template.name,
    message: compiledMessages[client.id] || "Document request sent.",
    status: resultByPhone.get(client.phone)?.success ? "sent" : "failed",
    wamid: resultByPhone.get(client.phone)?.wamid ?? null,
  }));

  const { error: dbError } = await supabase
    .from("whatsapp_sent_messages")
    .insert(logsToInsert);

  if (dbError) {
    console.error("Database Logging Error:", dbError);
    throw new Error("Messages sent, but failed to log to database.");
  }

  const failed = results.filter((result) => !result.success);
  if (!edgeData?.success || failed.length > 0) {
    const reason = failed[0]?.error;
    console.error("META API EXACT ERROR:", reason);

    throw new Error(
      reason
        ? `${failed.length} message(s) failed: ${reason}`
        : "WhatsApp did not confirm that all messages were sent.",
    );
  }
}

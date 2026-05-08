import { supabase } from "@/lib/supabase";

export type TemplateCategory = "GST" | "Income Tax" | "TDS" | "ROC" | "Billing" | "General";

export interface MessageTemplate {
  id: string;
  name: string;
  category: TemplateCategory;
  body: string;
  variables: string[];
  isDefault: boolean;
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

export const mockSentMessages: SentMessage[] = [
  { id: "s1", clientId: "1", clientName: "Ramesh Kumar Gupta", phone: "9876543210", templateName: "Deadline Reminder", message: "Hello Ramesh Kumar Gupta, your GSTR-3B is due on 20/04/2025...", sentAt: "2025-04-13T10:30:00", status: "read" },
  { id: "s2", clientId: "2", clientName: "Mehta Traders", phone: "9123456789", templateName: "Deadline Reminder", message: "Hello Mehta Traders, your GSTR-3B is due on 20/04/2025...", sentAt: "2025-04-13T10:30:00", status: "delivered" },
  { id: "s3", clientId: "3", clientName: "Priya Sharma", phone: "9988776655", templateName: "Document Request", message: "Hello Priya Sharma, for your ITR-1 filing we need Form 16...", sentAt: "2025-04-12T14:00:00", status: "sent" },
  { id: "s4", clientId: "4", clientName: "Sunrise Technologies Pvt Ltd", phone: "9001234567", templateName: "Invoice Reminder", message: "Hello Sunrise Technologies, your invoice INV-2526-0012...", sentAt: "2025-04-11T09:15:00", status: "failed", failReason: "Number not on WhatsApp" },
  { id: "s5", clientId: "5", clientName: "Gupta & Sons HUF", phone: "9871234560", templateName: "Filing Completed", message: "Dear Gupta & Sons HUF, your ITR-2 has been filed...", sentAt: "2025-04-10T16:45:00", status: "read" },
];

export const mockReceivedMessages: ReceivedMessage[] = [
  { id: "r1", clientId: "1", clientName: "Ramesh Kumar Gupta", phone: "9876543210", message: "Sir, I will send Form 16 by tomorrow evening.", receivedAt: "2025-04-13T11:00:00", isRead: false },
  { id: "r2", clientId: "3", clientName: "Priya Sharma", phone: "9988776655", message: "Bank statement uploaded. Please check.", receivedAt: "2025-04-12T15:30:00", isRead: true },
  { id: "r3", clientId: "2", clientName: "Mehta Traders", phone: "9123456789", message: "Can you also file GSTR-9 this year? What will be the additional fees?", receivedAt: "2025-04-12T12:00:00", isRead: false },
  { id: "r4", clientId: "6", clientName: "Patel Associates LLP", phone: "9812345678", message: "Payment done via NEFT. Sending screenshot.", receivedAt: "2025-04-11T17:20:00", isRead: true },
  { id: "r5", clientId: "7", clientName: "Anil Joshi", phone: "9765432109", message: "GST number change ho gaya hai, new number: 27ABCPJ6789N2Z7", receivedAt: "2025-04-10T10:00:00", isRead: false },
  { id: "r6", clientId: "5", clientName: "Gupta & Sons HUF", phone: "9871234560", message: "Thank you for filing the return. Received acknowledgement.", receivedAt: "2025-04-10T18:00:00", isRead: true },
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
    .from("whatsapp_templates")
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

export async function saveMessageTemplateToSupabase(template: MessageTemplate): Promise<MessageTemplate> {
  const { data, error } = await supabase
    .from("whatsapp_templates")
    .upsert({
      id: template.id,
      name: template.name,
      category: template.category,
      body: template.body,
      variables: template.variables,
      is_default: template.isDefault,
    }, { onConflict: "id" })
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
  const { error } = await supabase.from("whatsapp_templates").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchSentMessagesFromSupabase(): Promise<SentMessage[]> {
  const { data, error } = await supabase
    .from("whatsapp_sent_messages")
    .select(`id, client_id, client_name, phone, template_name, message, sent_at, status, fail_reason`)
    .order("sent_at", { ascending: false });

  if (error || !data) return mockSentMessages;

  return data.map((row: any) => ({
    id: row.id,
    clientId: row.client_id,
    clientName: row.client_name,
    phone: row.phone,
    templateName: row.template_name,
    message: row.message,
    sentAt: row.sent_at,
    status: row.status,
    failReason: row.fail_reason,
  }));
}

export async function fetchReceivedMessagesFromSupabase(): Promise<ReceivedMessage[]> {
  const { data, error } = await supabase
    .from("whatsapp_received_messages")
    .select(`id, client_id, client_name, phone, message, received_at, is_read`)
    .order("received_at", { ascending: false });

  if (error || !data) return mockReceivedMessages;

  return data.map((row: any) => ({
    id: row.id,
    clientId: row.client_id,
    clientName: row.client_name,
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

import { supabase } from "@/lib/supabase";

export interface FirmProfile {
  firmName: string;
  caName: string;
  icaiMembershipNo: string;
  logoUrl?: string;
  address: string;
  city: string;
  state: string;
  pinCode: string;
  phone: string;
  email: string;
  website?: string;
  firmPan: string;
  firmGstin?: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  ifscCode: string;
  branchName: string;
  upiId?: string;
}

export interface StaffMember {
  id: string;
  name: string;
  role: "Senior CA" | "Article Clerk" | "Admin Staff";
  email: string;
  phone: string;
  isActive: boolean;
  joinedDate: string;
  tasksCompleted: number;
  tasksPending: number;
}

export interface InvoiceSettings {
  prefix: string;
  resetPerFY: boolean;
  paymentTerms: string;
  footerNotes: string;
  gstRate: number;
  signatoryName: string;
  signatureUrl?: string;
}

export interface ComplianceUpdate {
  id: string;
  title: string;
  body: string;
  severity: "info" | "important" | "urgent";
  publishedAt: string;
}

export interface SubscriptionPlan {
  name: "Starter" | "Professional" | "Firm";
  price: number;
  clientLimit: number;
  staffLimit: number;
  features: string[];
}

export interface FilingCategory {
  id: string;
  label: string;
  enabled: boolean;
}

export const mockFirmProfile: FirmProfile = {
  firmName: "Sharma & Associates",
  caName: "CA Rajesh Sharma",
  icaiMembershipNo: "123456",
  address: "301, Trade Center, Nehru Place",
  city: "New Delhi",
  state: "Delhi",
  pinCode: "110019",
  phone: "9876543210",
  email: "rajesh@sharma-ca.in",
  website: "www.sharma-ca.in",
  firmPan: "AADFS1234K",
  firmGstin: "07AADFS1234K1Z5",
  bankName: "HDFC Bank",
  accountName: "Sharma & Associates",
  accountNumber: "50100123456789",
  ifscCode: "HDFC0001234",
  branchName: "Nehru Place Branch",
  upiId: "sharma.ca@hdfcbank",
};

export const mockStaff: StaffMember[] = [
  { id: "1", name: "Priya Mehta", role: "Senior CA", email: "priya@sharma-ca.in", phone: "9876543211", isActive: true, joinedDate: "2023-04-01", tasksCompleted: 145, tasksPending: 12 },
  { id: "2", name: "Amit Kumar", role: "Article Clerk", email: "amit@sharma-ca.in", phone: "9876543212", isActive: true, joinedDate: "2024-01-15", tasksCompleted: 78, tasksPending: 8 },
  { id: "3", name: "Neha Singh", role: "Article Clerk", email: "neha@sharma-ca.in", phone: "9876543213", isActive: true, joinedDate: "2024-06-01", tasksCompleted: 42, tasksPending: 15 },
  { id: "4", name: "Rohit Verma", role: "Admin Staff", email: "rohit@sharma-ca.in", phone: "9876543214", isActive: false, joinedDate: "2023-08-01", tasksCompleted: 30, tasksPending: 0 },
];

export const mockInvoiceSettings: InvoiceSettings = {
  prefix: "INV",
  resetPerFY: true,
  paymentTerms: "Payment due within 15 days of invoice date",
  footerNotes: "Thank you for your business. For queries, contact us at rajesh@sharma-ca.in",
  gstRate: 18,
  signatoryName: "CA Rajesh Sharma",
};

export const mockComplianceUpdates: ComplianceUpdate[] = [
  { id: "1", title: "ITR Non-Audit Deadline Extended", body: "CBDT has extended the ITR filing deadline for non-audit cases to 15th September 2025 vide Circular No. 9/2025. Updated in CA Munim on 30th July 2025.", severity: "important", publishedAt: "2025-07-30" },
  { id: "2", title: "GSTR-9 Due Date Unchanged", body: "The due date for GSTR-9 (Annual Return) for FY 2024-25 remains 31st December 2025. No extension announced.", severity: "info", publishedAt: "2025-07-15" },
  { id: "3", title: "TDS Return Q1 Deadline", body: "TDS return for Q1 (April-June 2025) is due on 31st July 2025. Ensure all Form 26Q/24Q are filed.", severity: "urgent", publishedAt: "2025-07-01" },
  { id: "4", title: "New GST Rate Changes", body: "GST Council has revised rates on select services effective 1st August 2025. Review client billing accordingly.", severity: "important", publishedAt: "2025-06-28" },
];

export const subscriptionPlans: SubscriptionPlan[] = [
  { name: "Starter", price: 0, clientLimit: 25, staffLimit: 1, features: ["25 clients", "1 user", "Basic reports", "WhatsApp templates", "Invoice generation"] },
  { name: "Professional", price: 999, clientLimit: 150, staffLimit: 3, features: ["150 clients", "3 users", "Advanced reports", "Bulk WhatsApp", "Priority support", "Custom templates"] },
  { name: "Firm", price: 2499, clientLimit: 999, staffLimit: 10, features: ["Unlimited clients", "10 users", "All reports", "API access", "Dedicated support", "White-label invoices", "Data backup"] },
];

export const filingCategories: FilingCategory[] = [
  { id: "gstr1", label: "GSTR-1 (Outward Supplies)", enabled: true },
  { id: "gstr3b", label: "GSTR-3B (Summary Return)", enabled: true },
  { id: "gstr9", label: "GSTR-9 (Annual Return)", enabled: true },
  { id: "itr", label: "ITR (Income Tax Return)", enabled: true },
  { id: "tds", label: "TDS Returns (24Q/26Q)", enabled: true },
  { id: "advance_tax", label: "Advance Tax Installments", enabled: true },
  { id: "roc", label: "ROC Filings (AOC-4, MGT-7)", enabled: false },
  { id: "dir3kyc", label: "DIR-3 KYC", enabled: false },
  { id: "audit", label: "Tax Audit (44AB)", enabled: true },
  { id: "tcs", label: "TCS Returns", enabled: false },
];

const toBool = (value: any) => typeof value === "boolean" ? value : String(value).toLowerCase() === "true";

export async function fetchFirmProfileFromSupabase(): Promise<FirmProfile> {
  const { data, error } = await supabase.from("firm_profile").select(`
    firm_name,
    ca_name,
    icai_membership_no,
    logo_url,
    address,
    city,
    state,
    pin_code,
    phone,
    email,
    website,
    firm_pan,
    firm_gstin,
    bank_name,
    account_name,
    account_number,
    ifsc_code,
    branch_name,
    upi_id
  `).single();

  if (error || !data) return mockFirmProfile;

  return {
    firmName: data.firm_name ?? mockFirmProfile.firmName,
    caName: data.ca_name ?? mockFirmProfile.caName,
    icaiMembershipNo: data.icai_membership_no ?? mockFirmProfile.icaiMembershipNo,
    logoUrl: data.logo_url ?? mockFirmProfile.logoUrl,
    address: data.address ?? mockFirmProfile.address,
    city: data.city ?? mockFirmProfile.city,
    state: data.state ?? mockFirmProfile.state,
    pinCode: data.pin_code ?? mockFirmProfile.pinCode,
    phone: data.phone ?? mockFirmProfile.phone,
    email: data.email ?? mockFirmProfile.email,
    website: data.website ?? mockFirmProfile.website,
    firmPan: data.firm_pan ?? mockFirmProfile.firmPan,
    firmGstin: data.firm_gstin ?? mockFirmProfile.firmGstin,
    bankName: data.bank_name ?? mockFirmProfile.bankName,
    accountName: data.account_name ?? mockFirmProfile.accountName,
    accountNumber: data.account_number ?? mockFirmProfile.accountNumber,
    ifscCode: data.ifsc_code ?? mockFirmProfile.ifscCode,
    branchName: data.branch_name ?? mockFirmProfile.branchName,
    upiId: data.upi_id ?? mockFirmProfile.upiId,
  };
}

export async function saveFirmProfileToSupabase(profile: FirmProfile): Promise<FirmProfile> {
  const { error } = await supabase.from("firm_profile").upsert({
    id: 1,
    firm_name: profile.firmName,
    ca_name: profile.caName,
    icai_membership_no: profile.icaiMembershipNo,
    logo_url: profile.logoUrl,
    address: profile.address,
    city: profile.city,
    state: profile.state,
    pin_code: profile.pinCode,
    phone: profile.phone,
    email: profile.email,
    website: profile.website,
    firm_pan: profile.firmPan,
    firm_gstin: profile.firmGstin,
    bank_name: profile.bankName,
    account_name: profile.accountName,
    account_number: profile.accountNumber,
    ifsc_code: profile.ifscCode,
    branch_name: profile.branchName,
    upi_id: profile.upiId,
  }, { onConflict: "id" });

  if (error) throw error;
  return profile;
}

export async function fetchStaffFromSupabase(): Promise<StaffMember[]> {
  const { data, error } = await supabase
    .from("staff")
    .select(`id, name, role, email, phone, is_active, joined_date, tasks_completed, tasks_pending`)
    .order("joined_date", { ascending: false });

  if (error || !data) return mockStaff;

  return data.map((row: any) => ({
    id: row.id,
    name: row.name,
    role: row.role,
    email: row.email,
    phone: row.phone,
    isActive: toBool(row.is_active),
    joinedDate: row.joined_date ?? new Date().toISOString().split("T")[0],
    tasksCompleted: Number(row.tasks_completed ?? 0),
    tasksPending: Number(row.tasks_pending ?? 0),
  }));
}

export async function addStaffToSupabase(staff: Omit<StaffMember, "id" | "joinedDate" | "tasksCompleted" | "tasksPending">): Promise<StaffMember> {
  const { data, error } = await supabase.from("staff").insert([{
    name: staff.name,
    role: staff.role,
    email: staff.email,
    phone: staff.phone,
    is_active: staff.isActive,
  }]).select().single();
  if (error || !data) throw error;
  return {
    id: data.id,
    name: data.name,
    role: data.role,
    email: data.email,
    phone: data.phone,
    isActive: toBool(data.is_active),
    joinedDate: data.joined_date ?? new Date().toISOString().split("T")[0],
    tasksCompleted: Number(data.tasks_completed ?? 0),
    tasksPending: Number(data.tasks_pending ?? 0),
  };
}

export async function updateStaffActiveStatus(id: string, isActive: boolean): Promise<void> {
  const { error } = await supabase.from("staff").update({ is_active: isActive }).eq("id", id);
  if (error) throw error;
}

export async function fetchInvoiceSettingsFromSupabase(): Promise<InvoiceSettings> {
  const { data, error } = await supabase.from("invoice_settings").select(`
    prefix,
    reset_per_fy,
    payment_terms,
    footer_notes,
    gst_rate,
    signatory_name,
    signature_url
  `).single();

  if (error || !data) return mockInvoiceSettings;

  return {
    prefix: data.prefix ?? mockInvoiceSettings.prefix,
    resetPerFY: toBool(data.reset_per_fy),
    paymentTerms: data.payment_terms ?? mockInvoiceSettings.paymentTerms,
    footerNotes: data.footer_notes ?? mockInvoiceSettings.footerNotes,
    gstRate: Number(data.gst_rate ?? mockInvoiceSettings.gstRate),
    signatoryName: data.signatory_name ?? mockInvoiceSettings.signatoryName,
    signatureUrl: data.signature_url ?? mockInvoiceSettings.signatureUrl,
  };
}

export async function saveInvoiceSettingsToSupabase(settings: InvoiceSettings): Promise<InvoiceSettings> {
  const { error } = await supabase.from("invoice_settings").upsert({
    id: 1,
    prefix: settings.prefix,
    reset_per_fy: settings.resetPerFY,
    payment_terms: settings.paymentTerms,
    footer_notes: settings.footerNotes,
    gst_rate: settings.gstRate,
    signatory_name: settings.signatoryName,
    signature_url: settings.signatureUrl,
  }, { onConflict: "id" });

  if (error) throw error;
  return settings;
}

export async function fetchComplianceUpdatesFromSupabase(): Promise<ComplianceUpdate[]> {
  const { data, error } = await supabase
    .from("compliance_updates")
    .select(`id, title, body, severity, published_at`)
    .order("published_at", { ascending: false });

  if (error || !data) return mockComplianceUpdates;

  return data.map((row: any) => ({
    id: row.id,
    title: row.title,
    body: row.body,
    severity: row.severity,
    publishedAt: row.published_at ?? row.publishedAt,
  }));
}

export async function fetchSubscriptionPlansFromSupabase(): Promise<SubscriptionPlan[]> {
  const { data, error } = await supabase
    .from("subscription_plans")
    .select(`name, price, client_limit, staff_limit, features`)
    .order("price", { ascending: true });

  if (error || !data) return subscriptionPlans;

  return data.map((row: any) => ({
    name: row.name as SubscriptionPlan["name"],
    price: Number(row.price ?? 0),
    clientLimit: Number(row.client_limit ?? 0),
    staffLimit: Number(row.staff_limit ?? 0),
    features: row.features ?? [],
  }));
}

export async function fetchFilingCategoriesFromSupabase(): Promise<FilingCategory[]> {
  const { data, error } = await supabase
    .from("filing_categories")
    .select(`id, label, enabled`)
    .order("id", { ascending: true });

  if (error || !data) return filingCategories;

  return data.map((row: any) => ({
    id: row.id,
    label: row.label,
    enabled: toBool(row.enabled),
  }));
}

export async function saveFilingCategoriesToSupabase(categories: FilingCategory[]): Promise<FilingCategory[]> {
  const { error } = await supabase.from("filing_categories").upsert(categories.map((category) => ({
    id: category.id,
    label: category.label,
    enabled: category.enabled,
  })), { onConflict: "id" });

  if (error) throw error;
  return categories;
}

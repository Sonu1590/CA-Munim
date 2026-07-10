import { supabase } from "@/lib/supabase";

export interface FirmProfile {
  practiceType?: "firm" | "solo";
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
  role: "admin" | "staff";
  jobTitle?: string;
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
  id: string;
  name: "Starter" | "Professional" | "Firm" | "Founding Member";
  price: number; // monthly
  priceAnnual: number; // full yearly total, not derived from `price` — the two are independently priced
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
  firmPan: "AADFS1234K",
  firmGstin: "07AADFS1234K1Z5",
  bankName: "HDFC Bank",
  accountName: "Sharma & Associates",
  accountNumber: "50100123456789",
  ifscCode: "HDFC0001234",
  branchName: "Nehru Place Branch",
  upiId: "sharma.ca@hdfcbank",
};

export const mockStaff: StaffMember[] = [];

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
  { id: "", name: "Starter", price: 0, priceAnnual: 0, clientLimit: 25, staffLimit: 1, features: ["25 clients", "1 user", "Manual WhatsApp reminders only"] },
  { id: "", name: "Professional", price: 417, priceAnnual: 4999, clientLimit: 150, staffLimit: 3, features: ["150 clients", "3 users", "Automated WhatsApp reminders (~500 utility messages/month, then top-up)", "All reports"] },
  { id: "", name: "Firm", price: 833, priceAnnual: 9999, clientLimit: 999, staffLimit: 10, features: ["Unlimited clients", "10 users", "White-label invoices", "Priority support"] },
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

const toStaffRole = (value: any): StaffMember["role"] => (value === "admin" ? "admin" : "staff");

const extractSupabaseError = (err: any): string => {
  if (!err) return "";
  if (typeof err === "string") return err;
  if (typeof err.message === "string") return err.message;
  if (typeof err.error === "string") return err.error;
  if (typeof err.details === "string") return err.details;
  if (typeof err.hint === "string") return err.hint;
  return String(err);
};

const getFirmProfileError = (err: any) => {
  const message = extractSupabaseError(err).toLowerCase();
  if (message.includes("row-level security") || message.includes("policy")) {
    return new Error("Unable to load firm profile because of permissions. Check your Supabase RLS policy for the firms table.");
  }
  return new Error(extractSupabaseError(err) || "Unable to load firm profile.");
};

const getStaffError = (err: any, fallback = "Unable to load staff members.") => {
  // Check for unique constraint violation (duplicate email)
  if (err.code === '23505' || (err.message && err.message.includes('duplicate key'))) {
    if (err.message && err.message.includes('staff_email')) {
      return new Error("A staff member with this email already exists.");
    }
  }
  
  const message = extractSupabaseError(err).toLowerCase();
  if (message.includes("row-level security") || message.includes("policy") || message.includes("permission denied")) {
    return new Error("Unable to load staff because of permissions. Please contact your firm admin.");
  }
  return new Error(extractSupabaseError(err) || fallback);
};

async function getCurrentFirmId(): Promise<string> {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) throw getStaffError(authError, "Unable to verify your session.");
  if (!user) throw new Error("Please sign in again to manage staff.");

  const { data: staffRow, error: staffError } = await supabase
    .from("staff")
    .select("firm_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (staffError) throw getStaffError(staffError, "Unable to identify your firm.");
  if (!staffRow?.firm_id) {
    throw new Error("Your account is not linked to a firm. Please complete setup or contact support.");
  }

  return staffRow.firm_id;
}

export async function fetchFirmProfileFromSupabase(): Promise<FirmProfile> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const selectFields = `
      name,
      ca_name,
      icai_number,
      logo_url,
      address,
      city,
      state,
      pan,
      gstin,
      phone,
      email,
      bank_details,
      upi_id,
      practice_type
    `;

  // Firms have their own auto-generated UUID — resolve via the staff record,
  // not by assuming firms.id === user.id.
  const { data: staffData, error: staffError } = await supabase
    .from('staff')
    .select(`firms(${selectFields})`)
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (staffError) throw getFirmProfileError(staffError);

  const profileData = (staffData as any)?.firms;
  if (!profileData) {
    throw new Error("Firm profile not found.");
  }

  const bankDetails = profileData.bank_details
    ? typeof profileData.bank_details === "string"
      ? JSON.parse(profileData.bank_details)
      : profileData.bank_details
    : {};

  return {
    practiceType: profileData.practice_type ?? 'firm',
    firmName: profileData.name ?? '',
    caName: profileData.ca_name ?? '',
    icaiMembershipNo: profileData.icai_number ?? '',
    logoUrl: profileData.logo_url ?? '',
    address: profileData.address ?? '',
    city: profileData.city ?? '',
    state: profileData.state ?? '',
    pinCode: '', // Not in firms table
    phone: profileData.phone ?? '',
    email: profileData.email ?? '',
    firmPan: profileData.pan ?? '',
    firmGstin: profileData.gstin ?? '',
    bankName: bankDetails.bank_name ?? '',
    accountName: bankDetails.account_name ?? '',
    accountNumber: bankDetails.account_number ?? '',
    ifscCode: bankDetails.ifsc_code ?? '',
    branchName: bankDetails.branch_name ?? '',
    upiId: profileData.upi_id ?? '',
  };
}

export async function saveFirmProfileToSupabase(profile: FirmProfile): Promise<FirmProfile> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: staffRow, error: staffError } = await supabase
    .from('staff')
    .select('firm_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (staffError) throw staffError;
  if (!staffRow?.firm_id) {
    throw new Error("Your account setup is incomplete. Please sign out and sign back in, or contact support.");
  }

  const bankDetails = {
    bank_name: profile.bankName,
    account_name: profile.accountName,
    account_number: profile.accountNumber,
    ifsc_code: profile.ifscCode,
    branch_name: profile.branchName,
  };

  const row = {
    practice_type: profile.practiceType ?? 'firm',
    name: profile.firmName,
    ca_name: profile.caName,
    icai_number: profile.icaiMembershipNo,
    logo_url: profile.logoUrl,
    address: profile.address,
    city: profile.city,
    state: profile.state,
    pan: profile.firmPan,
    gstin: profile.firmGstin,
    phone: profile.phone,
    email: profile.email,
    bank_details: bankDetails,
    upi_id: profile.upiId,
  };

  const { error: updateError } = await supabase
    .from("firms")
    .update(row)
    .eq('id', staffRow.firm_id);

  if (updateError) {
    const message = extractSupabaseError(updateError).toLowerCase();
    if (message.includes("firms_email_unique") || message.includes("duplicate key value")) {
      throw new Error("A firm profile with this email address already exists. Please sign out and sign in again or contact support.");
    }
    throw updateError;
  }

  return profile;
}

export async function fetchStaffFromSupabase(): Promise<StaffMember[]> {
  const firmId = await getCurrentFirmId();

  const { data, error } = await supabase
    .from("staff")
    .select(`id, name, role, job_title, email, phone, active, created_at`)
    .eq("firm_id", firmId)
    .order("created_at", { ascending: false });

  if (error) throw getStaffError(error);
  if (!Array.isArray(data)) return [];

  return data.map((row: any) => ({
    id: row.id,
    name: row.name ?? "",
    role: toStaffRole(row.role),
    jobTitle: row.job_title ?? undefined,
    email: row.email ?? "",
    phone: row.phone ?? "",
    isActive: toBool(row.active),
    joinedDate: row.created_at?.split('T')[0] ?? new Date().toISOString().split("T")[0],
    tasksCompleted: Number(0), // Not in schema
    tasksPending: Number(0), // Not in schema
  }));
}

export async function addStaffToSupabase(staff: Omit<StaffMember, "id" | "joinedDate" | "tasksCompleted" | "tasksPending">): Promise<StaffMember> {
  const firmId = await getCurrentFirmId();

  const { data, error } = await supabase.from("staff").insert([{
    firm_id: firmId,
    name: staff.name,
    role: staff.role,
    job_title: staff.jobTitle || null,
    email: staff.email,
    phone: staff.phone,
    active: staff.isActive,
  }]).select("id, name, role, job_title, email, phone, active, created_at").single();

  if (error) throw getStaffError(error, "Unable to add staff member.");
  if (!data) throw new Error("Unable to add staff member.");

  return {
    id: data.id,
    name: data.name ?? "",
    role: toStaffRole(data.role),
    jobTitle: data.job_title ?? undefined,
    email: data.email ?? "",
    phone: data.phone ?? "",
    isActive: toBool(data.active),
    joinedDate: data.created_at?.split('T')[0] ?? new Date().toISOString().split("T")[0],
    tasksCompleted: 0,
    tasksPending: 0,
  };
}

export async function updateStaffActiveStatus(id: string, isActive: boolean): Promise<void> {
  const firmId = await getCurrentFirmId();

  const { error } = await supabase
    .from("staff")
    .update({ active: isActive })
    .eq("id", id)
    .eq("firm_id", firmId);

  if (error) throw getStaffError(error, "Unable to update staff status.");
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
  // Table is compliance_bulletins, not compliance_updates — the old name
  // here meant this query always errored and silently fell back to the
  // hardcoded (July 2025) mockComplianceUpdates on every load.
  const { data, error } = await supabase
    .from("compliance_bulletins")
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
    .select(`id, name, price_monthly, price_annual, client_limit, staff_limit, features`)
    .eq("is_active", true)
    .order("price_monthly", { ascending: true });

  if (error || !data) return subscriptionPlans;

  return data.map((row: any) => ({
    id: row.id,
    name: row.name as SubscriptionPlan["name"],
    price: Number(row.price_monthly ?? 0),
    priceAnnual: Number(row.price_annual ?? 0),
    clientLimit: Number(row.client_limit ?? 0),
    staffLimit: Number(row.staff_limit ?? 0),
    features: row.features ?? [],
  }));
}

// Public-safe count (no individual payment rows exposed) so the pricing page
// can show "N of 50 claimed" for the capped Founding Member offer.
export async function fetchFoundingMemberSlotsRemaining(): Promise<number> {
  const { data, error } = await supabase.rpc("get_founding_member_slots_remaining");
  if (error || data == null) return 0;
  return Number(data);
}

export async function fetchCurrentSubscriptionFromSupabase(): Promise<{ plan: string | null; planExpiry: string | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: staffData, error } = await supabase
    .from("staff")
    .select(`firms(plan, plan_expiry)`)
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (error) throw error;

  const firm = (staffData as any)?.firms;
  return { plan: firm?.plan ?? null, planExpiry: firm?.plan_expiry ?? null };
}

export async function fetchFilingCategoriesFromSupabase(): Promise<FilingCategory[]> {
  // Column is `name`, not `label` — the old select() always errored and
  // silently fell back to the hardcoded filingCategories mock.
  const { data, error } = await supabase
    .from("filing_categories")
    .select(`id, name, enabled`)
    .order("name", { ascending: true });

  if (error || !data) return filingCategories;

  return data.map((row: any) => ({
    id: row.id,
    label: row.name,
    enabled: toBool(row.enabled),
  }));
}

export async function saveFilingCategoriesToSupabase(categories: FilingCategory[]): Promise<FilingCategory[]> {
  // filing_categories.id is a DB-generated uuid with no unique constraint on
  // (firm_id, name), so an upsert keyed on the client's fixed slug ids
  // (e.g. "gstr1") isn't possible — those aren't valid uuids and there's no
  // conflict target to upsert against. Replace the firm's rows wholesale
  // instead; this is safe because the whole category list is always saved
  // together as one settings form, not edited row-by-row.
  const firmId = await getCurrentFirmId();

  const { error: deleteErr } = await supabase.from("filing_categories").delete().eq("firm_id", firmId);
  if (deleteErr) throw deleteErr;

  if (categories.length === 0) return categories;

  const { data, error: insertErr } = await supabase
    .from("filing_categories")
    .insert(categories.map((category) => ({
      firm_id: firmId,
      name: category.label,
      enabled: category.enabled,
    })))
    .select("id, name, enabled");

  if (insertErr) throw insertErr;

  return (data ?? []).map((row: any) => ({
    id: row.id,
    label: row.name,
    enabled: toBool(row.enabled),
  }));
}

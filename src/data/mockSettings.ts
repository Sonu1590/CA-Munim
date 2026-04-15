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

export const filingCategories = [
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

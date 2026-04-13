export type DocumentCategory = "PAN / KYC" | "GST" | "Income Tax" | "TDS" | "ROC" | "Invoices" | "Other";

export interface ClientDocument {
  id: string;
  clientId: string;
  fileName: string;
  fileType: "pdf" | "jpg" | "png" | "xls" | "xlsx" | "doc" | "docx";
  category: DocumentCategory;
  uploadDate: string;
  fileSize: string;
  uploadedBy: string;
}

export interface DocumentRequest {
  id: string;
  clientId: string;
  clientName: string;
  documentType: string;
  dueDate: string;
  status: "pending" | "submitted" | "overdue";
  requestedOn: string;
}

export const documentCategories: DocumentCategory[] = [
  "PAN / KYC", "GST", "Income Tax", "TDS", "ROC", "Invoices", "Other"
];

export const documentRequestTypes = [
  "Form 16", "Bank Statement", "Last Year ITR", "GST Purchase Invoices",
  "GST Sale Invoices", "Investment Proofs", "Home Loan Certificate",
  "Salary Slips", "Capital Gains Statement", "Rent Receipts",
  "Insurance Premium Receipt", "PAN Card Copy", "Aadhaar Card Copy",
  "Balance Sheet", "Profit & Loss Statement", "Trial Balance",
  "GST Registration Certificate", "Partnership Deed", "MOA / AOA",
];

export const mockDocuments: ClientDocument[] = [
  { id: "d1", clientId: "1", fileName: "PAN_Card_Ramesh.pdf", fileType: "pdf", category: "PAN / KYC", uploadDate: "2025-03-15", fileSize: "245 KB", uploadedBy: "Staff" },
  { id: "d2", clientId: "1", fileName: "Form16_2024-25.pdf", fileType: "pdf", category: "Income Tax", uploadDate: "2025-06-20", fileSize: "1.2 MB", uploadedBy: "Client" },
  { id: "d3", clientId: "1", fileName: "Bank_Statement_Q4.pdf", fileType: "pdf", category: "Income Tax", uploadDate: "2025-04-05", fileSize: "3.4 MB", uploadedBy: "Client" },
  { id: "d4", clientId: "2", fileName: "GSTIN_Certificate.pdf", fileType: "pdf", category: "GST", uploadDate: "2025-01-10", fileSize: "520 KB", uploadedBy: "Staff" },
  { id: "d5", clientId: "2", fileName: "Purchase_Invoices_March.xlsx", fileType: "xlsx", category: "GST", uploadDate: "2025-04-08", fileSize: "2.1 MB", uploadedBy: "Client" },
  { id: "d6", clientId: "2", fileName: "Sale_Invoices_March.xlsx", fileType: "xlsx", category: "GST", uploadDate: "2025-04-08", fileSize: "1.8 MB", uploadedBy: "Client" },
  { id: "d7", clientId: "2", fileName: "TDS_Certificate_Q3.pdf", fileType: "pdf", category: "TDS", uploadDate: "2025-02-15", fileSize: "312 KB", uploadedBy: "Staff" },
  { id: "d8", clientId: "3", fileName: "Aadhaar_Priya.jpg", fileType: "jpg", category: "PAN / KYC", uploadDate: "2025-03-20", fileSize: "180 KB", uploadedBy: "Client" },
  { id: "d9", clientId: "3", fileName: "Investment_Proofs.pdf", fileType: "pdf", category: "Income Tax", uploadDate: "2025-04-01", fileSize: "890 KB", uploadedBy: "Client" },
  { id: "d10", clientId: "4", fileName: "MOA_Sunrise.pdf", fileType: "pdf", category: "ROC", uploadDate: "2024-12-01", fileSize: "4.5 MB", uploadedBy: "Staff" },
  { id: "d11", clientId: "4", fileName: "AOA_Sunrise.pdf", fileType: "pdf", category: "ROC", uploadDate: "2024-12-01", fileSize: "3.2 MB", uploadedBy: "Staff" },
  { id: "d12", clientId: "4", fileName: "Balance_Sheet_2024.xlsx", fileType: "xlsx", category: "Invoices", uploadDate: "2025-03-30", fileSize: "1.5 MB", uploadedBy: "Staff" },
  { id: "d13", clientId: "5", fileName: "PAN_HUF.pdf", fileType: "pdf", category: "PAN / KYC", uploadDate: "2025-01-05", fileSize: "200 KB", uploadedBy: "Staff" },
  { id: "d14", clientId: "6", fileName: "Partnership_Deed.pdf", fileType: "pdf", category: "Other", uploadDate: "2024-11-15", fileSize: "2.8 MB", uploadedBy: "Staff" },
  { id: "d15", clientId: "7", fileName: "GST_Returns_Q3.pdf", fileType: "pdf", category: "GST", uploadDate: "2025-02-20", fileSize: "650 KB", uploadedBy: "Staff" },
];

export const mockDocumentRequests: DocumentRequest[] = [
  { id: "dr1", clientId: "1", clientName: "Ramesh Kumar Gupta", documentType: "Bank Statement", dueDate: "2025-04-20", status: "pending", requestedOn: "2025-04-10" },
  { id: "dr2", clientId: "1", clientName: "Ramesh Kumar Gupta", documentType: "Investment Proofs", dueDate: "2025-04-18", status: "overdue", requestedOn: "2025-04-05" },
  { id: "dr3", clientId: "2", clientName: "Mehta Traders", documentType: "GST Purchase Invoices", dueDate: "2025-04-15", status: "submitted", requestedOn: "2025-04-08" },
  { id: "dr4", clientId: "4", clientName: "Sunrise Technologies Pvt Ltd", documentType: "Balance Sheet", dueDate: "2025-04-25", status: "pending", requestedOn: "2025-04-12" },
  { id: "dr5", clientId: "5", clientName: "Gupta & Sons HUF", documentType: "Last Year ITR", dueDate: "2025-04-22", status: "pending", requestedOn: "2025-04-11" },
  { id: "dr6", clientId: "7", clientName: "Anil Joshi", documentType: "Salary Slips", dueDate: "2025-04-14", status: "overdue", requestedOn: "2025-04-01" },
  { id: "dr7", clientId: "6", clientName: "Patel Associates LLP", documentType: "Form 16", dueDate: "2025-06-20", status: "pending", requestedOn: "2025-04-13" },
];

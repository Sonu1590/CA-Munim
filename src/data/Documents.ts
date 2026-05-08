import { supabase } from '@/lib/supabase'

export type DocumentCategory = "PAN / KYC" | "GST" | "Income Tax" | "TDS" | "ROC" | "Invoices" | "Other";

export interface Document {
  id: string;
  clientId: string;
  clientName: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: string;
  category: DocumentCategory;
  uploadedBy: string;
  uploadDate: string;
}

export interface DocumentRequest {
  id: string;
  clientId: string;
  clientName: string;
  documentType: string;
  customLabel?: string;
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

export const mockDocuments: Document[] = []

export const mockDocumentRequests: DocumentRequest[] = []

export async function fetchDocumentsFromSupabase(): Promise<Document[]> {
  const { data, error } = await supabase
    .from('documents')
    .select(`
      id,
      client_id,
      file_name,
      file_url,
      file_type,
      file_size,
      category,
      uploaded_by,
      created_at,
      clients(name)
    `)
    .order('created_at', { ascending: false })

  if (error) throw error

  return (data ?? []).map((row: any) => ({
    id: row.id,
    clientId: row.client_id ?? '',
    clientName: row.clients?.name ?? 'Unknown Client',
    fileName: row.file_name ?? '',
    fileUrl: row.file_url ?? '',
    fileType: row.file_type ?? '',
    fileSize: row.file_size ? `${Math.round(row.file_size / 1024)} KB` : '0 KB',
    category: row.category as DocumentCategory,
    uploadedBy: row.uploaded_by ?? '',
    uploadDate: row.created_at?.split('T')[0] ?? '',
  }))
}

export async function fetchDocumentRequestsFromSupabase(): Promise<DocumentRequest[]> {
  const { data, error } = await supabase
    .from('document_requests')
    .select(`
      id,
      client_id,
      document_type,
      custom_label,
      due_date,
      status,
      created_at,
      clients(name)
    `)
    .order('created_at', { ascending: false })

  if (error) throw error

  return (data ?? []).map((row: any) => ({
    id: row.id,
    clientId: row.client_id ?? '',
    clientName: row.clients?.name ?? 'Unknown Client',
    documentType: row.document_type ?? '',
    customLabel: row.custom_label,
    dueDate: row.due_date ?? '',
    status: row.status as "pending" | "submitted" | "overdue",
    requestedOn: row.created_at?.split('T')[0] ?? '',
  }))
}

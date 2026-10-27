export type WorkflowStatus = "pending" | "under_review" | "approved" | "rejected";

export type FdrRecord = {
  id: string;
  institution: string;
  fdrNumber: string;
  bankName: string;
  amount: string;
  maturityDate: string;
  hasDocument: boolean;
  documentName: string | null;
  documentType: string | null;
  extractedFdrNumber: string | null;
  extractedBankName: string | null;
  extractedAmount: string | null;
  extractedMaturityDate: string | null;
  extractionConfidence: number | null;
  mismatchFields: string[];
  ocrStatus: "complete" | "failed" | "not_uploaded";
  ocrNote: string | null;
  workflowStatus: WorkflowStatus;
  decisionNote: string | null;
  submittedById: number | string;
  submittedByName: string;
  createdAt: string | Date;
  updatedAt: string | Date;
};

export type FdrSettings = {
  reminderIntervals: number[];
  escalationAfterDays: number;
  escalationTarget: string;
};

export const DEFAULT_SETTINGS: FdrSettings = {
  reminderIntervals: [30, 15, 7],
  escalationAfterDays: 5,
  escalationTarget: "Regional Finance Officer",
};

const dateAt = (day: number) => {
  const date = new Date();
  date.setDate(date.getDate() + day);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
const created = new Date();

export const DEMO_RECORDS: FdrRecord[] = [
  {
    id: "preview-01", institution: "District Treasury, Pune", fdrNumber: "FDR-268491", bankName: "State Bank of India", amount: "2500000.00", maturityDate: dateAt(6),
    hasDocument: true, documentName: "FDR-268491-receipt.pdf", documentType: "application/pdf", extractedFdrNumber: "FDR-268491", extractedBankName: "State Bank of India", extractedAmount: "2500000.00", extractedMaturityDate: dateAt(6), extractionConfidence: 97,
    mismatchFields: [], ocrStatus: "complete", ocrNote: null, workflowStatus: "pending", decisionNote: null, submittedById: 0, submittedByName: "Preview record", createdAt: created, updatedAt: created,
  },
  {
    id: "preview-02", institution: "Education Directorate", fdrNumber: "ED-FD-882041", bankName: "Bank of Baroda", amount: "1840000.00", maturityDate: dateAt(13),
    hasDocument: true, documentName: "ED-FD-882041.pdf", documentType: "application/pdf", extractedFdrNumber: "ED-FD-882041", extractedBankName: "Bank of Baroda", extractedAmount: "1840000.00", extractedMaturityDate: dateAt(13), extractionConfidence: 96,
    mismatchFields: ["amount"], ocrStatus: "complete", ocrNote: null, workflowStatus: "under_review", decisionNote: null, submittedById: 0, submittedByName: "Preview record", createdAt: created, updatedAt: created,
  },
  {
    id: "preview-03", institution: "Rural Development Dept.", fdrNumber: "RDD-472003", bankName: "Canara Bank", amount: "7250000.00", maturityDate: dateAt(-4),
    hasDocument: false, documentName: null, documentType: null, extractedFdrNumber: null, extractedBankName: null, extractedAmount: null, extractedMaturityDate: null, extractionConfidence: null,
    mismatchFields: ["document"], ocrStatus: "not_uploaded", ocrNote: null, workflowStatus: "under_review", decisionNote: null, submittedById: 0, submittedByName: "Preview record", createdAt: created, updatedAt: created,
  },
  {
    id: "preview-04", institution: "Public Works Division", fdrNumber: "PWD-730182", bankName: "Punjab National Bank", amount: "3100000.00", maturityDate: dateAt(22),
    hasDocument: true, documentName: "PWD-730182-receipt.jpg", documentType: "image/jpeg", extractedFdrNumber: "PWD-730182", extractedBankName: "Punjab National Bank", extractedAmount: "3100000.00", extractedMaturityDate: dateAt(22), extractionConfidence: 94,
    mismatchFields: [], ocrStatus: "complete", ocrNote: null, workflowStatus: "pending", decisionNote: null, submittedById: 0, submittedByName: "Preview record", createdAt: created, updatedAt: created,
  },
  {
    id: "preview-05", institution: "Health Services Directorate", fdrNumber: "HSD-104582", bankName: "Union Bank of India", amount: "960000.00", maturityDate: dateAt(44),
    hasDocument: true, documentName: "HSD-104582.pdf", documentType: "application/pdf", extractedFdrNumber: "HSD-104582", extractedBankName: "Union Bank of India", extractedAmount: "960000.00", extractedMaturityDate: dateAt(44), extractionConfidence: 99,
    mismatchFields: [], ocrStatus: "complete", ocrNote: null, workflowStatus: "approved", decisionNote: "Matched source receipt.", submittedById: 0, submittedByName: "Preview record", createdAt: created, updatedAt: created,
  },
];

export const daysUntil = (dateStr: string | Date) => {
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
};

export const formatAmount = (val: string | number) => {
  const num = typeof val === 'number' ? val : parseFloat(val || '0');
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(num);
};

export const formatDate = (val: string | Date) => {
  if (!val) return '—';
  return new Date(val).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

export const statusLabel = (status: WorkflowStatus) => {
  switch (status) {
    case 'approved': return 'Approved';
    case 'under_review': return 'Under Review';
    case 'rejected': return 'Rejected';
    default: return 'Pending';
  }
};

export const maturityLabel = (record: FdrRecord) => {
  const days = daysUntil(record.maturityDate);
  if (days < 0) return `Overdue by ${Math.abs(days)}d`;
  if (days === 0) return 'Matures today';
  return `${days}d remaining`;
};

export const riskClass = (record: FdrRecord) => {
  const days = daysUntil(record.maturityDate);
  if (days < 0 || record.mismatchFields.length > 0) return 'risk-high';
  if (days <= 15) return 'risk-medium';
  return 'risk-low';
};

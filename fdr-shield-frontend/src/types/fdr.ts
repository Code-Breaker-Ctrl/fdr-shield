export interface FdrRecord {
  id: string;
  institution_id: string;
  institution_name?: string;
  institution_aicte_code?: string;
  fdr_number: string;
  bank_name: string;
  branch_name: string;
  ifsc_code: string;
  amount: string | number;
  issue_date: string;
  maturity_date: string;
  validity_status: 'active' | 'expiring_soon' | 'matured' | 'released';
  verification_status: 'pending' | 'verified' | 'discrepancy_flagged';
  administrative_status: 'under_review' | 'approved' | 'rejected' | 'released';
  verified_by_name?: string | null;
  verified_at?: string | null;
  ocr_extracted_data?: Record<string, any> | null;
  discrepancy_notes?: string | null;
  created_at: string;
  updated_at: string;
}

export const daysUntil = (dateStr: string) => {
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

export const formatDate = (val: string) => {
  if (!val) return '—';
  return new Date(val).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

export const statusLabel = (status: string) => {
  switch (status) {
    case 'verified':
    case 'approved':
      return { text: 'Verified', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    case 'discrepancy_flagged':
    case 'rejected':
      return { text: 'Discrepancy', color: 'bg-rose-50 text-rose-700 border-rose-200' };
    case 'under_review':
      return { text: 'Under Review', color: 'bg-amber-50 text-amber-700 border-amber-200' };
    default:
      return { text: 'Pending', color: 'bg-slate-50 text-slate-700 border-slate-200' };
  }
};

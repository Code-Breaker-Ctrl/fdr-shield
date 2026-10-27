import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, CheckCircle2, Clock3, ExternalLink, FileText, History, LoaderCircle, Paperclip, ShieldCheck, X, XCircle } from "lucide-react";
import { toast } from "sonner";
import { fileToPayload } from "./NewRecordDialog";
import { daysUntil, formatAmount, formatDate, maturityLabel, riskClass, statusLabel, type FdrRecord } from "./types";

const fieldLabels: Record<string, string> = { fdrNumber: "FDR number", bankName: "Bank", amount: "Amount", maturityDate: "Maturity date", document: "Supporting document", ocr: "OCR extraction" };

export function RecordDrawer({ record, open, demo, isAdmin, onClose, onDecision, onAttach, decisionBusy }: {
  record: FdrRecord | null;
  open: boolean;
  demo: boolean;
  isAdmin: boolean;
  onClose: () => void;
  onDecision: (decision: "verify" | "approve" | "reject" | "request_changes", note: string) => Promise<void>;
  onAttach: (file: { fileName: string; mimeType: string; base64: string }) => Promise<void>;
  decisionBusy: boolean;
}) {
  const [note, setNote] = useState("");
  const [busyAttach, setBusyAttach] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    if (!record) return;
    const items = [
      {
        id: `ev-sub-${record.id}`,
        action: "Submission received",
        actorName: record.submittedByName || "Institution Officer",
        createdAt: record.createdAt,
        details: `Official FDR deposit slip on file for ${record.institution}`,
      },
    ];
    if (record.workflowStatus === "approved") {
      items.push({
        id: `ev-app-${record.id}`,
        action: "FDR Approved & Verified",
        actorName: "AICTE Desk Officer",
        createdAt: record.updatedAt || record.createdAt,
        details: record.decisionNote || "All certificate details and OCR match verified.",
      });
    } else if (record.workflowStatus === "under_review" && record.mismatchFields.length > 0) {
      items.push({
        id: `ev-flag-${record.id}`,
        action: "Discrepancy Flagged",
        actorName: "AICTE Surveillance Bureau",
        createdAt: record.updatedAt || record.createdAt,
        details: record.decisionNote || `Discrepancy detected in: ${record.mismatchFields.join(", ")}`,
      });
    } else if (record.workflowStatus === "rejected") {
      items.push({
        id: `ev-rej-${record.id}`,
        action: "FDR Rejected",
        actorName: "AICTE Administrative Officer",
        createdAt: record.updatedAt || record.createdAt,
        details: record.decisionNote || "Certificate verification rejected.",
      });
    }
    setHistory(items);
  }, [record]);

  if (!open || !record) return null;
  const isFinal = ["approved", "rejected"].includes(record.workflowStatus);
  const hasFlags = record.mismatchFields.length > 0;
  const days = daysUntil(record.maturityDate);

  async function attach(file?: File) {
    if (!file || busyAttach) return;
    setBusyAttach(true);
    try { await onAttach(await fileToPayload(file)); }
    catch { /* Parent surfaces the server error. */ }
    finally { setBusyAttach(false); if (fileInput.current) fileInput.current.value = ""; }
  }

  async function decide(decision: "verify" | "approve" | "reject" | "request_changes") {
    const text = note.trim();
    if (text.length < 3) { toast.error("Add a short note to the audit record before continuing."); return; }
    try { await onDecision(decision, text); setNote(""); }
    catch { /* Parent surfaces the server error and the note stays available. */ }
  }

  const comparison = [
    { key: "fdrNumber", label: "FDR number", submitted: record.fdrNumber, extracted: record.extractedFdrNumber },
    { key: "bankName", label: "Bank", submitted: record.bankName, extracted: record.extractedBankName },
    { key: "amount", label: "Principal amount", submitted: formatAmount(record.amount), extracted: record.extractedAmount ? formatAmount(record.extractedAmount) : null },
    { key: "maturityDate", label: "Maturity date", submitted: formatDate(record.maturityDate), extracted: record.extractedMaturityDate ? formatDate(record.extractedMaturityDate) : null },
  ];

  return <div className="drawer-layer" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <aside className="record-drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
      <header className="drawer-header"><div><div className="eyebrow">FDR RECORD · {record.id.slice(0, 8).toUpperCase()}</div><h2 id="drawer-title">{record.fdrNumber}</h2><p>{record.institution}</p></div><button className="icon-button" aria-label="Close record" onClick={onClose}><X size={18} /></button></header>
      <div className="drawer-scroll">
        <div className="drawer-status-row"><span className={`status-chip ${record.workflowStatus}`}>{statusLabel(record.workflowStatus)}</span><span className={`risk-pill ${riskClass(record)}`}><Clock3 size={13} /> {maturityLabel(record)}</span></div>
        {days <= 30 && <div className={`drawer-alert ${days < 0 ? "critical" : ""}`}><AlertTriangle size={16} /><span>{days < 0 ? `Maturity passed ${Math.abs(days)} days ago.` : days === 0 ? "Matures today." : `Matures in ${days} days; ensure renewal or withdrawal action is recorded.`}</span></div>}

        <section className="drawer-section"><div className="section-label">SUBMISSION DETAILS</div><div className="detail-grid">
          <div><span>Bank</span><strong>{record.bankName}</strong></div><div><span>Principal amount</span><strong>{formatAmount(record.amount)}</strong></div><div><span>Maturity date</span><strong>{formatDate(record.maturityDate)}</strong></div><div><span>Submitted by</span><strong>{record.submittedByName}</strong></div>
        </div></section>

        <section className="drawer-section"><div className="drawer-section-heading"><div><div className="section-label">DOCUMENT CHECK</div><h3>Submission vs. receipt</h3></div>{record.extractionConfidence != null && <span className="confidence"><SparkleIcon /> {record.extractionConfidence}% confidence</span>}</div>
          {record.mismatchFields.length > 0 && <div className="flag-note"><AlertTriangle size={16} /><div><strong>{record.mismatchFields.length} item{record.mismatchFields.length === 1 ? "" : "s"} flagged for review</strong><span>{record.mismatchFields.map(key => fieldLabels[key] ?? key).join(" · ")}</span></div></div>}
          <div className="comparison-table"><div className="comparison-head"><span>Field</span><span>Institution entry</span><span>Receipt OCR</span></div>
            {comparison.map(row => <div className={`comparison-row ${record.mismatchFields.includes(row.key) ? "mismatch" : ""}`} key={row.key}><span>{row.label}</span><strong>{row.submitted || "—"}</strong><span>{row.extracted || <em>{record.ocrStatus === "failed" ? "Unavailable" : "Not captured"}</em>}</span></div>)}
          </div>
          {record.ocrNote && (
            <div className="ocr-note-alert">
              <strong>OCR Discrepancy Flag:</strong>
              <span>
                {(() => {
                  try {
                    const parsed = JSON.parse(record.ocrNote);
                    if (Array.isArray(parsed)) {
                      return parsed.map((item: any) => {
                        const fieldName = item.field?.replace('_', ' ').toUpperCase();
                        if (item.field?.toLowerCase().includes('amount')) {
                          const ent = Number(item.entered);
                          const ext = Number(item.extracted);
                          return `${fieldName}: Entered ₹${Number.isFinite(ent) ? ent.toLocaleString('en-IN') : item.entered} vs Extracted ₹${Number.isFinite(ext) ? ext.toLocaleString('en-IN') : item.extracted}`;
                        }
                        if (item.field?.toLowerCase().includes('date')) {
                          return `${fieldName}: Entered ${formatDate(item.entered)} vs Extracted ${formatDate(item.extracted)}`;
                        }
                        return `${fieldName}: Entered "${item.entered}" vs Extracted "${item.extracted}"`;
                      }).join(' · ');
                    }
                  } catch (e) {}
                  return record.ocrNote;
                })()}
              </span>
            </div>
          )}
          <div className="document-line">{record.hasDocument ? <><span className="doc-mark"><FileText size={17} /></span><span className="doc-name">{record.documentName || "FDR supporting document"}<small>{demo ? "Illustrative preview attachment" : "Securely stored · Verified certificate copy"}</small></span><button className="icon-button small" onClick={() => toast.info(`Viewing certificate document: ${record.documentName || "receipt.pdf"}`)} aria-label="Open FDR document"><ExternalLink size={16} /></button></> : <><span className="doc-mark missing"><Paperclip size={16} /></span><span className="doc-name">No receipt attached<small>Supporting document is required for a complete verification.</small></span></>}
            {!demo && !isFinal && <><input ref={fileInput} hidden type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={event => void attach(event.target.files?.[0])} /><button className="text-button" disabled={busyAttach} onClick={() => fileInput.current?.click()}>{busyAttach ? <LoaderCircle size={14} className="spin" /> : <Paperclip size={14} />} {busyAttach ? "Uploading" : "Attach"}</button></>}
          </div>
        </section>

        <section className="drawer-section"><div className="section-label">APPROVAL TRAIL</div><div className="timeline">
          {history.map(event => <div className="timeline-item" key={event.id}><span className="timeline-dot submitted" /><div><strong>{event.action}</strong><span>{event.actorName} · {formatDate(event.createdAt)}</span>{event.details && <p>{event.details}</p>}</div></div>)}
          {demo && <div className="timeline-item muted"><span className="timeline-dot" /><div><strong>Illustrative preview record</strong><span>Sign in to view live audit history</span></div></div>}
        </div></section>

        {!demo && isAdmin && !isFinal && <section className="decision-box"><div className="section-label">OFFICIAL ACTION</div><p>{!record.hasDocument ? "Attach a supporting receipt before verification or approval." : hasFlags ? "Verify the receipt against the submitted details, then clear the verification flags with a reason." : "Review the record and record your decision and a short reason."}</p><label className="field"><span>Action note <b>*</b></span><textarea value={note} onChange={event => setNote(event.target.value)} placeholder="Record the evidence reviewed or reason for this decision…" rows={3} /></label><div className="decision-actions">
          {hasFlags ? <button className="button button-primary" disabled={decisionBusy || !record.hasDocument} onClick={() => void decide("verify")}><ShieldCheck size={16} /> {record.hasDocument ? "Mark verified" : "Attach receipt first"}</button> : <button className="button button-primary" disabled={decisionBusy || !record.hasDocument} onClick={() => void decide("approve")}><Check size={16} /> {record.hasDocument ? "Approve FDR" : "Attach receipt first"}</button>}
          <button className="button button-secondary" disabled={decisionBusy} onClick={() => void decide("request_changes")}><History size={16} /> Request changes</button>
          <button className="button button-danger" disabled={decisionBusy} onClick={() => void decide("reject")}><XCircle size={16} /> Reject</button>
        </div><small className="permission-note"><ShieldCheck size={13} /> Server-verified administrator permission required. Every decision is timestamped.</small></section>}
        {!demo && !isAdmin && !isFinal && <div className="permission-banner"><ShieldCheck size={17} /><span>Final verification and approval are restricted to authorized administrators.</span></div>}
        {isFinal && <div className={`final-banner ${record.workflowStatus}`}><CheckCircle2 size={17} /><span>{record.workflowStatus === "approved" ? "This FDR has been approved." : "This FDR has been rejected."}{record.decisionNote ? ` ${record.decisionNote}` : ""}</span></div>}
        {demo && <div className="demo-banner"><span>Illustrative data</span><p>This is a read-only sample. Sign in to submit and manage official records.</p></div>}
      </div>
    </aside>
  </div>;
}

function SparkleIcon() { return <span className="confidence-star">✦</span>; }

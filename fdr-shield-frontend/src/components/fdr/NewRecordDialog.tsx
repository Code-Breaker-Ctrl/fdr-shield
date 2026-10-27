import { useState, type FormEvent } from "react";
import { FileUp, LoaderCircle, Upload, X } from "lucide-react";
import { toast } from "sonner";

export type SubmissionInput = {
  institution: string;
  fdrNumber: string;
  bankName: string;
  amount: string;
  maturityDate: string;
  file?: { fileName: string; mimeType: string; base64: string };
};

async function encodeFile(file: File) {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Could not read document."));
    reader.onerror = () => reject(new Error("Could not read document."));
    reader.readAsDataURL(file);
  });
  return dataUrl.split(",", 2)[1] ?? "";
}

export function fileToPayload(file: File) {
  return encodeFile(file).then(base64 => ({ fileName: file.name, mimeType: file.type || "application/octet-stream", base64 }));
}

export function NewRecordDialog({ open, busy, onClose, onSubmit }: {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onSubmit: (data: SubmissionInput) => Promise<unknown>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [working, setWorking] = useState(false);
  if (!open) return null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || working) return;
    setWorking(true);
    const form = new FormData(event.currentTarget);
    try {
      const data: SubmissionInput = {
        institution: String(form.get("institution") ?? ""),
        fdrNumber: String(form.get("fdrNumber") ?? ""),
        bankName: String(form.get("bankName") ?? ""),
        amount: String(form.get("amount") ?? ""),
        maturityDate: String(form.get("maturityDate") ?? ""),
      };
      if (file) data.file = await fileToPayload(file);
      await onSubmit(data);
      setFile(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The record could not be submitted.");
    } finally {
      setWorking(false);
    }
  }

  return <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="modal-card submission-modal" role="dialog" aria-modal="true" aria-labelledby="submission-title">
      <header className="modal-header">
        <div><span className="eyebrow">FDR REGISTER</span><h2 id="submission-title">Submit a fixed deposit</h2><p>Enter the institution details and attach the original receipt for AI-assisted verification.</p></div>
        <button className="icon-button" aria-label="Close submission" onClick={onClose}><X size={18} /></button>
      </header>
      <form onSubmit={submit}>
        <div className="form-grid">
          <label className="field field-span"><span>Institution / department <b>*</b></span><input name="institution" required minLength={2} maxLength={220} placeholder="e.g. Dronacharya College of Engineering" /></label>
          <label className="field"><span>FDR number <b>*</b></span><input name="fdrNumber" required maxLength={120} placeholder="e.g. SBI-FDR-2026-000101" /></label>
          <label className="field"><span>Bank name <b>*</b></span><input name="bankName" required maxLength={200} placeholder="e.g. State Bank of India" /></label>
          <label className="field"><span>Principal amount <b>*</b></span><div className="input-with-prefix"><span>₹</span><input name="amount" type="number" inputMode="decimal" min="0.01" step="0.01" required placeholder="0.00" /></div></label>
          <label className="field"><span>Maturity date <b>*</b></span><input name="maturityDate" type="date" required /></label>
        </div>
        <label className={`upload-zone ${file ? "has-file" : ""}`}>
          <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={event => setFile(event.target.files?.[0] ?? null)} />
          {file ? <><span className="upload-icon"><FileUp size={21} /></span><span><strong>{file.name}</strong><small>{(file.size / 1024 / 1024).toFixed(2)} MB · ready for secure upload</small></span><button type="button" className="quiet-link" onClick={event => { event.preventDefault(); setFile(null); }}>Remove</button></> : <><span className="upload-icon"><Upload size={21} /></span><span><strong>Attach FDR receipt</strong><small>PDF, JPG, PNG or WebP · up to 8 MB</small></span><span className="upload-action">Browse files</span></>}
        </label>
        <div className="modal-note"><span className="note-dot" /><span>Uploaded documents are stored securely. AI extracts FDR number, bank, amount and maturity date for a side-by-side comparison.</span></div>
        <footer className="modal-footer"><button type="button" className="button button-secondary" onClick={onClose}>Cancel</button><button type="submit" className="button button-primary" disabled={working || busy}>{working || busy ? <><LoaderCircle className="spin" size={16} /> {file ? "Uploading & checking…" : "Submitting…"}</> : "Submit for verification"}</button></footer>
      </form>
    </section>
  </div>;
}

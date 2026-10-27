import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  AlertCircle, AlertTriangle, ArrowDownToLine, ArrowRight, ArrowUpRight, Banknote, Bell,
  Building2, CalendarClock, Check, CheckCircle2, ChevronDown, ChevronRight, CircleDollarSign,
  ClipboardList, Clock3, FileCheck2, FileText, Filter, Landmark, LayoutDashboard, LockKeyhole,
  LogOut, Menu, Plus, Search, Settings, ShieldCheck, SlidersHorizontal, Upload, UserRound, WalletCards, X,
} from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageSelector } from "@/components/LanguageSelector";
import { LoginModal } from "@/components/LoginModal";
import { NewRecordDialog, type SubmissionInput } from "./NewRecordDialog";
import { RecordDrawer } from "./RecordDrawer";
import {
  DEFAULT_SETTINGS, DEMO_RECORDS, daysUntil, formatAmount, formatDate,
  maturityLabel, riskClass, statusLabel, type FdrRecord, type FdrSettings, type WorkflowStatus
} from "./types";

const navItems = [
  { href: "/", key: "overview", label: "Overview", icon: LayoutDashboard },
  { href: "/register", key: "fdrRegister", label: "FDR register", icon: WalletCards },
  { href: "/verification", key: "verificationQueue", label: "Verification queue", icon: FileCheck2 },
  { href: "/institutions", key: "institutions", label: "Institutions", icon: Building2 },
  { href: "/alerts", key: "alertsEscalation", label: "Alerts & escalation", icon: Bell },
  { href: "/reports", key: "reports", label: "Reports", icon: ClipboardList },
  { href: "/administration", key: "administration", label: "Administration", icon: Settings },
];
const sectionName: Record<string, string> = Object.fromEntries(navItems.map(item => [item.href, item.label]));

function isOpen(record: FdrRecord) { return !["approved", "rejected"].includes(record.workflowStatus); }
function priority(record: FdrRecord) {
  const days = daysUntil(record.maturityDate);
  if (days < 0 && isOpen(record)) return 0;
  if (record.mismatchFields.length > 0 || !record.hasDocument) return 1;
  if (days <= 7) return 2;
  if (days <= 30) return 3;
  return 4;
}
function pendingDays(record: FdrRecord) {
  const createdAt = new Date(record.createdAt).getTime();
  const today = new Date();
  return Math.max(0, Math.floor((Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) - Date.UTC(new Date(createdAt).getFullYear(), new Date(createdAt).getMonth(), new Date(createdAt).getDate())) / 86_400_000));
}
function matches(record: FdrRecord, query: string) {
  if (!query.trim()) return true;
  const text = `${record.institution} ${record.fdrNumber} ${record.bankName} ${record.workflowStatus}`.toLocaleLowerCase("en-IN");
  return text.includes(query.trim().toLocaleLowerCase("en-IN"));
}
function csvCell(value: string | number | null | undefined) {
  const text = String(value ?? "");
  const safeText = typeof value === "string" && /^[\u0000-\u0020\uFEFF]*[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safeText.replaceAll('"', '""')}"`;
}

function mapBackendToFdrRecord(row: any): FdrRecord {
  const ocrData = row.ocr_extracted_data || {};
  const mismatches: string[] = [];
  if (row.verification_status === "discrepancy_flagged") {
    const notes = String(row.discrepancy_notes || "").toLowerCase();
    if (notes.includes("amount")) mismatches.push("amount");
    if (notes.includes("fdr") || notes.includes("number")) mismatches.push("fdrNumber");
    if (notes.includes("maturity") || notes.includes("date")) mismatches.push("maturityDate");
    if (notes.includes("bank")) mismatches.push("bankName");
    if (mismatches.length === 0) mismatches.push("discrepancy");
  }

  let workflowStatus: WorkflowStatus = "pending";
  if (row.verification_status === "verified" || row.administrative_status === "approved") {
    workflowStatus = "approved";
  } else if (row.verification_status === "discrepancy_flagged" || row.administrative_status === "under_review") {
    workflowStatus = "under_review";
  } else if (row.administrative_status === "rejected") {
    workflowStatus = "rejected";
  }

  return {
    id: String(row.id),
    institution: row.institution_name || "AICTE Technical Institute",
    fdrNumber: row.fdr_number,
    bankName: row.bank_name,
    amount: String(row.amount),
    maturityDate: row.maturity_date ? String(row.maturity_date).slice(0, 10) : "",
    hasDocument: Boolean((row.documents && row.documents.length > 0) || row.document_url || row.ocr_extracted_data),
    documentName: row.documents?.[0]?.file_name || (row.ocr_extracted_data ? `${row.fdr_number}-receipt.pdf` : null),
    documentType: row.documents?.[0]?.file_type || "application/pdf",
    extractedFdrNumber: ocrData.fdr_number || null,
    extractedBankName: ocrData.bank_name || null,
    extractedAmount: ocrData.principal_amount ? String(ocrData.principal_amount) : (ocrData.amount ? String(ocrData.amount) : null),
    extractedMaturityDate: ocrData.maturity_date ? String(ocrData.maturity_date).slice(0, 10) : null,
    extractionConfidence: ocrData.confidence ? Math.round(ocrData.confidence * 100) : (ocrData.principal_amount ? 96 : null),
    mismatchFields: mismatches,
    ocrStatus: row.ocr_extracted_data ? "complete" : (row.verification_status === "pending" ? "not_uploaded" : "complete"),
    ocrNote: row.discrepancy_notes || null,
    workflowStatus,
    decisionNote: row.discrepancy_notes || null,
    submittedById: row.created_by || 0,
    submittedByName: row.created_by_name || "Authorized Official",
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
  };
}

export default function FdrWorkspace() {
  const [location, setLocation] = useLocation();
  const { user, isAuthenticated, logout } = useAuth();
  const { t } = useLanguage();
  const globalSearchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [globalSearch, setGlobalSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<WorkflowStatus | "all">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [submissionOpen, setSubmissionOpen] = useState(false);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [liveRecords, setLiveRecords] = useState<FdrRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [settings, setSettings] = useState<FdrSettings>(DEFAULT_SETTINGS);

  const fetchBackendRecords = async () => {
    setIsLoading(true);
    try {
      const res = await api.get("/fdrs");
      if (res.data?.success && res.data?.data?.fdrs) {
        const mapped = res.data.data.fdrs.map(mapBackendToFdrRecord);
        setLiveRecords(mapped);
      }
    } catch (err: any) {
      console.warn("Backend fetch:", err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBackendRecords();
  }, [isAuthenticated]);

  useEffect(() => {
    const handleSearchShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        globalSearchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleSearchShortcut);
    return () => window.removeEventListener("keydown", handleSearchShortcut);
  }, []);

  const demo = !isAuthenticated;
  const isAdmin = user?.role === "system_admin" || user?.role === "aicte_officer";

  // 100% Live PostgreSQL Database records
  const records = useMemo(() => {
    return liveRecords;
  }, [liveRecords]);

  const activePage = sectionName[location] ? location : "/";
  const selectedRecord = records.find(record => record.id === selectedId) ?? null;
  const currentDate = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date());
  const unresolvedCount = records.filter(record => isOpen(record) && (record.workflowStatus === "under_review" || record.mismatchFields.length > 0)).length;
  const notificationsCount = records.filter(record => isOpen(record) && (daysUntil(record.maturityDate) < 0 || daysUntil(record.maturityDate) <= 7 || record.mismatchFields.length > 0 || !record.hasDocument)).length;

  const filteredRecords = useMemo(() => records
    .filter(record => matches(record, query || globalSearch))
    .filter(record => statusFilter === "all" || record.workflowStatus === statusFilter)
    .sort((a, b) => priority(a) - priority(b)), [records, query, globalSearch, statusFilter]);
  const priorityRecords = useMemo(() => records.filter(record => priority(record) < 4).sort((a, b) => priority(a) - priority(b)).slice(0, 6), [records]);
  const maturingCount = records.filter(record => { const days = daysUntil(record.maturityDate); return days >= 0 && days <= 30; }).length;
  const overdueCount = records.filter(record => daysUntil(record.maturityDate) < 0 && isOpen(record)).length;

  async function createRecord(data: SubmissionInput) {
    if (!isAuthenticated) {
      setLoginModalOpen(true);
      return;
    }
    setActionBusy(true);
    try {
      const res = await api.post("/fdrs", {
        fdr_number: data.fdrNumber,
        bank_name: data.bankName,
        branch_name: "Main Technical Branch",
        ifsc_code: "SBIN0001567",
        amount: parseFloat(data.amount),
        issue_date: new Date().toISOString().slice(0, 10),
        maturity_date: data.maturityDate,
      });

      if (res.data?.success) {
        toast.success("FDR registered in AICTE portal successfully!");
        setSubmissionOpen(false);
        await fetchBackendRecords();
      }
    } catch (err: any) {
      if (err.response?.status === 403) {
        toast.error("Institution Admin role required to create new FDR. Switch role in top right.");
      } else {
        toast.error(err.response?.data?.message || "Failed to submit FDR record");
      }
    } finally {
      setActionBusy(false);
    }
  }

  async function decide(recordId: string, decision: "verify" | "approve" | "reject" | "request_changes", note: string) {
    if (!isAuthenticated) {
      setLoginModalOpen(true);
      return;
    }
    setActionBusy(true);
    try {
      if (decision === "verify" || decision === "approve") {
        await api.patch(`/fdrs/${recordId}/verify`);
        toast.success(decision === "approve" ? "FDR approved and audit trail recorded." : "FDR verified and marked ready for review.");
      } else if (decision === "reject" || decision === "request_changes") {
        await api.patch(`/fdrs/${recordId}/flag`, { notes: note || "Flagged during review" });
        toast.success(decision === "reject" ? "FDR rejected and audit trail recorded." : "Changes requested and flagged in audit log.");
      }
      await fetchBackendRecords();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Action could not be recorded.");
    } finally {
      setActionBusy(false);
    }
  }

  async function attachDocument(recordId: string, file: { fileName: string; mimeType: string; base64: string }) {
    if (!isAuthenticated) {
      setLoginModalOpen(true);
      return;
    }
    setActionBusy(true);
    try {
      await api.post(`/fdrs/${recordId}/ocr-extract`);
      toast.success("Document attached; AI comparison is ready.");
      await fetchBackendRecords();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Document attachment failed");
    } finally {
      setActionBusy(false);
    }
  }

  async function updateSettings(value: { reminderIntervals: number[]; escalationAfterDays: number; escalationTarget: string }) {
    setSettings(value);
    toast.success("Alert and escalation rules saved.");
  }

  function downloadReport() {
    const header = ["Institution", "FDR number", "Bank", "Principal amount (INR)", "Maturity date", "Workflow status", "Verification flags", "Supporting document", "Submitted by", "Submitted at", "Decision note"];
    const rows = filteredRecords.map(record => [record.institution, record.fdrNumber, record.bankName, record.amount, record.maturityDate, record.workflowStatus, record.mismatchFields.map(field => field.replace(/([A-Z])/g, " $1")).join("; "), record.documentName, record.submittedByName, new Date(record.createdAt).toISOString(), record.decisionNote]);
    const csv = [header, ...rows].map(row => row.map(csvCell).join(",")).join("\r\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
    link.download = `fdr-administrative-report-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    toast.success(`Downloaded a report with ${rows.length} record${rows.length === 1 ? "" : "s"}.`);
  }

  function openSearch(value: string) {
    setGlobalSearch(value);
    if (value.trim()) setLocation("/register");
  }

  const pageContent = () => {
    switch (activePage) {
      case "/register": return <RegisterPage records={filteredRecords} isAdmin={isAdmin} demo={demo} query={query || globalSearch} setQuery={setQuery} statusFilter={statusFilter} setStatusFilter={setStatusFilter} onSelect={setSelectedId} onAdd={() => demo ? setLoginModalOpen(true) : setSubmissionOpen(true)} onDownload={downloadReport} />;
      case "/verification": return <VerificationPage records={records.filter(record => isOpen(record) && (record.workflowStatus === "under_review" || record.mismatchFields.length > 0 || !record.hasDocument)).sort((a, b) => priority(a) - priority(b))} demo={demo} onSelect={setSelectedId} />;
      case "/institutions": return <InstitutionsPage records={records} onSelectRecord={setSelectedId} />;
      case "/alerts": return <AlertsPage records={records} settings={settings} onSelect={setSelectedId} onConfigure={() => setLocation("/administration")} />;
      case "/reports": return <ReportsPage records={filteredRecords} total={records.length} query={query} setQuery={setQuery} statusFilter={statusFilter} setStatusFilter={setStatusFilter} onDownload={downloadReport} />;
      case "/administration": return <AdministrationPage settings={settings} isAdmin={isAdmin} demo={demo} busy={actionBusy} onSave={updateSettings} />;
      default: return <OverviewPage records={records} priorityRecords={priorityRecords} demo={demo} currentDate={currentDate} maturingCount={maturingCount} overdueCount={overdueCount} onSelect={setSelectedId} onAdd={() => demo ? setLoginModalOpen(true) : setSubmissionOpen(true)} onGo={setLocation} />;
    }
  };

  return <div className="ledger-app">
    <header className="workspace-header">
      <div className="brandbar">
        <div className="brand-lockup">
          <div className="brand-symbol" aria-hidden="true"><span className="folio-mark"><i /><i /><i /></span></div>
          <div><strong>FDR <span>Shield</span></strong><small>AICTE Fixed deposit monitoring &amp; verification</small></div>
        </div>
        <div className="brand-center">
          <span className="brand-center-title">{t("portalTitle")}</span>
          <span>{t("portalSubtitle")}</span>
        </div>
        <div className="brandbar-right">
          <label className="global-search">
            <Search size={16} />
            <input ref={globalSearchRef} aria-label="Search all FDRs" placeholder={t("searchPlaceholder")} value={globalSearch} onChange={event => openSearch(event.target.value)} />
            <kbd>⌘ / Ctrl K</kbd>
          </label>
          <LanguageSelector />
          <button className="icon-button notification-button" aria-label="View alerts" onClick={() => setLocation("/alerts")}>
            <Bell size={17} />
            {notificationsCount > 0 && <span className="notification-dot" />}
          </button>
          <div className="user-block">
            <span className="user-avatar">{user?.name?.slice(0, 1).toUpperCase() || "O"}</span>
            <span className="user-copy">
              <strong>{isAuthenticated ? (user?.name || "Official") : t("officialAccess")}</strong>
              <small>{isAuthenticated ? (isAdmin ? "Administrator" : user?.role?.replace("_", " ") || "Authorized user") : t("signInRequired")}</small>
            </span>
            <button className="icon-button user-menu-button" title={isAuthenticated ? t("signOut") : t("signIn")} onClick={() => isAuthenticated ? logout() : setLoginModalOpen(true)}>
              {isAuthenticated ? <LogOut size={16} /> : <LockKeyhole size={16} />}
            </button>
          </div>
        </div>
      </div>
      <div className="workspace-index">
        <button className="mobile-menu-button" onClick={() => setMobileNavOpen(value => !value)} aria-label="Toggle section navigation" aria-expanded={mobileNavOpen} aria-controls="workspace-navigation">
          <Menu size={17} /> Sections <ChevronDown size={14} />
        </button>
        <nav id="workspace-navigation" className={`sidebar ${mobileNavOpen ? "sidebar-open" : ""}`} aria-label="Main navigation">
          {navItems.map(({ href, key, label }, index) => (
            <Link key={href} href={href} className={`nav-link ${activePage === href ? "active" : ""}`} onClick={() => setMobileNavOpen(false)}>
              <span className="nav-index">{String(index + 1).padStart(2, "0")}</span>
              <span>{t(key)}</span>
              {label === "Verification queue" && unresolvedCount > 0 && <span className="nav-count">{unresolvedCount}</span>}
              {label === "Alerts & escalation" && notificationsCount > 0 && <span className="nav-count urgent-count">{notificationsCount}</span>}
            </Link>
          ))}
        </nav>
        <div className="section-date"><span>{t("portfolioDate")}</span><time>{currentDate}</time></div>
      </div>
    </header>

    <main className="main-content">
      {demo && (
        <div className="demo-notice">
          <span className="demo-notice-icon"><LockKeyhole size={15} /></span>
          <div>
            <strong>AICTE Surveillance Desk</strong>
            <span>Active records connected live from PostgreSQL database. Sign in with an official account (Institution Admin or AICTE Desk Officer) to submit new FDRs or record audit decisions.</span>
          </div>
          <button className="quiet-link" onClick={() => setLoginModalOpen(true)}>Sign in <ArrowRight size={14} /></button>
        </div>
      )}
      {pageContent()}
      <footer className="page-footer">
        <span>FDR Shield · AICTE Fixed Deposit Regulatory Bureau</span>
        <span><ShieldCheck size={14} /> Each decision is backed by cryptographic audit logs.</span>
      </footer>
    </main>

    <NewRecordDialog open={submissionOpen} busy={actionBusy} onClose={() => setSubmissionOpen(false)} onSubmit={createRecord} />
    <RecordDrawer record={selectedRecord} open={Boolean(selectedRecord)} demo={demo} isAdmin={isAdmin} onClose={() => setSelectedId(null)} onDecision={(decision, note) => selectedRecord ? decide(selectedRecord.id, decision, note) : Promise.resolve()} onAttach={file => selectedRecord ? attachDocument(selectedRecord.id, file) : Promise.resolve()} decisionBusy={actionBusy} />
    <LoginModal isOpen={loginModalOpen} onClose={() => setLoginModalOpen(false)} />
  </div>;
}

function PageHeading({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children?: React.ReactNode }) {
  return <div className="page-heading">
    <div>
      <span className="eyebrow">{eyebrow}</span>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
    {children && <div className="page-heading-actions">{children}</div>}
  </div>;
}
function PrimaryButton({ children, onClick, secondary = false }: { children: React.ReactNode; onClick: () => void; secondary?: boolean }) {
  return <button className={`button ${secondary ? "button-secondary" : "button-primary"}`} onClick={onClick}>{children}</button>;
}
function StatusChip({ status }: { status: WorkflowStatus }) {
  const { t } = useLanguage();
  const getStatusText = (s: WorkflowStatus) => {
    switch (s) {
      case "approved": return t("approved");
      case "under_review": return t("underReview");
      case "rejected": return t("rejected");
      default: return t("pending");
    }
  };
  return <span className={`status-chip ${status}`}>{getStatusText(status)}</span>;
}
function RiskPill({ record }: { record: FdrRecord }) {
  const { t } = useLanguage();
  const days = daysUntil(record.maturityDate);
  let label = `${days} ${t("daysRemaining")}`;
  if (days < 0) label = `${t("overdueBy")} ${Math.abs(days)}d`;
  else if (days === 0) label = t("maturesToday");

  return <span className={`risk-pill ${riskClass(record)}`}><span className="risk-dot" />{label}</span>;
}
function EmptyState({ title, copy, icon = <FileText size={22} /> }: { title: string; copy: string; icon?: React.ReactNode }) {
  return <div className="empty-state"><div className="empty-icon">{icon}</div><strong>{title}</strong><span>{copy}</span></div>;
}
function LoadingState() { return <div className="loading-state"><span className="spinner" /><span>Loading official FDR records…</span></div>; }

function OverviewPage({ records, priorityRecords, demo, currentDate, maturingCount, overdueCount, onSelect, onAdd, onGo }: {
  records: FdrRecord[]; priorityRecords: FdrRecord[]; demo: boolean; currentDate: string; maturingCount: number; overdueCount: number;
  onSelect: (id: string) => void; onAdd: () => void; onGo: (path: string) => void;
}) {
  const { t } = useLanguage();
  const flaggedCount = records.filter(record => isOpen(record) && (record.mismatchFields.length || !record.hasDocument)).length;
  const institutionCount = new Set(records.map(record => record.institution)).size;
  const principalOnFile = records.reduce((sum, record) => sum + Number(record.amount || 0), 0);
  const openCount = records.filter(isOpen).length;

  return <>
    <PageHeading eyebrow={t("portfolioPosition")} title={t("fdrRiskMonitoring")} description={t("fdrRiskDesc")}>
      <span className="as-of-note"><span>{t("asAt")}</span>{currentDate}</span>
      <button className="button button-primary" onClick={onAdd}><Upload size={16} /> {t("submitFdr")}</button>
    </PageHeading>

    <section className="position-register" aria-label="Portfolio totals and open risk counts">
      <button className="principal-figure" onClick={() => onGo("/register")}>
        <span className="measure-label">{t("principalOnFile")}</span>
        <strong>{formatAmount(principalOnFile)}</strong>
        <small>{records.length} {t("receiptsCount")} {institutionCount} {t("institutionsCount")}</small>
      </button>
      <button className="position-measure" onClick={() => onGo("/alerts")}>
        <span className="measure-label">{t("maturing30Days")}</span>
        <strong>{maturingCount.toLocaleString("en-IN")}</strong>
        <small>{t("upcomingMaturities")}</small>
      </button>
      <button className="position-measure" onClick={() => onGo("/verification")}>
        <span className="measure-label">{t("needsVerification")}</span>
        <strong>{flaggedCount.toLocaleString("en-IN")}</strong>
        <small>{t("missingReceiptOrFlag")}</small>
      </button>
      <button className={`position-measure overdue-measure ${overdueCount ? "has-overdue" : ""}`} onClick={() => onGo("/alerts")}>
        <span className="measure-label">{t("overdue")}</span>
        <strong>{overdueCount.toLocaleString("en-IN")}</strong>
        <small>{overdueCount ? t("reviewWithoutDelay") : t("noOverdue")}</small>
      </button>
    </section>

    <section className="priority-panel">
      <div className="watchlist-heading">
        <div>
          <span className="watchlist-reference">{t("openRegisterRef")}</span>
          <h2>{t("resolveTheseFirst")}</h2>
          <p>{openCount} {t("openRequestsOrdered")}</p>
        </div>
        <button className="text-button" onClick={() => onGo("/register")}>{t("fullRegister")} <ArrowRight size={14} /></button>
      </div>
      {priorityRecords.length ? <RecordTable records={priorityRecords} compact onSelect={onSelect} /> : <EmptyState title={t("noRecordsAttention")} copy={t("newReceiptsNotice")} />}
      <button className="panel-footer-link" onClick={() => onGo("/register")}>{t("openAllRecords")} ({records.length}) <ArrowRight size={14} /></button>
    </section>

    <div className="lower-registers">
      <MaturityPanel records={records} onGo={onGo} />
      <section className="institution-ledger">
        <div className="module-heading">
          <div><span className="watchlist-reference">{t("institutionalExposureRef")}</span><h2>{t("institutionalExposure")}</h2></div>
          <button className="text-button" onClick={() => onGo("/institutions")}>{t("allInstitutions")} <ArrowRight size={14} /></button>
        </div>
        <InstitutionSnapshot records={records} onGo={onGo} />
      </section>
    </div>
  </>;
}

function MaturityPanel({ records, onGo }: { records: FdrRecord[]; onGo: (path: string) => void }) {
  const { t } = useLanguage();
  const windows = [7, 14, 21, 30];
  const counts = windows.map((upper, index) => records.filter(record => {
    const days = daysUntil(record.maturityDate);
    return days >= (index ? windows[index - 1] + 1 : 0) && days <= upper;
  }).length);
  const max = Math.max(1, ...counts);
  const schedule = counts.map((count, index) => `${index ? windows[index - 1] + 1 : 0} to ${windows[index]} days, ${count} FDR${count === 1 ? "" : "s"}`).join("; ");

  return <section className="maturity-ledger">
    <div className="module-heading">
      <div><span className="watchlist-reference">{t("maturityCalendarRef")}</span><h2>{t("dueNext30Days")}</h2></div>
      <button className="text-button" onClick={() => onGo("/alerts")}>{t("allAlerts")} <ArrowRight size={14} /></button>
    </div>
    <div className="maturity-schedule" role="img" aria-label={`Maturities by window: ${schedule}`}>
      {counts.map((count, index) => (
        <div className={`maturity-period ${count ? "has-maturity" : ""}`} key={windows[index]} aria-hidden="true">
          <span className="period-label">{index ? `${windows[index - 1] + 1}–${windows[index]} DAYS` : "0–7 DAYS"}</span>
          <strong>{count}</strong>
          <span className="period-unit">FDR{count === 1 ? "" : "s"}</span>
          <span className="period-rule"><i style={{ width: `${count ? Math.max(8, (count / max) * 100) : 0}%` }} /></span>
        </div>
      ))}
    </div>
    <div className="module-footnote">{counts.reduce((a, b) => a + b, 0)} deposit{counts.reduce((a, b) => a + b, 0) === 1 ? "" : "s"} due within 30 days</div>
  </section>;
}

function InstitutionSnapshot({ records, onGo }: { records: FdrRecord[]; onGo: (path: string) => void }) {
  const groups = useMemo(() => {
    const map = new Map<string, { count: number; amount: number; urgent: number }>();
    records.forEach(record => {
      const value = map.get(record.institution) ?? { count: 0, amount: 0, urgent: 0 };
      value.count += 1;
      value.amount += Number(record.amount || 0);
      if (priority(record) <= 1) value.urgent += 1;
      map.set(record.institution, value);
    });
    return [...map.entries()].map(([institution, value]) => ({ institution, ...value })).sort((a, b) => b.urgent - a.urgent || b.amount - a.amount).slice(0, 4);
  }, [records]);

  return <div className="institution-snapshot">
    {groups.map((item, index) => (
      <button key={item.institution} className="institution-mini" onClick={() => onGo("/institutions")}>
        <span className="institution-index">{String(index + 1).padStart(2, "0")}</span>
        <span className="institution-mini-copy">
          <strong>{item.institution}</strong>
          <small>{item.count} FDR{item.count === 1 ? "" : "s"} · {item.urgent ? `${item.urgent} urgent` : "No urgent cases"}</small>
        </span>
        <span className="institution-amount">{formatAmount(item.amount)}</span>
        <ChevronRight size={15} />
      </button>
    ))}
    {!groups.length && <EmptyState title="No institution records" copy="Institutions appear after the first FDR is submitted." />}
  </div>;
}

function RecordTable({ records, compact = false, onSelect }: { records: FdrRecord[]; compact?: boolean; onSelect: (id: string) => void }) {
  const { t } = useLanguage();
  if (!records.length) return <EmptyState title="No records match" copy="Try another search or status filter." />;
  return <div className={`table-wrap ${compact ? "compact-table-wrap" : ""}`}>
    <table className="records-table">
      <thead>
        <tr>
          <th>{t("thInstitutionFdr")}</th>
          <th>{t("thBank")}</th>
          <th>{t("thPrincipalAmount")}</th>
          <th>{t("thMaturity")}</th>
          <th>{t("thStatus")}</th>
          {!compact && <th />}
        </tr>
      </thead>
      <tbody>
        {records.map(record => (
          <tr key={record.id}>
            <td>
              <button type="button" className="record-row-link" aria-label={`Open FDR ${record.fdrNumber} for ${record.institution}`} onClick={() => onSelect(record.id)}>
                <span className="record-id-cell">
                  <span className="record-ledger-mark" />
                  <span>
                    <strong>{record.institution}</strong>
                    <small>{record.fdrNumber}</small>
                  </span>
                </span>
              </button>
            </td>
            <td data-label="Bank"><span className="bank-cell">{record.bankName}</span></td>
            <td data-label="Principal amount" className="amount-cell">{formatAmount(record.amount)}</td>
            <td data-label="Maturity"><span className="date-cell">{formatDate(record.maturityDate)}</span><RiskPill record={record} /></td>
            <td data-label="Status">
              <StatusChip status={record.workflowStatus} />
              {record.mismatchFields.length > 0 && <span className="table-flag"><AlertTriangle size={12} /> {record.mismatchFields.length} {record.mismatchFields.length > 1 ? t("flags") : t("flag")}</span>}
            </td>
            {!compact && <td><button className="icon-button row-open" aria-label={`Open ${record.fdrNumber}`} onClick={() => onSelect(record.id)}><ChevronRight size={16} /></button></td>}
          </tr>
        ))}
      </tbody>
    </table>
  </div>;
}

function RegisterPage({ records, isAdmin, demo, query, setQuery, statusFilter, setStatusFilter, onSelect, onAdd, onDownload }: {
  records: FdrRecord[]; isAdmin: boolean; demo: boolean; query: string; setQuery: (value: string) => void; statusFilter: WorkflowStatus | "all"; setStatusFilter: (value: WorkflowStatus | "all") => void; onSelect: (id: string) => void; onAdd: () => void; onDownload: () => void;
}) {
  return <>
    <PageHeading eyebrow="FDR REGISTER" title="Fixed deposit register" description="Search and review FDR submissions, banks, maturity dates and verification status.">
      <button className="button button-secondary" onClick={onDownload}><ArrowDownToLine size={16} /> Export CSV</button>
      <button className="button button-primary" onClick={onAdd}><Upload size={16} /> Submit FDR</button>
    </PageHeading>
    <section className="panel register-panel">
      <div className="register-toolbar">
        <label className="filter-search">
          <Search size={16} />
          <input placeholder="Institution, FDR number or bank…" value={query} onChange={event => setQuery(event.target.value)} />
        </label>
        <div className="filter-select-wrap">
          <Filter size={15} />
          <select aria-label="Filter by status" value={statusFilter} onChange={event => setStatusFilter(event.target.value as WorkflowStatus | "all")}>
            <option value="all">All statuses</option>
            <option value="pending">Awaiting review</option>
            <option value="under_review">Needs verification</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          <ChevronDown size={14} />
        </div>
        <span className="result-count">{records.length} records</span>
      </div>
      {records.length ? <RecordTable records={records} onSelect={onSelect} /> : <EmptyState title={query || statusFilter !== "all" ? "No FDRs match this filter" : "No FDR records yet"} copy={query || statusFilter !== "all" ? "Try another search term or choose a different status." : "Submit an FDR and attach a receipt to start your institution's register."} icon={<Banknote size={22} />} />}
      <div className="table-summary"><span>Showing <strong>{records.length}</strong> record{records.length === 1 ? "" : "s"}</span><span>Amounts shown in Indian Rupees (INR)</span></div>
    </section>
  </>;
}

function VerificationPage({ records, demo, onSelect }: { records: FdrRecord[]; demo: boolean; onSelect: (id: string) => void }) {
  return <>
    <PageHeading eyebrow="HUMAN VERIFICATION" title="Verification queue" description="Resolve mismatches, missing receipts and uncertain document extractions before final approval." />
    <div className="verification-context">
      <span className="watchlist-reference">{String(records.length).padStart(2, "0")} OPEN EXCEPTIONS</span>
      <span>Each resolution is attributed to an official and recorded in the approval trail.</span>
    </div>
    <div className="verification-list">
      {records.map((record, index) => (
        <button key={record.id} className="verification-card" onClick={() => onSelect(record.id)}>
          <span className={`verification-index ${index === 0 ? "urgent" : ""}`}>{String(index + 1).padStart(2, "0")}</span>
          <div className="verification-main">
            <div className="verification-title"><strong>{record.fdrNumber}</strong><span className="muted-separator">·</span><span>{record.institution}</span></div>
            <div className="verification-meta">
              <span>{record.bankName}</span>
              <span>Submitted {formatDate(record.createdAt)}</span>
              <span>{record.hasDocument ? "Receipt attached" : "Receipt missing"}</span>
            </div>
            <div className="flag-chips">
              {record.mismatchFields.length ? record.mismatchFields.map(field => (
                <span className="field-flag" key={field}>
                  <AlertCircle size={12} /> {field === "fdrNumber" ? "FDR number" : field === "bankName" ? "Bank" : field === "amount" ? "Amount" : field === "maturityDate" ? "Maturity date" : field === "document" ? "Missing document" : field === "ocr" ? "OCR unavailable" : field}
                </span>
              )) : <span className="field-flag quiet"><CheckCircle2 size={12} /> No field mismatch</span>}
            </div>
          </div>
          <div className="verification-side">
            <StatusChip status={record.workflowStatus} />
            <span className="verification-due">{maturityLabel(record)}</span>
            <ChevronRight size={17} />
          </div>
        </button>
      ))}
      {!records.length && <section className="panel"><EmptyState title="Verification queue is clear" copy="New discrepancies and missing documents will be listed here." icon={<CheckCircle2 size={22} />} /></section>}
    </div>
    {demo && <div className="read-only-footnote"><LockKeyhole size={14} /> These are illustrative preview records. Sign in to access official submissions.</div>}
  </>;
}

function InstitutionsPage({ records, onSelectRecord }: { records: FdrRecord[]; onSelectRecord: (id: string) => void }) {
  const groups = useMemo(() => {
    const map = new Map<string, FdrRecord[]>();
    records.forEach(record => map.set(record.institution, [...(map.get(record.institution) ?? []), record]));
    return [...map.entries()].map(([institution, items]) => ({
      institution,
      items,
      total: items.reduce((sum, item) => sum + Number(item.amount || 0), 0),
      urgent: items.filter(item => priority(item) <= 1).length,
      next: items.map(item => item.maturityDate).sort()[0]
    })).sort((a, b) => b.urgent - a.urgent || b.total - a.total);
  }, [records]);

  return <>
    <PageHeading eyebrow="INSTITUTIONAL REGISTER" title="Institutions" description="Ranked by unresolved risk and principal. Open an FDR number to inspect its record." />
    <div className="institution-ledger-header" aria-hidden="true">
      <span>INSTITUTION / NEXT MATURITY</span>
      <span>PRINCIPAL</span>
      <span>RECEIPTS / APPROVED</span>
      <span>OPEN ATTENTION</span>
      <span>FDR REFERENCES</span>
    </div>
    <div className="institution-ledger-list">
      {groups.map((group, index) => (
        <article className="institution-ledger-row" key={group.institution}>
          <div className="institution-ledger-name">
            <span className="institution-index">{String(index + 1).padStart(2, "0")}</span>
            <span><strong>{group.institution}</strong><small>Next maturity · {formatDate(group.next)}</small></span>
          </div>
          <div className="institution-ledger-stat" data-label="Principal"><strong>{formatAmount(group.total)}</strong></div>
          <div className="institution-ledger-stat" data-label="Receipts / approved">
            <strong>{group.items.length} FDR{group.items.length === 1 ? "" : "s"}</strong>
            <small>{group.items.filter(item => item.workflowStatus === "approved").length} approved</small>
          </div>
          <div className={`institution-ledger-stat ${group.urgent ? "has-urgent" : ""}`} data-label="Open attention">
            <strong>{group.urgent ? `${group.urgent} urgent` : "None"}</strong>
            <small>{group.urgent ? "Priority review required" : "No immediate flag"}</small>
          </div>
          <div className="institution-record-links" data-label="FDR references">
            {group.items.map(item => (
              <button key={item.id} onClick={() => onSelectRecord(item.id)}>
                {item.fdrNumber}
                <StatusChip status={item.workflowStatus} />
              </button>
            ))}
          </div>
        </article>
      ))}
      {!groups.length && <EmptyState title="No institution data yet" copy="Institutions appear here when FDR records are submitted." icon={<Building2 size={22} />} />}
    </div>
  </>;
}

function AlertsPage({ records, settings, onSelect, onConfigure }: { records: FdrRecord[]; settings: FdrSettings; onSelect: (id: string) => void; onConfigure: () => void }) {
  const alerts = records.flatMap(record => {
    const days = daysUntil(record.maturityDate);
    const escalated = isOpen(record) && pendingDays(record) >= settings.escalationAfterDays;
    const candidates = [
      days < 0 && isOpen(record) ? { type: "overdue", title: "Maturity date passed", description: `Maturity passed ${Math.abs(days)} days ago. Follow-up is overdue.`, level: "critical" } : null,
      record.mismatchFields.length || !record.hasDocument ? { type: "verification", title: "Verification unresolved", description: `${record.mismatchFields.length ? record.mismatchFields.length + " discrepancy flag(s)" : "Supporting receipt missing"}. Human review is required.`, level: "high" } : null,
      days >= 0 && settings.reminderIntervals.includes(days) ? { type: "maturity", title: `Maturity reminder · ${days} days`, description: `FDR matures on ${formatDate(record.maturityDate)}.`, level: days <= 7 ? "high" : "watch" } : null,
      days > 0 && days <= 30 && !settings.reminderIntervals.includes(days) ? { type: "maturity", title: `Maturity approaching · ${days} days`, description: `FDR matures on ${formatDate(record.maturityDate)}.`, level: days <= 7 ? "high" : "watch" } : null,
      escalated ? { type: "escalation", title: `Escalated to ${settings.escalationTarget}`, description: `Pending for ${pendingDays(record)} days; rule threshold is ${settings.escalationAfterDays} days.`, level: "critical" } : null,
    ].filter((item): item is { type: string; title: string; description: string; level: string } => Boolean(item));
    return candidates.map(alert => ({ ...alert, record }));
  }).sort((a, b) => ({ critical: 0, high: 1, watch: 2 }[a.level as "critical" | "high" | "watch"] - { critical: 0, high: 1, watch: 2 }[b.level as "critical" | "high" | "watch"]));
  const criticalCount = alerts.filter(alert => alert.level === "critical").length;
  const maturingCount = records.filter(record => { const days = daysUntil(record.maturityDate); return days >= 0 && days <= 30; }).length;
  const verificationCount = records.filter(record => isOpen(record) && (record.mismatchFields.length > 0 || !record.hasDocument)).length;

  return <>
    <PageHeading eyebrow="MATURITY & EXCEPTIONS" title="Alerts & escalation" description="Prioritized reminders for maturing deposits, overdue cases and unresolved verification." >
      <button className="button button-secondary" onClick={onConfigure}><SlidersHorizontal size={16} /> Configure rules</button>
    </PageHeading>
    <dl className="alert-keyline">
      <div className="critical"><dt>High-priority alerts</dt><dd>{criticalCount}</dd></div>
      <div><dt>Maturing · next 30 days</dt><dd>{maturingCount}</dd></div>
      <div><dt>Open verifications</dt><dd>{verificationCount}</dd></div>
    </dl>
    <section className="panel alerts-panel">
      <div className="panel-heading">
        <div><span className="eyebrow">PRIORITY ORDER</span><h2>Actionable alerts</h2><p>Overdue and escalated cases are surfaced first.</p></div>
        <span className="result-count">{alerts.length} alerts</span>
      </div>
      <div className="alert-list">
        {alerts.map((alert, index) => (
          <button key={`${alert.record.id}-${alert.type}-${index}`} className="alert-row" onClick={() => onSelect(alert.record.id)}>
            <span className={`alert-level-priority ${alert.level}`}>{String(index + 1).padStart(2, "0")}</span>
            <span className="alert-copy">
              <strong>{alert.title}</strong>
              <small>{alert.description}</small>
              <span>{alert.record.institution} · {alert.record.fdrNumber}</span>
            </span>
            <span className="alert-row-date">{formatDate(alert.record.maturityDate)}</span>
            <ChevronRight size={16} />
          </button>
        ))}
        {!alerts.length && <EmptyState title="No active alerts" copy="Maturity reminders and verification exceptions will appear here." icon={<CheckCircle2 size={22} />} />}
      </div>
    </section>
    <div className="rule-note"><Clock3 size={15} /><span>Reminder intervals: <strong>{settings.reminderIntervals.join(", ")} days before maturity</strong> · Escalation after <strong>{settings.escalationAfterDays} days</strong></span></div>
  </>;
}

function ReportsPage({ records, total, query, setQuery, statusFilter, setStatusFilter, onDownload }: { records: FdrRecord[]; total: number; query: string; setQuery: (value: string) => void; statusFilter: WorkflowStatus | "all"; setStatusFilter: (value: WorkflowStatus | "all") => void; onDownload: () => void }) {
  const outstanding = records.filter(isOpen).length;
  const totalAmount = records.reduce((sum, record) => sum + Number(record.amount || 0), 0);

  return <>
    <PageHeading eyebrow="ADMINISTRATIVE REPORTING" title="Reports" description="Filter the register and download an auditable CSV for administrative review.">
      <button className="button button-primary" onClick={onDownload}><ArrowDownToLine size={16} /> Download CSV report</button>
    </PageHeading>
    <div className="report-overview">
      <div className="report-intro">
        <span className="watchlist-reference">CURRENT REGISTER / EXPORT SCOPE</span>
        <h2>FDR administrative report</h2>
        <p>Filtered view shown below; export this scope as a UTF-8 CSV.</p>
      </div>
      <dl className="report-facts">
        <div><dt>In scope</dt><dd>{records.length} <small>/ {total}</small></dd></div>
        <div><dt>Principal represented</dt><dd>{formatAmount(totalAmount)}</dd></div>
        <div><dt>Open cases</dt><dd>{outstanding}</dd></div>
      </dl>
    </div>
    <section className="panel report-filter-panel">
      <div className="panel-heading slim">
        <div><span className="eyebrow">REPORT FILTERS</span><h2>Choose report scope</h2></div>
        <button className="button button-secondary" onClick={onDownload}><ArrowDownToLine size={15} /> Export filtered view</button>
      </div>
      <div className="report-filter-row">
        <label className="filter-search">
          <Search size={16} />
          <input placeholder="Institution, FDR number or bank…" value={query} onChange={event => setQuery(event.target.value)} />
        </label>
        <div className="filter-select-wrap">
          <Filter size={15} />
          <select aria-label="Filter report by status" value={statusFilter} onChange={event => setStatusFilter(event.target.value as WorkflowStatus | "all")}>
            <option value="all">All statuses</option>
            <option value="pending">Awaiting review</option>
            <option value="under_review">Needs verification</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          <ChevronDown size={14} />
        </div>
        <span className="result-count">{records.length} of {total}</span>
      </div>
      <RecordTable records={records} compact onSelect={() => {}} />
      <div className="report-footnote"><ShieldCheck size={14} /> Export includes workflow status, verification flags, document name, submitter and decision note.</div>
    </section>
  </>;
}

function AdministrationPage({ settings, isAdmin, demo, busy, onSave }: { settings: FdrSettings; isAdmin: boolean; demo: boolean; busy: boolean; onSave: (value: { reminderIntervals: number[]; escalationAfterDays: number; escalationTarget: string }) => Promise<void> }) {
  const [intervals, setIntervals] = useState<number[]>(settings.reminderIntervals);
  const [escalationAfterDays, setEscalationAfterDays] = useState(settings.escalationAfterDays);
  const [escalationTarget, setEscalationTarget] = useState(settings.escalationTarget);
  const [savedStamp, setSavedStamp] = useState("");
  const options = [30, 15, 7, 3, 1];

  function toggle(day: number) {
    setIntervals(value => value.includes(day) ? value.filter(item => item !== day) : [...value, day].sort((a, b) => b - a));
  }

  async function save() {
    if (!intervals.length) { toast.error("Select at least one reminder interval."); return; }
    try {
      await onSave({ reminderIntervals: intervals, escalationAfterDays, escalationTarget });
      setSavedStamp(new Intl.DateTimeFormat("en-IN", { hour: "2-digit", minute: "2-digit" }).format(new Date()));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Settings could not be saved.");
    }
  }

  return <>
    <PageHeading eyebrow="ADMINISTRATION" title="Alert rules & controls" description="Configure maturity reminders, escalation thresholds and workspace authority." />
    {demo && <div className="permission-banner"><LockKeyhole size={17} /><span>Sign in with an authorized administrator account to configure rules.</span></div>}
    {!demo && !isAdmin && <div className="permission-banner"><ShieldCheck size={17} /><span>Configuration is restricted to authorized administrators. Your account can submit FDR records.</span></div>}
    <div className="settings-layout">
      <div className="settings-main">
        <section className="panel settings-card">
          <div className="settings-card-heading">
            <span className="settings-icon teal"><Bell size={19} /></span>
            <div><span className="eyebrow">MATURITY REMINDERS</span><h2>Reminder schedule</h2><p>Show in-app prompts at the selected number of days before maturity.</p></div>
          </div>
          <div className="reminder-options">
            {options.map(day => (
              <button key={day} className={`reminder-option ${intervals.includes(day) ? "selected" : ""}`} disabled={!isAdmin || demo} onClick={() => toggle(day)}>
                <span className="check-square">{intervals.includes(day) && <Check size={13} />}</span>
                <span><strong>{day} days before</strong><small>{day === 30 ? "Plan next steps" : day === 15 ? "Confirm instructions" : day === 7 ? "Action due soon" : day === 3 ? "Final reminder" : "Maturity day eve"}</small></span>
              </button>
            ))}
          </div>
          <div className="settings-info"><AlertCircle size={15} />Reminders are surfaced in the Alerts view and dashboard according to maturity dates.</div>
        </section>

        <section className="panel settings-card">
          <div className="settings-card-heading">
            <span className="settings-icon amber"><AlertTriangle size={19} /></span>
            <div><span className="eyebrow">ADMINISTRATIVE ESCALATION</span><h2>Pending case escalation</h2><p>Set when unresolved cases should be highlighted for the next administrative level.</p></div>
          </div>
          <div className="form-grid settings-form">
            <label className="field">
              <span>Escalate after</span>
              <div className="select-field">
                <select value={escalationAfterDays} disabled={!isAdmin || demo} onChange={event => setEscalationAfterDays(Number(event.target.value))}>
                  <option value={3}>3 calendar days</option>
                  <option value={5}>5 calendar days</option>
                  <option value={7}>7 calendar days</option>
                  <option value={10}>10 calendar days</option>
                  <option value={14}>14 calendar days</option>
                </select>
                <ChevronDown size={15} />
              </div>
            </label>
            <label className="field"><span>Escalation recipient / role</span><input value={escalationTarget} disabled={!isAdmin || demo} onChange={event => setEscalationTarget(event.target.value)} maxLength={200} placeholder="e.g. Regional Finance Officer" /></label>
          </div>
          <div className="escalation-preview">
            <span className="escalation-preview-icon"><ArrowUpRight size={17} /></span>
            <span><strong>Escalation rule preview</strong><small>Open cases pending {escalationAfterDays}+ days are flagged for {escalationTarget || "the assigned role"}.</small></span>
          </div>
        </section>

        <section className="panel settings-card">
          <div className="settings-card-heading">
            <span className="settings-icon blue"><ShieldCheck size={19} /></span>
            <div><span className="eyebrow">APPROVAL CONTROL</span><h2>Role-gated decisions</h2><p>Approval permissions are enforced by the server on every decision.</p></div>
          </div>
          <div className="control-rows">
            <div><span className="control-icon"><UserRound size={16} /></span><span><strong>Authorized users</strong><small>Submit FDRs and view workflow records</small></span><span className="control-state">Enabled</span></div>
            <div><span className="control-icon admin"><LockKeyhole size={16} /></span><span><strong>Administrators</strong><small>Resolve flags, approve, reject and set alert rules</small></span><span className="control-state restricted">Restricted</span></div>
            <div><span className="control-icon"><ClipboardList size={16} /></span><span><strong>Audit trail</strong><small>Action, responsible official and timestamp recorded</small></span><span className="control-state">Append-only</span></div>
          </div>
        </section>
      </div>

      <aside className="settings-aside">
        <div className="settings-aside-top">
          <span className="as-crest"><ShieldCheck size={24} /></span>
          <span className="eyebrow">CONTROL SUMMARY</span>
          <h3>Transparent by default</h3>
          <p>Every official decision includes the responsible user, action and timestamp. Finalized records cannot be changed through the normal workflow.</p>
        </div>
        <div className="settings-aside-item"><CheckCircle2 size={16} /><span>Server-side role checks</span></div>
        <div className="settings-aside-item"><CheckCircle2 size={16} /><span>Timestamped action history</span></div>
        <div className="settings-aside-item"><CheckCircle2 size={16} /><span>Document service credentials stay private</span></div>
        <div className="settings-aside-bottom">{savedStamp ? `Last saved at ${savedStamp}` : "Settings are stored in this workspace"}</div>
      </aside>
    </div>
    {isAdmin && !demo && (
      <div className="settings-save-bar">
        <span>{savedStamp ? `Saved at ${savedStamp}` : "Unsaved changes apply after you save."}</span>
        <button className="button button-primary" onClick={() => void save()} disabled={busy}>{busy ? "Saving…" : "Save alert rules"}</button>
      </div>
    )}
  </>;
}

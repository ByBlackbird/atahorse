import { useEffect, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { RequireCompany } from "@/components/RequireCompany";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { dueFollowUp, FOLLOW_UP_DAYS, LEAD_STAGE_LABEL, LEAD_STAGES, LOST_REASONS, type LeadStage, type LostReason } from "@contracts/funnel";
import {
  APPROVAL_LABEL,
  APPROVAL_STATES,
  CASE_STATUSES,
  CASE_STATUS_LABEL,
  CONSULTING_PACKAGES,
  LINE_LABEL,
  getPackage,
  type ApprovalState,
  type CaseStatus,
} from "@contracts/consulting";
import { formatCompanyName, formatPersonName, formatPhoneTR, normalizeEmail } from "@contracts/normalize";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  Inbox,
  Mail,
  Phone,
  Plus,
  Send,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";

const APPROVAL_CLS: Record<ApprovalState, string> = {
  none: "bg-secondary text-muted-foreground",
  pending: "bg-primary text-primary-foreground",
  approved: "bg-mint text-white",
  revision: "bg-[hsl(38_92%_55%/0.2)] text-[hsl(38_92%_28%)]",
  rejected: "bg-destructive text-destructive-foreground",
};

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(text);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      /* pano izni yok */
    }
  };
  return { copied, copy };
}

type NewCaseSeed = {
  leadId: number | null;
  clientName: string;
  companyName: string;
  email: string;
  phone: string;
  packageId: string;
};

function guessPackage(interest: string | null | undefined): string {
  if (!interest) return "rontgen";
  const lower = interest.toLocaleLowerCase("tr");
  return CONSULTING_PACKAGES.find((p) => lower.includes(p.name.toLocaleLowerCase("tr")))?.id ?? "rontgen";
}

// ---------------- Yeni süreç formu ----------------

function NewCaseForm({ seed, onDone, onCancel }: { seed: NewCaseSeed; onDone: (id: number) => void; onCancel: () => void }) {
  const utils = trpc.useUtils();
  const [f, setF] = useState({ ...seed, startDate: "", targetDate: "", notify: true });
  const create = trpc.consulting.admin.create.useMutation({
    onSuccess: async (r) => {
      await Promise.all([utils.consulting.admin.list.invalidate(), utils.lead.list.invalidate()]);
      if (r.mailed) toast.success(`Süreç açıldı, takip kodu ${r.refCode} e-postayla gönderildi.`);
      else if (r.mailError) toast.error(`Süreç açıldı (${r.refCode}) ama e-posta gitmedi: ${r.mailError}`, { duration: 15000 });
      else toast.success(`Süreç açıldı: ${r.refCode}`);
      onDone(r.id);
    },
  });
  const set = (k: keyof typeof f, v: string | boolean) => setF((x) => ({ ...x, [k]: v }));

  return (
    <form
      className="chamfer grid gap-3 border border-mint bg-mint-soft/50 p-5 md:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        create.mutate({
          leadId: f.leadId,
          clientName: f.clientName,
          companyName: f.companyName || null,
          email: f.email || null,
          phone: f.phone || null,
          packageId: f.packageId,
          startDate: f.startDate || null,
          targetDate: f.targetDate || null,
          notifyClient: f.notify,
        });
      }}
    >
      <p className="label-caps md:col-span-2">YENİ DANIŞMANLIK SÜRECİ{f.leadId ? " · talepten" : ""}</p>
      <div>
        <label htmlFor="nc-name" className="label-caps mb-1 block">Müşteri adı *</label>
        <Input id="nc-name" value={f.clientName} onChange={(e) => set("clientName", e.target.value)} onBlur={(e) => set("clientName", formatPersonName(e.target.value))} required minLength={2} />
      </div>
      <div>
        <label htmlFor="nc-company" className="label-caps mb-1 block">Ofis / şirket</label>
        <Input id="nc-company" value={f.companyName} onChange={(e) => set("companyName", e.target.value)} onBlur={(e) => set("companyName", formatCompanyName(e.target.value))} />
      </div>
      <div>
        <label htmlFor="nc-email" className="label-caps mb-1 block">E-posta (kod buraya gider)</label>
        <Input id="nc-email" type="email" value={f.email} onChange={(e) => set("email", e.target.value)} onBlur={(e) => set("email", normalizeEmail(e.target.value))} />
      </div>
      <div>
        <label htmlFor="nc-phone" className="label-caps mb-1 block">Telefon</label>
        <Input id="nc-phone" value={f.phone} onChange={(e) => set("phone", e.target.value)} onBlur={(e) => set("phone", formatPhoneTR(e.target.value))} />
      </div>
      <div className="md:col-span-2">
        <label htmlFor="nc-pkg" className="label-caps mb-1 block">Paket *</label>
        <select id="nc-pkg" value={f.packageId} onChange={(e) => set("packageId", e.target.value)} className="chamfer-sm h-10 w-full border border-border bg-background px-3 text-[13px]">
          {(["duzen", "sureklilik", "ai"] as const).map((ln) => (
            <optgroup key={ln} label={LINE_LABEL[ln]}>
              {CONSULTING_PACKAGES.filter((p) => p.line === ln).map((p) => (
                <option key={p.id} value={p.id}>{p.code} · {p.name}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="nc-start" className="label-caps mb-1 block">Başlangıç</label>
        <Input id="nc-start" type="date" value={f.startDate} onChange={(e) => set("startDate", e.target.value)} />
      </div>
      <div>
        <label htmlFor="nc-target" className="label-caps mb-1 block">Hedef bitiş</label>
        <Input id="nc-target" type="date" value={f.targetDate} onChange={(e) => set("targetDate", e.target.value)} />
      </div>
      <label className="flex items-center gap-2 text-[13px] md:col-span-2">
        <input type="checkbox" checked={f.notify} onChange={(e) => set("notify", e.target.checked)} disabled={!f.email} />
        Referans kodunu müşteriye e-postayla gönder {!f.email && <span className="text-muted-foreground">(e-posta yok)</span>}
      </label>
      {create.error && <p className="text-[12.5px] text-destructive md:col-span-2">{create.error.message}</p>}
      <div className="flex justify-end gap-2 md:col-span-2">
        <button type="button" onClick={onCancel} className="chamfer-sm border border-border bg-card px-3 py-2 text-[12.5px]">Vazgeç</button>
        <button type="submit" disabled={create.isPending} className="chamfer-sm bg-primary px-4 py-2 font-display text-[12.5px] font-semibold text-primary-foreground disabled:opacity-50">
          {create.isPending ? "Oluşturuluyor…" : "Süreci başlat ve kod üret"}
        </button>
      </div>
    </form>
  );
}

// ---------------- Süreç detayı ----------------

function CaseDetail({ id, onClose }: { id: number; onClose: () => void }) {
  const utils = trpc.useUtils();
  const q = trpc.consulting.admin.get.useQuery({ id });
  const { copied, copy } = useCopy();
  const [stageNote, setStageNote] = useState("");
  const [approvalNote, setApprovalNote] = useState("");
  const [noteTitle, setNoteTitle] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [notePublic, setNotePublic] = useState(true);
  const [internal, setInternal] = useState<string | null>(null);

  const refresh = async () => {
    await Promise.all([utils.consulting.admin.get.invalidate({ id }), utils.consulting.admin.list.invalidate()]);
  };
  const setStage = trpc.consulting.admin.setStage.useMutation({ onSuccess: async () => { setStageNote(""); await refresh(); } });
  const setApproval = trpc.consulting.admin.setApproval.useMutation({ onSuccess: async () => { setApprovalNote(""); await refresh(); } });
  const setStatus = trpc.consulting.admin.setStatus.useMutation({ onSuccess: refresh });
  const addNote = trpc.consulting.admin.addNote.useMutation({ onSuccess: async () => { setNoteTitle(""); setNoteBody(""); await refresh(); } });
  const removeEvent = trpc.consulting.admin.removeEvent.useMutation({ onSuccess: refresh });
  const update = trpc.consulting.admin.update.useMutation({ onSuccess: refresh });
  const sendCode = trpc.consulting.admin.sendCode.useMutation({
    onSuccess: () => toast.success("Takip kodu e-postayla gönderildi."),
    onError: (e) => toast.error(e.message, { duration: 15000 }),
  });
  const remove = trpc.consulting.admin.remove.useMutation({
    onSuccess: async () => {
      await utils.consulting.admin.list.invalidate();
      onClose();
    },
  });

  if (q.isLoading) return <div className="chamfer h-80 animate-pulse bg-secondary" />;
  if (!q.data) return <p className="text-[13px] text-destructive">{q.error?.message ?? "Kayıt bulunamadı."}</p>;
  const { case: c, events, view } = q.data;
  const pkg = getPackage(c.packageId);
  const stages = pkg?.stages ?? [];
  const trackLink = `${window.location.origin}/takip/${c.refCode}`;
  const err = setStage.error ?? setApproval.error ?? setStatus.error ?? addNote.error ?? update.error ?? sendCode.error ?? remove.error;

  return (
    <div className="chamfer border border-border bg-card">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-5">
        <div>
          <p className="font-display text-xl font-bold tracking-[0.12em]">{c.refCode}</p>
          <p className="mt-0.5 text-[13.5px]">
            <strong>{c.clientName}</strong>
            {c.companyName ? ` · ${c.companyName}` : ""} — {pkg?.name ?? c.packageId}
          </p>
          <p className="mt-0.5 flex flex-wrap gap-x-4 text-[12px] text-muted-foreground">
            {c.email && <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" /> {c.email}</span>}
            {c.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" /> {c.phone}</span>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => copy(trackLink)} className="chamfer-sm inline-flex items-center gap-1.5 border border-border px-3 py-1.5 text-[12px]">
            <Copy className="h-3.5 w-3.5" /> {copied === trackLink ? "Kopyalandı" : "Takip linki"}
          </button>
          <a href={trackLink} target="_blank" rel="noreferrer" className="chamfer-sm inline-flex items-center gap-1.5 border border-border px-3 py-1.5 text-[12px]">
            <ExternalLink className="h-3.5 w-3.5" /> Müşteri görünümü
          </a>
          <button
            type="button"
            disabled={!c.email || sendCode.isPending}
            onClick={() => sendCode.mutate({ id })}
            className="chamfer-sm inline-flex items-center gap-1.5 border border-mint px-3 py-1.5 text-[12px] font-semibold text-mint disabled:opacity-40"
          >
            <Send className="h-3.5 w-3.5" /> {sendCode.isSuccess ? "Gönderildi" : "Kodu e-postala"}
          </button>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Kapat">
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {err && (
        <p className="flex items-center gap-1.5 border-b border-border px-5 py-2 text-[12.5px] text-destructive">
          <TriangleAlert className="h-3.5 w-3.5" /> {err.message}
        </p>
      )}

      <div className="grid gap-5 p-5 lg:grid-cols-2">
        {/* Aşama */}
        <div>
          <p className="label-caps mb-2">AŞAMA ({c.stageIndex + 1}/{stages.length}) · %{view.progress}</p>
          <ol className="space-y-1">
            {stages.map((s, i) => (
              <li key={s.key}>
                <button
                  type="button"
                  disabled={setStage.isPending || i === c.stageIndex}
                  onClick={() => {
                    if (i !== c.stageIndex && confirm(`Aşama “${s.label}” olarak değiştirilsin mi? Müşteri takip ekranında görünür.`)) {
                      setStage.mutate({ id, stageIndex: i, note: stageNote || undefined });
                    }
                  }}
                  className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[13px] ${
                    i === c.stageIndex ? "chamfer-sm bg-primary font-semibold text-primary-foreground" : i < c.stageIndex ? "text-muted-foreground line-through" : "hover:bg-secondary"
                  }`}
                >
                  <span className="w-5 text-[11px] tnum">{i + 1}.</span> {s.label}
                  {s.needsApproval && <span className="ml-auto text-[10px] uppercase opacity-70">onay</span>}
                </button>
              </li>
            ))}
          </ol>
          <Input className="mt-2" value={stageNote} onChange={(e) => setStageNote(e.target.value)} placeholder="Aşama notu (müşteri görür, opsiyonel)" />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={c.stageIndex === 0 || setStage.isPending}
              onClick={() => setStage.mutate({ id, stageIndex: c.stageIndex - 1, note: stageNote || undefined })}
              className="chamfer-sm inline-flex items-center gap-1 border border-border px-3 py-1.5 text-[12px] disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Geri
            </button>
            <button
              type="button"
              disabled={c.stageIndex >= stages.length - 1 || setStage.isPending}
              onClick={() => setStage.mutate({ id, stageIndex: c.stageIndex + 1, note: stageNote || undefined })}
              className="chamfer-sm inline-flex flex-1 items-center justify-center gap-1 bg-foreground px-3 py-1.5 text-[12px] font-semibold text-primary disabled:opacity-40"
            >
              Sonraki aşama <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
          {c.stageIndex >= stages.length - 1 && c.approval === "approved" && c.status === "active" && (
            <button
              type="button"
              onClick={() => setStatus.mutate({ id, status: "completed" })}
              className="chamfer-sm mt-2 w-full bg-mint px-3 py-2 text-[12.5px] font-semibold text-white"
            >
              Son aşama onaylandı → Süreci tamamla
            </button>
          )}
        </div>

        {/* Onay + durum */}
        <div className="space-y-4">
          <div>
            <p className="label-caps mb-2">ONAY DURUMU · {stages[c.stageIndex]?.label}</p>
            <div className="flex flex-wrap gap-1.5">
              {APPROVAL_STATES.map((a) => (
                <button
                  key={a}
                  type="button"
                  disabled={setApproval.isPending}
                  onClick={() => setApproval.mutate({ id, approval: a, note: approvalNote || undefined })}
                  className={`chamfer-sm px-2.5 py-1 text-[11.5px] font-semibold ${c.approval === a ? APPROVAL_CLS[a] : "border border-border text-muted-foreground hover:text-foreground"}`}
                >
                  {APPROVAL_LABEL[a]}
                </button>
              ))}
            </div>
            <Input className="mt-2" value={approvalNote} onChange={(e) => setApprovalNote(e.target.value)} placeholder="Onay notu (ör. “Teklif 23.10'da onaylandı”)" />
            {c.approvalNote && <p className="mt-1 text-[12px] text-muted-foreground">Mevcut not: {c.approvalNote}</p>}
          </div>
          <div>
            <label htmlFor="case-status" className="label-caps mb-2 block">SÜREÇ DURUMU</label>
            <select
              id="case-status"
              value={c.status}
              onChange={(e) => setStatus.mutate({ id, status: e.target.value as CaseStatus })}
              className="chamfer-sm h-10 w-full border border-border bg-background px-3 text-[13px]"
            >
              {CASE_STATUSES.map((s) => (
                <option key={s} value={s}>{CASE_STATUS_LABEL[s]}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="case-start" className="label-caps mb-1 block">Başlangıç</label>
              <Input id="case-start" type="date" value={c.startDate ?? ""} onChange={(e) => update.mutate({ id, startDate: e.target.value || null })} />
            </div>
            <div>
              <label htmlFor="case-target" className="label-caps mb-1 block">Hedef</label>
              <Input id="case-target" type="date" value={c.targetDate ?? ""} onChange={(e) => update.mutate({ id, targetDate: e.target.value || null })} />
            </div>
          </div>
          <div>
            <label htmlFor="case-internal" className="label-caps mb-1 block">İç not (müşteri görmez)</label>
            <textarea
              id="case-internal"
              rows={3}
              value={internal ?? c.internalNote ?? ""}
              onChange={(e) => setInternal(e.target.value)}
              onBlur={() => internal !== null && update.mutate({ id, internalNote: internal })}
              className="chamfer-sm w-full border border-border bg-background px-3 py-2 text-[13px]"
            />
          </div>
        </div>
      </div>

      {/* Not ekle + olaylar */}
      <div className="border-t border-border p-5">
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            addNote.mutate({ id, title: noteTitle, body: noteBody || undefined, isPublic: notePublic });
          }}
        >
          <div className="min-w-48 flex-1">
            <label htmlFor="note-title" className="label-caps mb-1 block">Gelişme / not</label>
            <Input id="note-title" value={noteTitle} onChange={(e) => setNoteTitle(e.target.value)} placeholder="Ör. Klasör yapısı taslağı paylaşıldı" required minLength={2} />
          </div>
          <div className="min-w-48 flex-1">
            <Input value={noteBody} onChange={(e) => setNoteBody(e.target.value)} placeholder="Ayrıntı (opsiyonel)" />
          </div>
          <label className="flex h-10 items-center gap-1.5 text-[12.5px]">
            <input type="checkbox" checked={notePublic} onChange={(e) => setNotePublic(e.target.checked)} /> Müşteri görsün
          </label>
          <button type="submit" disabled={addNote.isPending} className="chamfer-sm inline-flex h-10 items-center gap-1 bg-primary px-3 text-[12.5px] font-semibold text-primary-foreground disabled:opacity-50">
            <Plus className="h-4 w-4" /> Ekle
          </button>
        </form>
        <ul className="mt-4 space-y-2">
          {events.map((e) => (
            <li key={e.id} className={`flex items-start gap-3 border-l-2 pl-3 ${e.isPublic ? "border-mint" : "border-border"}`}>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium">
                  {e.title}
                  {!e.isPublic && <span className="ml-2 text-[10.5px] uppercase text-muted-foreground">iç</span>}
                </p>
                {e.body && <p className="text-[12.5px] text-muted-foreground">{e.body}</p>}
                <p className="text-[11px] text-muted-foreground">{new Date(e.createdAt).toLocaleString("tr-TR")}</p>
              </div>
              <button type="button" onClick={() => removeEvent.mutate({ eventId: e.id })} className="text-muted-foreground hover:text-destructive" title="Sil">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={() => {
              if (confirm(`${c.refCode} süreci ve tüm geçmişi kalıcı olarak silinsin mi? Müşterinin kodu çalışmaz.`)) remove.mutate({ id });
            }}
            className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" /> Süreci sil
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------- Huni aşaması (contracts/funnel.ts) ----------------

const STAGE_CLS: Record<LeadStage, string> = {
  basvuru: "bg-mint-soft text-mint",
  yanit: "bg-[hsl(38_92%_55%/0.15)] text-[hsl(38_92%_30%)]",
  rontgen: "bg-[hsl(38_92%_55%/0.15)] text-[hsl(38_92%_30%)]",
  teklif: "bg-primary text-primary-foreground",
  imza: "bg-mint text-white",
  kayip: "bg-secondary text-muted-foreground",
};

export function LeadStageControl({
  l,
  onDone,
}: {
  l: { id: number; stage: string; stageAt: Date | string | null; createdAt: Date | string; followUps: number; lostReason: string | null; lostNote: string | null };
  /** Kurucu Paneli başvuru ayrıntısı gibi başka ekranların yenilenmesi */
  onDone?: () => void;
}) {
  const utils = trpc.useUtils();
  const done = () => {
    void utils.lead.list.invalidate();
    onDone?.();
  };
  const setStage = trpc.lead.setStage.useMutation({ onSuccess: done });
  const followUp = trpc.lead.followUpDone.useMutation({ onSuccess: done });
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState<LostReason>("fiyat");
  const [note, setNote] = useState("");
  const stage = (LEAD_STAGES as readonly string[]).includes(l.stage) ? (l.stage as LeadStage) : "basvuru";
  const due = dueFollowUp(l);

  return (
    <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
      <select
        value={asking ? "kayip" : stage}
        onChange={(e) => {
          const next = e.target.value as LeadStage;
          if (next === "kayip") return setAsking(true);
          setAsking(false);
          setStage.mutate({ id: l.id, stage: next });
        }}
        className={`chamfer-sm min-h-11 border-0 px-2.5 text-[12px] font-semibold ${STAGE_CLS[asking ? "kayip" : stage]}`}
        aria-label="Huni aşaması"
      >
        {LEAD_STAGES.map((s) => (
          <option key={s} value={s}>{LEAD_STAGE_LABEL[s]}</option>
        ))}
      </select>
      {stage === "kayip" && !asking && l.lostReason && (
        <span className="text-[11.5px] text-muted-foreground">
          Neden: {LOST_REASONS.find((r) => r.id === l.lostReason)?.label ?? l.lostReason}
          {l.lostNote ? ` — ${l.lostNote}` : ""}
        </span>
      )}
      {due && !asking && (
        <span className={`inline-flex items-center gap-2 text-[11.5px] font-semibold ${due.urgent ? "text-destructive" : "text-foreground"}`}>
          {due.label}
          {stage === "teklif" && l.followUps < FOLLOW_UP_DAYS.length && (
            <button
              type="button"
              onClick={() => followUp.mutate({ id: l.id })}
              disabled={followUp.isPending}
              className="chamfer-sm min-h-11 border border-border px-2.5 text-[11.5px] font-semibold hover:border-foreground"
            >
              Takip yapıldı
            </button>
          )}
        </span>
      )}
      {asking && (
        <form
          className="flex w-full flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setStage.mutate({ id: l.id, stage: "kayip", lostReason: reason, lostNote: note }, { onSuccess: () => setAsking(false) });
          }}
        >
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value as LostReason)}
            className="chamfer-sm min-h-11 border border-border bg-background px-2.5 text-[12px]"
            aria-label="Kayıp nedeni"
          >
            {LOST_REASONS.map((r) => (
              <option key={r.id} value={r.id}>{r.label}</option>
            ))}
          </select>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={255}
            placeholder="Tek satır not (isteğe bağlı)"
            className="chamfer-sm min-h-11 min-w-0 flex-1 border border-border bg-background px-2.5 text-[16px] md:text-[12.5px]"
          />
          <button type="submit" disabled={setStage.isPending} className="chamfer-sm min-h-11 bg-foreground px-3 text-[12px] font-semibold text-background">
            Kaydet
          </button>
          <button type="button" onClick={() => setAsking(false)} className="chamfer-sm min-h-11 px-3 text-[12px] text-muted-foreground">
            Vazgeç
          </button>
        </form>
      )}
    </div>
  );
}

// ---------------- Sayfa ----------------

export default function Leads() {
  const { user, isLoading } = useAuth();
  const isAdmin = user?.role === "admin";
  const leads = trpc.lead.list.useQuery(undefined, { enabled: isAdmin });
  const cases = trpc.consulting.admin.list.useQuery(undefined, { enabled: isAdmin });
  const [tab, setTab] = useState("surecler");
  const [seed, setSeed] = useState<NewCaseSeed | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const { copied, copy } = useCopy();

  // Kurucu Paneli → Başvuru ayrıntısı → "Danışmanlık dosyası aç": /talepler?basvuru=<id>
  const [params, setParams] = useSearchParams();
  const fromLead = Number(params.get("basvuru") ?? 0);
  useEffect(() => {
    if (!fromLead || !leads.data) return;
    const l = leads.data.find((x) => x.id === fromLead);
    if (l) startFromLead(l);
    setParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromLead, leads.data]);

  if (!isLoading && user && !isAdmin) return <Navigate to="/panel" replace />;

  const startFromLead = (l: { id: number; name: string; companyName: string | null; email: string | null; phone: string | null; interest: string | null }) => {
    setSeed({
      leadId: l.id,
      clientName: l.name,
      companyName: l.companyName ?? "",
      email: l.email ?? "",
      phone: l.phone ?? "",
      packageId: guessPackage(l.interest),
    });
    setOpenId(null);
    setTab("surecler");
  };

  return (
    <RequireCompany>
      <div className="mx-auto max-w-5xl">
        <p className="label-caps flex items-center gap-1.5">
          <Inbox className="h-3.5 w-3.5" /> DANIŞMANLIK YÖNETİMİ
        </p>
        <h1 className="mt-1 font-display text-2xl font-bold tracking-tight md:text-3xl">Talepler ve süreçler</h1>
        <p className="mt-1 text-[13.5px] text-muted-foreground">
          Başvurudan süreç açın; müşteri referans koduyla{" "}
          <Link to="/takip" className="font-semibold text-mint hover:underline">/takip</Link> sayfasından aşamayı ve onay durumunu görür.
          Bu sayfa yalnız HAIZ site yöneticisine açıktır.
        </p>

        <Tabs value={tab} onValueChange={setTab} className="mt-6">
          <TabsList>
            <TabsTrigger value="surecler">Süreçler ({cases.data?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="talepler">
              Talepler ({leads.data?.filter((l) => l.stage === "basvuru").length ?? 0} yeni)
            </TabsTrigger>
          </TabsList>

          <TabsContent value="surecler" className="mt-5 space-y-4">
            {seed ? (
              <NewCaseForm
                seed={seed}
                onCancel={() => setSeed(null)}
                onDone={(id) => {
                  setSeed(null);
                  setOpenId(id);
                }}
              />
            ) : (
              <button
                type="button"
                onClick={() => setSeed({ leadId: null, clientName: "", companyName: "", email: "", phone: "", packageId: "rontgen" })}
                className="chamfer-sm inline-flex items-center gap-1.5 bg-primary px-4 py-2 font-display text-[13px] font-semibold text-primary-foreground hover-cta"
              >
                <Plus className="h-4 w-4" /> Yeni süreç
              </button>
            )}

            {openId !== null && <CaseDetail id={openId} onClose={() => setOpenId(null)} />}

            <div className="chamfer border border-border bg-card">
              {cases.data?.length === 0 && (
                <p className="p-10 text-center text-[13.5px] text-muted-foreground">
                  Henüz süreç yok. “Talepler” sekmesinden bir başvuruyu sürece dönüştürün ya da yeni süreç açın.
                </p>
              )}
              {cases.data?.map((c) => (
                <div
                  key={c.id}
                  className={`flex flex-wrap items-center gap-3 border-b border-border px-5 py-3 last:border-0 ${openId === c.id ? "bg-mint-soft" : ""}`}
                >
                  <button type="button" onClick={() => setOpenId(c.id)} className="min-w-0 flex-1 text-left">
                    <p className="text-[14px] font-medium">
                      <span className="font-display tracking-[0.08em]">{c.refCode}</span> · {c.clientName}
                      {c.companyName && <span className="text-[12.5px] font-normal text-muted-foreground"> · {c.companyName}</span>}
                    </p>
                    <p className="text-[12px] text-muted-foreground">
                      {c.packageName} · {c.stageIndex + 1}/{c.stageCount} {c.stageLabel} · güncelleme{" "}
                      {new Date(c.updatedAt).toLocaleDateString("tr-TR")}
                    </p>
                  </button>
                  {c.approval !== "none" && (
                    <span className={`chamfer-sm px-2 py-0.5 text-[10.5px] font-semibold ${APPROVAL_CLS[c.approval]}`}>{APPROVAL_LABEL[c.approval]}</span>
                  )}
                  <span className="chamfer-sm bg-secondary px-2 py-0.5 text-[10.5px] font-semibold">{CASE_STATUS_LABEL[c.status]}</span>
                  <button
                    type="button"
                    onClick={() => copy(`${window.location.origin}/takip/${c.refCode}`)}
                    className="text-muted-foreground hover:text-foreground"
                    title="Takip linkini kopyala"
                  >
                    {copied?.endsWith(c.refCode) ? <span className="text-[11px] text-mint">✓</span> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="talepler" className="mt-5">
            <div className="chamfer border border-border bg-card">
              {leads.data?.length === 0 && (
                <p className="p-10 text-center text-[13.5px] text-muted-foreground">
                  Henüz talep yok. Danışmanlık sayfanız yayında — ilk başvuru burada görünecek.
                </p>
              )}
              {leads.error && <p className="p-5 text-[13px] text-destructive">{leads.error.message}</p>}
              {leads.data?.map((l) => {
                let quiz: { puan?: number; endeks?: number; oneri?: string } | null = null;
                try {
                  quiz = l.quizJson ? JSON.parse(l.quizJson) : null;
                } catch {
                  quiz = null;
                }
                return (
                  <div key={l.id} className="border-b border-border px-5 py-4 last:border-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-display text-[15px] font-semibold">
                          {l.name}
                          {l.companyName && <span className="ml-2 text-[12.5px] font-normal text-muted-foreground">{l.companyName}</span>}
                        </p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-[12px] text-muted-foreground">
                          {l.email && <a href={`mailto:${l.email}`} className="inline-flex items-center gap-1 hover:text-foreground"><Mail className="h-3 w-3" /> {l.email}</a>}
                          {l.phone && <a href={`tel:${l.phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-1 hover:text-foreground"><Phone className="h-3 w-3" /> {l.phone}</a>}
                          <span>{new Date(l.createdAt).toLocaleString("tr-TR")}</span>
                        </p>
                      </div>
                      {l.interest && <span className="chamfer-sm bg-secondary px-2.5 py-1 text-[11px] font-medium">{l.interest}</span>}
                      {quiz?.endeks !== undefined ? (
                        <span className="chamfer-sm bg-mint-soft px-2.5 py-1 text-[11px] font-semibold text-mint tnum" title={quiz.oneri ?? ""}>Endeks: {quiz.endeks}/100</span>
                      ) : quiz?.puan !== undefined ? (
                        <span className="chamfer-sm bg-mint-soft px-2.5 py-1 text-[11px] font-semibold text-mint tnum">Test: {quiz.puan}/12</span>
                      ) : null}
                      <LeadStageControl l={l} />
                      {l.caseRef ? (
                        <span className="chamfer-sm border border-mint px-2.5 py-1 text-[11px] font-semibold text-mint">{l.caseRef}</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => startFromLead(l)}
                          className="chamfer-sm bg-foreground px-2.5 py-1 text-[11px] font-semibold text-primary"
                        >
                          Süreç başlat
                        </button>
                      )}
                    </div>
                    {l.message && (
                      <p className="mt-2 border-t border-border pt-2 text-[13px] leading-relaxed text-muted-foreground">{l.message}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </RequireCompany>
  );
}

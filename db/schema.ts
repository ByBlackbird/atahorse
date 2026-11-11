import {
  mysqlTable,
  mysqlEnum,
  serial,
  bigint,
  varchar,
  text,
  mediumtext,
  longtext,
  double,
  timestamp,
  date,
  index,
  uniqueIndex,
  boolean,
  int,
} from "drizzle-orm/mysql-core";
import type { NotificationSeverity, Priority, Profession } from "../contracts/workflow";

export const users = mysqlTable("users", {
  id: serial("id").primaryKey(),
  unionId: varchar("unionId", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 320 }),
  passwordHash: varchar("passwordHash", { length: 255 }),
  avatar: text("avatar"),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  /** Rehber turu durumu (JSON): {"main":true,"project":true} */
  tourState: varchar("tourState", { length: 255 }),
  /** Hızlı katılan ustalar için 6 haneli giriş numarası (e-posta yok). Şifre yerine passwordHash'te 4 haneli PIN özeti durur. */
  loginNo: varchar("loginNo", { length: 8 }).unique(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
  lastSignInAt: timestamp("lastSignInAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ---------- IARCH domain ----------

export const companies = mysqlTable("companies", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  city: varchar("city", { length: 120 }),
  taxNo: varchar("taxNo", { length: 32 }),
  inviteCode: varchar("inviteCode", { length: 12 }).unique(),
  /** Logo sürümü (0 = logo yok). Görsel company_logos'ta, /api/logo/<id>?v=<sürüm> ile sunulur */
  logoVersion: int("logoVersion").notNull().default(0),
  /** Ekip PIN'i (tek PIN modunda): usta haiz.org'da yalnız bu 4 haneyi girer */
  crewPin: varchar("crewPin", { length: 8 }).unique(),
  /** company = tüm şirkete tek PIN · project = her şantiyeye ayrı PIN */
  pinMode: varchar("pinMode", { length: 12 }).notNull().default("company"),
  /** Şirketim paneli: iletişim bilgileri */
  phone: varchar("phone", { length: 64 }),
  email: varchar("email", { length: 320 }),
  address: varchar("address", { length: 500 }),
  createdById: bigint("createdById", { mode: "number", unsigned: true }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Company = typeof companies.$inferSelect;

/**
 * Şirket görev tanımları: "Elektrik tesisatı → Mehmet Usta" gibi.
 * İş atanırken tanım seçilince sorumlu, ekip ve aciliyet varsayılan olarak gelir; kullanıcı değiştirebilir.
 */
export const companyDuties = mysqlTable(
  "company_duties",
  {
    id: serial("id").primaryKey(),
    companyId: bigint("companyId", { mode: "number", unsigned: true }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    description: varchar("description", { length: 500 }),
    /** Mahal iş kalemi (WORK_CATEGORIES id) — plan görevlerinde kalem seçilince bu tanım kullanılır */
    category: varchar("category", { length: 64 }),
    /** Varsayılan sorumlu: üye ya da usta kaydı ya da serbest isim */
    defaultMemberId: bigint("defaultMemberId", { mode: "number", unsigned: true }),
    defaultWorkerId: bigint("defaultWorkerId", { mode: "number", unsigned: true }),
    defaultAssignee: varchar("defaultAssignee", { length: 255 }),
    defaultTeamId: bigint("defaultTeamId", { mode: "number", unsigned: true }),
    defaultPriority: varchar("defaultPriority", { length: 16 }).$type<Priority>().notNull().default("normal"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({ companyIdx: index("cd_company_idx").on(t.companyId) }),
);

export type CompanyDuty = typeof companyDuties.$inferSelect;

export const companyMembers = mysqlTable(
  "company_members",
  {
    id: serial("id").primaryKey(),
    companyId: bigint("companyId", { mode: "number", unsigned: true }).notNull(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    role: mysqlEnum("role", ["owner", "manager", "member"]).default("member").notNull(),
    displayName: varchar("displayName", { length: 255 }),
    /** Meslek unvanı (yetkiden bağımsız): mimar | muhendis | santiye_sefi | usta | ofis */
    profession: varchar("profession", { length: 32 }).$type<Profession | null>(),
    /** Uzmanlık / görev: "Seramik Ustası", "Elektrikçi" — katılırken sorulur */
    trade: varchar("trade", { length: 160 }),
    /** Ulaşım: ara / WhatsApp düğmeleri */
    phone: varchar("phone", { length: 32 }),
    /** Ana şantiyesi (şantiye PIN'iyle katıldıysa) — sesli rapor ve görevler önce bu şantiyeyi açar */
    projectId: bigint("projectId", { mode: "number", unsigned: true }),
    /** email | code (davet bağlantısıyla hızlı katılım) */
    joinedVia: varchar("joinedVia", { length: 16 }),
    /** Son görülme (oturumlu istek, 10 dk'da bir güncellenir) */
    lastSeenAt: timestamp("lastSeenAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index("cm_user_idx").on(t.userId),
    companyIdx: index("cm_company_idx").on(t.companyId),
  }),
);

export type CompanyMember = typeof companyMembers.$inferSelect;

export const projects = mysqlTable(
  "projects",
  {
    id: serial("id").primaryKey(),
    companyId: bigint("companyId", { mode: "number", unsigned: true }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    location: varchar("location", { length: 255 }),
    status: mysqlEnum("status", ["active", "paused", "done"]).default("active").notNull(),
    priority: varchar("priority", { length: 16 }).$type<Priority>().notNull().default("normal"),
    /** Proje teslim hedefi (YYYY-MM-DD) */
    targetDate: date("targetDate", { mode: "string" }),
    /** Şantiyeye özel PIN (şirket "her şantiyeye ayrı PIN" modundaysa geçerli) */
    crewPin: varchar("crewPin", { length: 8 }).unique(),
    /** Ofis proje numarası (HZD-P1-05: YY-NNN, ör. 26-014) — fotoğraf ve teslim dosya adlarında kullanılır */
    projectNo: varchar("projectNo", { length: 16 }),
    /** Restorasyon / tarihi yapı projesi: saha fotoğrafları 15_TARIHI_BELGE altına arşivlenir */
    restoration: boolean("restoration").notNull().default(false),
    /** Patron paneli: proje bütçesi (₺, KDV hariç) */
    budget: double("budget"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({ companyIdx: index("pr_company_idx").on(t.companyId) }),
);

export type Project = typeof projects.$inferSelect;

export const tasks = mysqlTable(
  "tasks",
  {
    id: serial("id").primaryKey(),
    projectId: bigint("projectId", { mode: "number", unsigned: true }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    assignee: varchar("assignee", { length: 255 }),
    status: mysqlEnum("status", ["todo", "doing", "done"]).default("todo").notNull(),
    dueDate: date("dueDate", { mode: "string" }),
    priority: varchar("priority", { length: 16 }).$type<Priority>().notNull().default("normal"),
    /** Sorumlu çalışma grubu (opsiyonel) */
    teamId: bigint("teamId", { mode: "number", unsigned: true }),
    /** Seçilen şirket görev tanımı (opsiyonel) */
    dutyId: bigint("dutyId", { mode: "number", unsigned: true }),
    /** Analitik: işe başlama ve bitirme anı (durum değişiminde otomatik) */
    startedAt: timestamp("startedAt"),
    completedAt: timestamp("completedAt"),
    createdById: bigint("createdById", { mode: "number", unsigned: true }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => ({ projectIdx: index("tk_project_idx").on(t.projectId) }),
);

export type Task = typeof tasks.$inferSelect;

export const materials = mysqlTable(
  "materials",
  {
    id: serial("id").primaryKey(),
    projectId: bigint("projectId", { mode: "number", unsigned: true }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    unit: varchar("unit", { length: 32 }).notNull().default("adet"),
    stockQty: double("stockQty").notNull().default(0),
    criticalQty: double("criticalQty").notNull().default(0),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({ projectIdx: index("mt_project_idx").on(t.projectId) }),
);

export type Material = typeof materials.$inferSelect;

export const materialMovements = mysqlTable(
  "material_movements",
  {
    id: serial("id").primaryKey(),
    materialId: bigint("materialId", { mode: "number", unsigned: true }).notNull(),
    type: mysqlEnum("type", ["in", "out"]).notNull(),
    qty: double("qty").notNull(),
    note: varchar("note", { length: 500 }),
    createdById: bigint("createdById", { mode: "number", unsigned: true }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({ materialIdx: index("mm_material_idx").on(t.materialId) }),
);

export type MaterialMovement = typeof materialMovements.$inferSelect;

export const reports = mysqlTable(
  "reports",
  {
    id: serial("id").primaryKey(),
    projectId: bigint("projectId", { mode: "number", unsigned: true }).notNull(),
    authorId: bigint("authorId", { mode: "number", unsigned: true }).notNull(),
    reportDate: date("reportDate", { mode: "string" }).notNull(),
    transcript: text("transcript").notNull(),
    aiJson: text("aiJson"),
    summary: text("summary"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({ projectIdx: index("rp_project_idx").on(t.projectId) }),
);

export type Report = typeof reports.$inferSelect;

export const subscriptions = mysqlTable("subscriptions", {
  id: serial("id").primaryKey(),
  companyId: bigint("companyId", { mode: "number", unsigned: true }).notNull().unique(),
  plan: mysqlEnum("plan", ["usta", "pro"]).notNull(),
  interval: mysqlEnum("interval", ["monthly", "yearly"]).notNull(),
  status: mysqlEnum("status", ["trial", "active", "canceled"]).default("trial").notNull(),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  /** Abonelik katmanı: free | premium (contracts/plans.ts) */
  tier: varchar("tier", { length: 16 }).notNull().default("free"),
  /** Premium deneme bitişi */
  trialEndsAt: timestamp("trialEndsAt"),
  /** Ücretli dönem bitişi (null = süresiz, ör. yönetici tanımlı) */
  currentPeriodEnd: timestamp("currentPeriodEnd"),
  /** manual | iyzico */
  provider: varchar("provider", { length: 32 }),
});

export type Subscription = typeof subscriptions.$inferSelect;

// ---------- Şantiye yönetimi: işçiler, atamalar, günlük raporlar ----------

export const workers = mysqlTable(
  "workers",
  {
    id: serial("id").primaryKey(),
    companyId: bigint("companyId", { mode: "number", unsigned: true }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    trade: varchar("trade", { length: 120 }), // ustalık alanı
    phone: varchar("phone", { length: 64 }),
    dailyWage: double("dailyWage"), // günlük ücret (₺)
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({ companyIdx: index("wk_company_idx").on(t.companyId) }),
);

export type Worker = typeof workers.$inferSelect;

export const workerAssignments = mysqlTable(
  "worker_assignments",
  {
    id: serial("id").primaryKey(),
    workerId: bigint("workerId", { mode: "number", unsigned: true }).notNull(),
    projectId: bigint("projectId", { mode: "number", unsigned: true }).notNull(),
    workDate: date("workDate", { mode: "string" }).notNull(),
    note: varchar("note", { length: 500 }),
    createdById: bigint("createdById", { mode: "number", unsigned: true }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({
    workerIdx: index("wa_worker_idx").on(t.workerId),
    projectDateIdx: index("wa_project_date_idx").on(t.projectId, t.workDate),
  }),
);

export type WorkerAssignment = typeof workerAssignments.$inferSelect;

export const dailyReports = mysqlTable(
  "daily_reports",
  {
    id: serial("id").primaryKey(),
    projectId: bigint("projectId", { mode: "number", unsigned: true }).notNull(),
    reportDate: date("reportDate", { mode: "string" }).notNull(),
    workerCount: int("workerCount").notNull().default(0),
    weather: varchar("weather", { length: 60 }),
    content: text("content").notNull(),
    aiSummary: text("aiSummary"),
    createdById: bigint("createdById", { mode: "number", unsigned: true }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({ projectIdx: index("dr_project_idx").on(t.projectId, t.reportDate) }),
);

export type DailyReport = typeof dailyReports.$inferSelect;

// ---------- Kat planı & mahal takibi ----------

export const floorPlans = mysqlTable(
  "floor_plans",
  {
    id: serial("id").primaryKey(),
    projectId: bigint("projectId", { mode: "number", unsigned: true }).notNull(),
    floorLabel: varchar("floorLabel", { length: 120 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    imageData: mediumtext("imageData").notNull(), // base64 data URL
    /** 3B maket ölçeği: planın yatay genişliği (metre). Boşsa 16 m varsayılır */
    widthM: double("widthM"),
    /** 3B maket kat yüksekliği (metre). Boşsa 2,8 m */
    wallHeightM: double("wallHeightM"),
    /** Plandan otomatik çıkarılan duvar halkaları (JSON, 0–1000 normalize) — 3B maketin gerçek duvarları */
    walls: mediumtext("walls"),
    /** PDF metin katmanından okunan mahal etiketleri, kat adı, ölçek (JSON) */
    textLayer: mediumtext("textLayer"),
    elements: mediumtext("elements"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({ projectIdx: index("fp_project_idx").on(t.projectId) }),
);

export type FloorPlan = typeof floorPlans.$inferSelect;

export const mahals = mysqlTable(
  "mahals",
  {
    id: serial("id").primaryKey(),
    planId: bigint("planId", { mode: "number", unsigned: true }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    code: varchar("code", { length: 64 }),
    /** JSON: [[x,y],...] — 0-1000 normalize koordinatlar */
    points: text("points").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({ planIdx: index("mh_plan_idx").on(t.planId) }),
);

export type Mahal = typeof mahals.$inferSelect;

export const planTasks = mysqlTable(
  "plan_tasks",
  {
    id: serial("id").primaryKey(),
    projectId: bigint("projectId", { mode: "number", unsigned: true }).notNull(),
    planId: bigint("planId", { mode: "number", unsigned: true }).notNull(),
    mahalId: bigint("mahalId", { mode: "number", unsigned: true }).notNull(),
    category: varchar("category", { length: 64 }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    assignee: varchar("assignee", { length: 255 }),
    status: mysqlEnum("status", ["todo", "doing", "done"]).default("todo").notNull(),
    note: varchar("note", { length: 500 }),
    dutyId: bigint("dutyId", { mode: "number", unsigned: true }),
    /** Mahal görevine termin ve aciliyet (föy ve analitik için) */
    dueDate: date("dueDate", { mode: "string" }),
    priority: varchar("priority", { length: 16 }).$type<Priority>().notNull().default("normal"),
    teamId: bigint("teamId", { mode: "number", unsigned: true }),
    startedAt: timestamp("startedAt"),
    completedAt: timestamp("completedAt"),
    createdById: bigint("createdById", { mode: "number", unsigned: true }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    mahalIdx: index("pt_mahal_idx").on(t.mahalId),
    projectIdx: index("pt_project_idx").on(t.projectId),
  }),
);

export type PlanTask = typeof planTasks.$inferSelect;

// ---------- Yönetmelik & AI kontrol ----------

export const regulations = mysqlTable(
  "regulations",
  {
    id: serial("id").primaryKey(),
    companyId: bigint("companyId", { mode: "number", unsigned: true }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    content: longtext("content").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({ companyIdx: index("rg_company_idx").on(t.companyId) }),
);

export type Regulation = typeof regulations.$inferSelect;

export const regulationChecks = mysqlTable(
  "regulation_checks",
  {
    id: serial("id").primaryKey(),
    projectId: bigint("projectId", { mode: "number", unsigned: true }).notNull(),
    regulationId: bigint("regulationId", { mode: "number", unsigned: true }),
    regulationTitle: varchar("regulationTitle", { length: 255 }),
    summary: text("summary"),
    resultJson: longtext("resultJson"),
    createdById: bigint("createdById", { mode: "number", unsigned: true }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({ projectIdx: index("rc_project_idx").on(t.projectId) }),
);

export type RegulationCheck = typeof regulationChecks.$inferSelect;

// ---------- Restorasyon revizyon raporları ----------

export const restoProjects = mysqlTable(
  "resto_projects",
  {
    id: serial("id").primaryKey(),
    companyId: bigint("companyId", { mode: "number", unsigned: true }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    location: varchar("location", { length: 255 }),
    /** Bağlı HAIZ şantiyesi: saha fotoğrafları ve mahaller rapora buradan gelir */
    linkedProjectId: bigint("linkedProjectId", { mode: "number", unsigned: true }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({ companyIdx: index("rp_company_idx").on(t.companyId) }),
);

export type RestoProject = typeof restoProjects.$inferSelect;

export const restoRevisions = mysqlTable(
  "resto_revisions",
  {
    id: serial("id").primaryKey(),
    restoProjectId: bigint("restoProjectId", { mode: "number", unsigned: true }).notNull(),
    code: varchar("code", { length: 16 }).notNull(),
    note: varchar("note", { length: 500 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({ projectIdx: index("rr_project_idx").on(t.restoProjectId) }),
);

export type RestoRevision = typeof restoRevisions.$inferSelect;

export const restoMahals = mysqlTable(
  "resto_mahals",
  {
    id: serial("id").primaryKey(),
    revisionId: bigint("revisionId", { mode: "number", unsigned: true }).notNull(),
    code: varchar("code", { length: 64 }).notNull(),
    fieldsJson: text("fieldsJson").notNull(),
  },
  (t) => ({ revisionIdx: index("rm_revision_idx").on(t.revisionId) }),
);

export type RestoMahal = typeof restoMahals.$inferSelect;

export const restoReports = mysqlTable(
  "resto_reports",
  {
    id: serial("id").primaryKey(),
    restoProjectId: bigint("restoProjectId", { mode: "number", unsigned: true }).notNull(),
    fromCode: varchar("fromCode", { length: 16 }).notNull(),
    toCode: varchar("toCode", { length: 16 }).notNull(),
    reportJson: longtext("reportJson").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({ projectIdx: index("rrp_project_idx").on(t.restoProjectId) }),
);

export type RestoReport = typeof restoReports.$inferSelect;

// ---------- Danışmanlık talepleri ----------

export const leads = mysqlTable(
  "leads",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    companyName: varchar("companyName", { length: 255 }),
    email: varchar("email", { length: 320 }),
    phone: varchar("phone", { length: 64 }),
    interest: varchar("interest", { length: 120 }),
    quizJson: text("quizJson"),
    message: text("message"),
    status: mysqlEnum("status", ["new", "contacted", "done"]).default("new").notNull(),
    /** Satış hunisi aşaması (contracts/funnel.ts) */
    stage: varchar("stage", { length: 16 }).notNull().default("basvuru"),
    stageAt: timestamp("stageAt"),
    /** Teklif sonrası yapılan takip sayısı (3./7./14. gün) */
    followUps: int("followUps").notNull().default(0),
    lostReason: varchar("lostReason", { length: 16 }),
    lostNote: varchar("lostNote", { length: 255 }),
    /** Başvurunun geldiği site oturumu (site_events.sid) — kampanya / kaynak eşlemesi için */
    sid: varchar("sid", { length: 24 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({ createdIdx: index("ld_created_idx").on(t.createdAt) }),
);

export type Lead = typeof leads.$inferSelect;

// ---------- Çalışma grupları / ekipler ----------

export const teams = mysqlTable(
  "teams",
  {
    id: serial("id").primaryKey(),
    companyId: bigint("companyId", { mode: "number", unsigned: true }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    description: varchar("description", { length: 500 }),
    /** Ekip başı (şantiye şefi) — company_members.id */
    leadMemberId: bigint("leadMemberId", { mode: "number", unsigned: true }),
    /** Ekibin bağlı olduğu şantiye (opsiyonel) */
    projectId: bigint("projectId", { mode: "number", unsigned: true }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({ companyIdx: index("tm_company_idx").on(t.companyId) }),
);

export type Team = typeof teams.$inferSelect;

export const teamMembers = mysqlTable(
  "team_members",
  {
    id: serial("id").primaryKey(),
    teamId: bigint("teamId", { mode: "number", unsigned: true }).notNull(),
    memberId: bigint("memberId", { mode: "number", unsigned: true }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({
    teamMemberUq: uniqueIndex("tmm_team_member_uq").on(t.teamId, t.memberId),
    memberIdx: index("tmm_member_idx").on(t.memberId),
  }),
);

export type TeamMember = typeof teamMembers.$inferSelect;

// ---------- Bildirimler (stok alarmı, geciken iş) ----------

export const notifications = mysqlTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    companyId: bigint("companyId", { mode: "number", unsigned: true }).notNull(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    kind: varchar("kind", { length: 32 }).notNull(), // stock | task_late
    severity: varchar("severity", { length: 16 }).$type<NotificationSeverity>().notNull().default("info"),
    title: varchar("title", { length: 255 }).notNull(),
    body: text("body"),
    link: varchar("link", { length: 255 }),
    /** Aynı olay için tekrar bildirim üretmemek: stock:<id>:<seviye>, task_late:<id> */
    dedupeKey: varchar("dedupeKey", { length: 128 }).notNull(),
    readAt: timestamp("readAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({
    userDedupeUq: uniqueIndex("nt_user_dedupe_uq").on(t.userId, t.dedupeKey),
    userReadIdx: index("nt_user_read_idx").on(t.userId, t.readAt),
  }),
);

export type Notification = typeof notifications.$inferSelect;

// ---------- AI asistan analiz önbelleği ----------

export const aiInsights = mysqlTable(
  "ai_insights",
  {
    id: serial("id").primaryKey(),
    companyId: bigint("companyId", { mode: "number", unsigned: true }).notNull(),
    /** Girdi verisinin SHA-256 özeti — aynı veri için AI tekrar çağrılmaz */
    inputHash: varchar("inputHash", { length: 64 }).notNull(),
    resultJson: longtext("resultJson").notNull(),
    aiUsed: boolean("aiUsed").notNull().default(true),
    createdById: bigint("createdById", { mode: "number", unsigned: true }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({ companyIdx: index("ai_company_idx").on(t.companyId, t.createdAt) }),
);

export type AiInsight = typeof aiInsights.$inferSelect;

// ---------- Danışmanlık süreç takibi (referans kodu ile) ----------

export const consultingCases = mysqlTable(
  "consulting_cases",
  {
    id: serial("id").primaryKey(),
    /** Müşteriye verilen takip kodu: HZ-XXXX-XXXX */
    refCode: varchar("refCode", { length: 16 }).notNull(),
    leadId: bigint("leadId", { mode: "number", unsigned: true }),
    clientName: varchar("clientName", { length: 255 }).notNull(),
    companyName: varchar("companyName", { length: 255 }),
    email: varchar("email", { length: 320 }),
    phone: varchar("phone", { length: 64 }),
    /** contracts/consulting.ts → CONSULTING_PACKAGES[].id */
    packageId: varchar("packageId", { length: 48 }).notNull(),
    stageIndex: int("stageIndex").notNull().default(0),
    /** Mevcut aşamanın onay durumu: none | pending | approved | revision | rejected */
    approval: varchar("approval", { length: 16 }).notNull().default("none"),
    approvalNote: varchar("approvalNote", { length: 500 }),
    status: varchar("status", { length: 16 }).notNull().default("active"),
    startDate: date("startDate", { mode: "string" }),
    targetDate: date("targetDate", { mode: "string" }),
    /** Yalnız yönetici görür */
    internalNote: text("internalNote"),
    createdById: bigint("createdById", { mode: "number", unsigned: true }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    refUq: uniqueIndex("cc_ref_uq").on(t.refCode),
    leadIdx: index("cc_lead_idx").on(t.leadId),
  }),
);

export type ConsultingCase = typeof consultingCases.$inferSelect;

export const consultingEvents = mysqlTable(
  "consulting_events",
  {
    id: serial("id").primaryKey(),
    caseId: bigint("caseId", { mode: "number", unsigned: true }).notNull(),
    /** created | stage | approval | status | note */
    kind: varchar("kind", { length: 16 }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    body: text("body"),
    /** Müşterinin takip ekranında görünür mü */
    isPublic: boolean("isPublic").notNull().default(true),
    createdById: bigint("createdById", { mode: "number", unsigned: true }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({ caseIdx: index("ce_case_idx").on(t.caseId, t.createdAt) }),
);

export type ConsultingEvent = typeof consultingEvents.$inferSelect;

// ---------- Uygulama meta (tek seferlik veri düzeltmeleri) ----------

export const appMeta = mysqlTable("app_meta", {
  metaKey: varchar("metaKey", { length: 64 }).primaryKey(),
  metaValue: varchar("metaValue", { length: 255 }).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

// ---------- Görev olay kaydı (analitik için kalıcı geçmiş) ----------

export const taskEvents = mysqlTable(
  "task_events",
  {
    id: serial("id").primaryKey(),
    companyId: bigint("companyId", { mode: "number", unsigned: true }).notNull(),
    projectId: bigint("projectId", { mode: "number", unsigned: true }).notNull(),
    /** task (iş takibi) | plan (mahal görevi) */
    taskKind: varchar("taskKind", { length: 8 }).notNull(),
    taskId: bigint("taskId", { mode: "number", unsigned: true }).notNull(),
    /** created | status | assign | due | priority | deleted */
    kind: varchar("kind", { length: 16 }).notNull(),
    fromValue: varchar("fromValue", { length: 255 }),
    toValue: varchar("toValue", { length: 255 }),
    /** Olay anındaki sorumlu ve ekip — kişi/ekip verimliliği buradan hesaplanır */
    assignee: varchar("assignee", { length: 255 }),
    teamId: bigint("teamId", { mode: "number", unsigned: true }),
    dueDate: date("dueDate", { mode: "string" }),
    actorUserId: bigint("actorUserId", { mode: "number", unsigned: true }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({
    companyIdx: index("te_company_idx").on(t.companyId, t.createdAt),
    taskIdx: index("te_task_idx").on(t.taskKind, t.taskId),
  }),
);

export type TaskEvent = typeof taskEvents.$inferSelect;

// ---------- Abonelik yükseltme talepleri (havale/EFT, ileride iyzico) ----------

export const billingRequests = mysqlTable(
  "billing_requests",
  {
    id: serial("id").primaryKey(),
    companyId: bigint("companyId", { mode: "number", unsigned: true }).notNull(),
    requestedById: bigint("requestedById", { mode: "number", unsigned: true }).notNull(),
    tier: varchar("tier", { length: 16 }).notNull().default("premium"),
    /** monthly | yearly */
    billingInterval: varchar("billingInterval", { length: 16 }).notNull(),
    /** havale | iyzico */
    method: varchar("method", { length: 16 }).notNull(),
    amount: int("amount").notNull(),
    /** pending | approved | rejected | cancelled */
    status: varchar("status", { length: 16 }).notNull().default("pending"),
    reference: varchar("reference", { length: 32 }).notNull(),
    note: varchar("note", { length: 500 }),
    decidedById: bigint("decidedById", { mode: "number", unsigned: true }),
    decidedAt: timestamp("decidedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({ companyIdx: index("br_company_idx").on(t.companyId), statusIdx: index("br_status_idx").on(t.status) }),
);

export type BillingRequest = typeof billingRequests.$inferSelect;

// ---------- Sesli asistan komut kaydı (denetim + iyileştirme) ----------

export const assistantLogs = mysqlTable(
  "assistant_logs",
  {
    id: serial("id").primaryKey(),
    companyId: bigint("companyId", { mode: "number", unsigned: true }).notNull(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    transcript: varchar("transcript", { length: 1000 }).notNull(),
    intentJson: text("intentJson"),
    /** parsed | executed | failed | cancelled */
    status: varchar("status", { length: 16 }).notNull(),
    error: varchar("error", { length: 500 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({ companyIdx: index("al_company_idx").on(t.companyId, t.createdAt) }),
);

// ---------- Cihaz oturumları (usta telefonu tekrar giriş istemez) ----------

/**
 * Her telefon/tarayıcı bir cihaz kaydıdır. Oturum çerezi bu cihaza bağlıdır (JWT içinde did);
 * yönetici cihazı kapatınca o telefondaki oturum anında düşer.
 * Ham anahtar yalnız cihazda (localStorage) durur; burada SHA-256 özeti saklanır.
 * IP ve tarayıcı bilgisi yalnız güvenlik denetimi içindir (KVKK: meşru menfaat, 12 ay).
 */
export const userDevices = mysqlTable(
  "user_devices",
  {
    id: serial("id").primaryKey(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    tokenHash: varchar("tokenHash", { length: 64 }).notNull().unique(),
    /** Telefonun kalıcı kimliği (çıkışta silinmez) — aynı telefon PIN girince aynı hesap açılır */
    deviceKeyHash: varchar("deviceKeyHash", { length: 64 }),
    label: varchar("label", { length: 120 }),
    ip: varchar("ip", { length: 64 }),
    userAgent: varchar("userAgent", { length: 255 }),
    lastIp: varchar("lastIp", { length: 64 }),
    lastSeenAt: timestamp("lastSeenAt").defaultNow().notNull(),
    revokedAt: timestamp("revokedAt"),
    /** logout (usta kendisi çıktı — PIN ile geri açılır) | manager | reset (geri açılmaz) */
    revokeReason: varchar("revokeReason", { length: 16 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({ userIdx: index("ud_user_idx").on(t.userId), keyIdx: index("ud_key_idx").on(t.deviceKeyHash) }),
);

export type UserDevice = typeof userDevices.$inferSelect;

/** Tek kullanımlık giriş bağlantısı: yönetici ustaya WhatsApp'tan yollar (telefon değişince) */
export const loginTokens = mysqlTable(
  "login_tokens",
  {
    id: serial("id").primaryKey(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    companyId: bigint("companyId", { mode: "number", unsigned: true }).notNull(),
    tokenHash: varchar("tokenHash", { length: 64 }).notNull().unique(),
    createdById: bigint("createdById", { mode: "number", unsigned: true }).notNull(),
    expiresAt: timestamp("expiresAt").notNull(),
    usedAt: timestamp("usedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({ userIdx: index("lt_user_idx").on(t.userId) }),
);

/** Şirket logosu — ayrı tablo: şirket satırı her istekte taşınırken görsel taşınmasın */
export const companyLogos = mysqlTable("company_logos", {
  companyId: bigint("companyId", { mode: "number", unsigned: true }).primaryKey(),
  /** Ekran için şeffaf PNG (base64, en çok 512 px) */
  png: mediumtext("png").notNull(),
  /** PDF için beyaz zeminli JPEG (base64) */
  jpeg: mediumtext("jpeg"),
  width: int("width").notNull().default(0),
  height: int("height").notNull().default(0),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

/** Şifre sıfırlama bağlantısı (1 saat, tek kullanım) */
export const passwordResets = mysqlTable(
  "password_resets",
  {
    id: serial("id").primaryKey(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    tokenHash: varchar("tokenHash", { length: 64 }).notNull().unique(),
    expiresAt: timestamp("expiresAt").notNull(),
    usedAt: timestamp("usedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({ userIdx: index("pr_user_idx").on(t.userId) }),
);

// ---------- Saha fotoğraf arşivi (HZD-P1-05 klasör ve adlandırma standardı) ----------

export const sitePhotos = mysqlTable(
  "site_photos",
  {
    id: serial("id").primaryKey(),
    companyId: bigint("companyId", { mode: "number", unsigned: true }).notNull(),
    projectId: bigint("projectId", { mode: "number", unsigned: true }).notNull(),
    /** Çekim anı: EXIF varsa ondan, yoksa gönderim anı */
    takenAt: timestamp("takenAt").notNull(),
    takenAtSource: varchar("takenAtSource", { length: 8 }).notNull().default("upload"), // exif | upload
    lat: double("lat"),
    lng: double("lng"),
    device: varchar("device", { length: 80 }),
    /** Etiket (contracts/photoArchive PHOTO_STAGES) */
    stage: varchar("stage", { length: 16 }).notNull().default("genel"),
    stageSource: varchar("stageSource", { length: 8 }).notNull().default("user"), // user | caption | ai
    mahalId: bigint("mahalId", { mode: "number", unsigned: true }),
    /** Standart yol ve ad: 70_SANTIYE/FOTO/2026-10-25 · 20261025_26-014_00-Salon_001.jpg */
    folder: varchar("folder", { length: 120 }).notNull(),
    fileName: varchar("fileName", { length: 160 }).notNull(),
    seq: int("seq").notNull().default(1),
    note: varchar("note", { length: 500 }),
    /** Kanal: web | usta | whatsapp */
    source: varchar("source", { length: 12 }).notNull().default("web"),
    uploadedById: bigint("uploadedById", { mode: "number", unsigned: true }),
    uploaderLabel: varchar("uploaderLabel", { length: 120 }),
    width: int("width").notNull().default(0),
    height: int("height").notNull().default(0),
    /** JPEG base64 data URL (en çok 1600 px) ve küçük önizleme (360 px) */
    imageData: mediumtext("imageData").notNull(),
    thumbData: mediumtext("thumbData"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({
    projectIdx: index("sp_project_idx").on(t.projectId, t.takenAt),
    companyIdx: index("sp_company_idx").on(t.companyId),
  }),
);

export type SitePhoto = typeof sitePhotos.$inferSelect;

/** WhatsApp numarası ↔ şantiye eşlemesi ("BAGLAN <PIN>" mesajıyla) */
export const whatsappLinks = mysqlTable(
  "whatsapp_links",
  {
    id: serial("id").primaryKey(),
    /** Gönderenin WhatsApp numarası (uluslararası, + olmadan: 905321234567) */
    phone: varchar("phone", { length: 32 }).notNull().unique(),
    companyId: bigint("companyId", { mode: "number", unsigned: true }).notNull(),
    projectId: bigint("projectId", { mode: "number", unsigned: true }),
    label: varchar("label", { length: 120 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({ companyIdx: index("wl_company_idx").on(t.companyId) }),
);

// ---------- Patron paneli: nakit akışı ve karar günlüğü ----------

export const financeEntries = mysqlTable(
  "finance_entries",
  {
    id: serial("id").primaryKey(),
    companyId: bigint("companyId", { mode: "number", unsigned: true }).notNull(),
    projectId: bigint("projectId", { mode: "number", unsigned: true }),
    /** in: tahsilat (hakediş, avans, danışmanlık) · out: ödeme (malzeme, işçilik, taşeron, gider) */
    direction: varchar("direction", { length: 4 }).notNull(),
    category: varchar("category", { length: 24 }).notNull(),
    amount: double("amount").notNull(),
    /** Vade / gerçekleşme tarihi (YYYY-MM-DD) */
    entryDate: date("entryDate", { mode: "string" }).notNull(),
    /** planned: plan · pending: onay bekliyor · approved: onaylandı · done: ödendi/tahsil edildi · rejected */
    status: varchar("status", { length: 10 }).notNull().default("pending"),
    counterparty: varchar("counterparty", { length: 160 }),
    note: varchar("note", { length: 500 }),
    decidedById: bigint("decidedById", { mode: "number", unsigned: true }),
    decidedAt: timestamp("decidedAt"),
    createdById: bigint("createdById", { mode: "number", unsigned: true }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({ companyIdx: index("fe_company_idx").on(t.companyId, t.entryDate) }),
);

export type FinanceEntry = typeof financeEntries.$inferSelect;

/** Soru günlüğü ve karar kaydı: toplantı yerine platformda soru → karar (Ofis İşleyiş metodolojisi) */
export const decisions = mysqlTable(
  "decisions",
  {
    id: serial("id").primaryKey(),
    companyId: bigint("companyId", { mode: "number", unsigned: true }).notNull(),
    projectId: bigint("projectId", { mode: "number", unsigned: true }),
    /** soru | onay | risk */
    kind: varchar("kind", { length: 8 }).notNull().default("soru"),
    topic: varchar("topic", { length: 24 }).notNull().default("genel"),
    question: varchar("question", { length: 1000 }).notNull(),
    askedByLabel: varchar("askedByLabel", { length: 120 }),
    status: varchar("status", { length: 10 }).notNull().default("open"), // open | decided | dropped
    decision: varchar("decision", { length: 1000 }),
    decidedById: bigint("decidedById", { mode: "number", unsigned: true }),
    decidedAt: timestamp("decidedAt"),
    createdById: bigint("createdById", { mode: "number", unsigned: true }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({ companyIdx: index("dc_company_idx").on(t.companyId, t.status) }),
);

export type Decision = typeof decisions.$inferSelect;

// ---------- Restorasyon rapor editörü ----------

export const restoDocuments = mysqlTable(
  "resto_documents",
  {
    id: serial("id").primaryKey(),
    companyId: bigint("companyId", { mode: "number", unsigned: true }).notNull(),
    restoProjectId: bigint("restoProjectId", { mode: "number", unsigned: true }).notNull(),
    /** roleve | restitusyon | restorasyon | sanat_tarihi | kurul | serbest */
    kind: varchar("kind", { length: 16 }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    /** Markdown (LaTeX matematiğe gerek yok; başlık, liste, tablo, görsel, kaynakça) */
    content: longtext("content").notNull(),
    version: int("version").notNull().default(1),
    updatedById: bigint("updatedById", { mode: "number", unsigned: true }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  (t) => ({ projectIdx: index("rd_project_idx").on(t.restoProjectId) }),
);

export type RestoDocument = typeof restoDocuments.$inferSelect;

/** Kayıt geçmişi: her kayıtta önceki hâl saklanır (belge başına son 40) */
export const restoDocVersions = mysqlTable(
  "resto_doc_versions",
  {
    id: serial("id").primaryKey(),
    documentId: bigint("documentId", { mode: "number", unsigned: true }).notNull(),
    version: int("version").notNull(),
    content: longtext("content").notNull(),
    savedById: bigint("savedById", { mode: "number", unsigned: true }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({ docIdx: index("rdv_doc_idx").on(t.documentId, t.version) }),
);

// ---------- Kurucu paneli: geri bildirim, hata kaydı, danışmanlık süresi, kullanım sayacı ----------

/** Uygulama içinden gelen soru / hata / öneri ("Yardım ve geri bildirim") */
export const feedback = mysqlTable(
  "feedback",
  {
    id: serial("id").primaryKey(),
    companyId: bigint("companyId", { mode: "number", unsigned: true }),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    /** soru | hata | oneri */
    kind: varchar("kind", { length: 12 }).notNull(),
    /** Gönderildiği ekran: /santiye/12 */
    page: varchar("page", { length: 160 }),
    message: text("message").notNull(),
    /** open | answered | closed */
    status: varchar("status", { length: 12 }).notNull().default("open"),
    reply: text("reply"),
    answeredAt: timestamp("answeredAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({ statusIdx: index("fb_status_idx").on(t.status, t.createdAt) }),
);

/** Sunucu hata kaydı (son 2000 kayıt tutulur) */
export const appErrors = mysqlTable(
  "app_errors",
  {
    id: serial("id").primaryKey(),
    /** trpc | ai | http */
    source: varchar("source", { length: 12 }).notNull(),
    path: varchar("path", { length: 160 }),
    code: varchar("code", { length: 40 }),
    message: varchar("message", { length: 1000 }).notNull(),
    userId: bigint("userId", { mode: "number", unsigned: true }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({ createdIdx: index("ae_created_idx").on(t.createdAt) }),
);

/** Danışmanlık dosyasına harcanan süre */
export const consultingTime = mysqlTable(
  "consulting_time",
  {
    id: serial("id").primaryKey(),
    caseId: bigint("caseId", { mode: "number", unsigned: true }).notNull(),
    workDate: date("workDate", { mode: "string" }).notNull(),
    minutes: int("minutes").notNull(),
    note: varchar("note", { length: 255 }),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({ caseIdx: index("ct_case_idx").on(t.caseId), dateIdx: index("ct_date_idx").on(t.workDate) }),
);

/** Aylık kullanım sayacı: kind = ai | uyarı işaretleri (w:storage:80 …) */
export const usageCounters = mysqlTable(
  "usage_counters",
  {
    companyId: bigint("companyId", { mode: "number", unsigned: true }).notNull(),
    period: varchar("period", { length: 7 }).notNull(),
    kind: varchar("kind", { length: 24 }).notNull(),
    n: int("n").notNull().default(0),
  },
  (t) => ({ pk: uniqueIndex("uc_pk").on(t.companyId, t.period, t.kind) }),
);

/**
 * Site ziyaret kaydı (birinci taraf, çerezsiz). Yalnız halka açık sayfalar.
 * IP saklanmaz: vid = günlük değişen tuzla özetlenmiş (IP + tarayıcı) — ertesi gün aynı kişi farklı görünür.
 * type: view (sayfa görüntüleme) | lead (danışmanlık başvurusu)
 */
export const siteEvents = mysqlTable(
  "site_events",
  {
    id: serial("id").primaryKey(),
    type: varchar("type", { length: 12 }).notNull(),
    sid: varchar("sid", { length: 24 }).notNull(),
    vid: varchar("vid", { length: 16 }).notNull(),
    path: varchar("path", { length: 200 }).notNull(),
    refHost: varchar("refHost", { length: 120 }),
    channel: varchar("channel", { length: 12 }).notNull(),
    utmSource: varchar("utmSource", { length: 80 }),
    utmMedium: varchar("utmMedium", { length: 80 }),
    utmCampaign: varchar("utmCampaign", { length: 120 }),
    device: varchar("device", { length: 8 }).notNull(),
    tz: varchar("tz", { length: 48 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({ createdIdx: index("se_created_idx").on(t.createdAt), sidIdx: index("se_sid_idx").on(t.sid) }),
);

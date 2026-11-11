import { eq, isNull, sql } from "drizzle-orm";
import { generateCrewPin } from "./codes";
import { getDb } from "../queries/connection";
import {
  appMeta,
  companies,
  companyDuties,
  companyMembers,
  consultingCases,
  floorPlans,
  leads,
  mahals,
  materials,
  planTasks,
  projects,
  subscriptions,
  tasks,
  teams,
  users,
  workers,
} from "@db/schema";
import { formatPersonName, formatPhoneTR, formatTitle, normalizeEmail, titleOrNull } from "../../contracts/normalize";

/**
 * Şema genişlemeleri için hafif otomatik migrasyon.
 * Sunucu açılırken bir kez çalışır; tablolar zaten varsa hiçbir şey yapmaz.
 * (CREATE TABLE IF NOT EXISTS — idempotent)
 */
export const STATEMENTS: string[] = [
  // --- Temel tablolar (Render'daki gömülü veritabanında sıfırdan kurulur) ---
  `CREATE TABLE IF NOT EXISTS users (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    unionId VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    email VARCHAR(320),
    passwordHash VARCHAR(255),
    avatar TEXT,
    role ENUM('user','admin') NOT NULL DEFAULT 'user',
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    lastSignInAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS companies (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    city VARCHAR(120),
    taxNo VARCHAR(32),
    createdById BIGINT UNSIGNED NOT NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    inviteCode VARCHAR(12),
    UNIQUE KEY inviteCode_unique (inviteCode)
  )`,
  `CREATE TABLE IF NOT EXISTS company_members (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    companyId BIGINT UNSIGNED NOT NULL,
    userId BIGINT UNSIGNED NOT NULL,
    role ENUM('owner','manager','member') NOT NULL DEFAULT 'member',
    displayName VARCHAR(255),
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX cm_user_idx (userId),
    INDEX cm_company_idx (companyId)
  )`,
  `CREATE TABLE IF NOT EXISTS projects (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    companyId BIGINT UNSIGNED NOT NULL,
    name VARCHAR(255) NOT NULL,
    location VARCHAR(255),
    status ENUM('active','paused','done') NOT NULL DEFAULT 'active',
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX pr_company_idx (companyId)
  )`,
  `CREATE TABLE IF NOT EXISTS tasks (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    projectId BIGINT UNSIGNED NOT NULL,
    title VARCHAR(255) NOT NULL,
    assignee VARCHAR(255),
    status ENUM('todo','doing','done') NOT NULL DEFAULT 'todo',
    dueDate DATE,
    createdById BIGINT UNSIGNED NOT NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX tk_project_idx (projectId)
  )`,
  `CREATE TABLE IF NOT EXISTS materials (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    projectId BIGINT UNSIGNED NOT NULL,
    name VARCHAR(255) NOT NULL,
    unit VARCHAR(32) NOT NULL DEFAULT 'adet',
    stockQty DOUBLE NOT NULL DEFAULT 0,
    criticalQty DOUBLE NOT NULL DEFAULT 0,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX mt_project_idx (projectId)
  )`,
  `CREATE TABLE IF NOT EXISTS material_movements (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    materialId BIGINT UNSIGNED NOT NULL,
    type ENUM('in','out') NOT NULL,
    qty DOUBLE NOT NULL,
    note VARCHAR(500),
    createdById BIGINT UNSIGNED NOT NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX mm_material_idx (materialId)
  )`,
  `CREATE TABLE IF NOT EXISTS reports (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    projectId BIGINT UNSIGNED NOT NULL,
    authorId BIGINT UNSIGNED NOT NULL,
    reportDate DATE NOT NULL,
    transcript TEXT NOT NULL,
    aiJson TEXT,
    summary TEXT,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX rp_project_idx (projectId)
  )`,
  `CREATE TABLE IF NOT EXISTS subscriptions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    companyId BIGINT UNSIGNED NOT NULL,
    plan ENUM('usta','pro') NOT NULL,
    \`interval\` ENUM('monthly','yearly') NOT NULL,
    status ENUM('trial','active','canceled') NOT NULL DEFAULT 'trial',
    startedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  // --- Özellik tabloları ---
  `CREATE TABLE IF NOT EXISTS floor_plans (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    projectId BIGINT UNSIGNED NOT NULL,
    floorLabel VARCHAR(120) NOT NULL,
    name VARCHAR(255) NOT NULL,
    imageData MEDIUMTEXT NOT NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX fp_project_idx (projectId)
  )`,
  `CREATE TABLE IF NOT EXISTS mahals (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    planId BIGINT UNSIGNED NOT NULL,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(64),
    points TEXT NOT NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX mh_plan_idx (planId)
  )`,
  `CREATE TABLE IF NOT EXISTS plan_tasks (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    projectId BIGINT UNSIGNED NOT NULL,
    planId BIGINT UNSIGNED NOT NULL,
    mahalId BIGINT UNSIGNED NOT NULL,
    category VARCHAR(64) NOT NULL,
    title VARCHAR(255) NOT NULL,
    assignee VARCHAR(255),
    status ENUM('todo','doing','done') NOT NULL DEFAULT 'todo',
    note VARCHAR(500),
    createdById BIGINT UNSIGNED NOT NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX pt_mahal_idx (mahalId),
    INDEX pt_project_idx (projectId)
  )`,
  `CREATE TABLE IF NOT EXISTS regulations (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    companyId BIGINT UNSIGNED NOT NULL,
    title VARCHAR(255) NOT NULL,
    content LONGTEXT NOT NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX rg_company_idx (companyId)
  )`,
  `CREATE TABLE IF NOT EXISTS regulation_checks (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    projectId BIGINT UNSIGNED NOT NULL,
    regulationId BIGINT UNSIGNED,
    regulationTitle VARCHAR(255),
    summary TEXT,
    resultJson LONGTEXT,
    createdById BIGINT UNSIGNED NOT NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX rc_project_idx (projectId)
  )`,
  `CREATE TABLE IF NOT EXISTS resto_projects (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    companyId BIGINT UNSIGNED NOT NULL,
    name VARCHAR(255) NOT NULL,
    location VARCHAR(255),
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX rp_company_idx (companyId)
  )`,
  `CREATE TABLE IF NOT EXISTS resto_revisions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    restoProjectId BIGINT UNSIGNED NOT NULL,
    code VARCHAR(16) NOT NULL,
    note VARCHAR(500),
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX rr_project_idx (restoProjectId)
  )`,
  `CREATE TABLE IF NOT EXISTS resto_mahals (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    revisionId BIGINT UNSIGNED NOT NULL,
    code VARCHAR(64) NOT NULL,
    fieldsJson TEXT NOT NULL,
    INDEX rm_revision_idx (revisionId)
  )`,
  `CREATE TABLE IF NOT EXISTS resto_reports (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    restoProjectId BIGINT UNSIGNED NOT NULL,
    fromCode VARCHAR(16) NOT NULL,
    toCode VARCHAR(16) NOT NULL,
    reportJson LONGTEXT NOT NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX rrp_project_idx (restoProjectId)
  )`,
  `CREATE TABLE IF NOT EXISTS leads (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    companyName VARCHAR(255),
    email VARCHAR(320),
    phone VARCHAR(64),
    interest VARCHAR(120),
    quizJson TEXT,
    message TEXT,
    status ENUM('new','contacted','done') NOT NULL DEFAULT 'new',
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX ld_created_idx (createdAt)
  )`,
  // --- Şantiye yönetimi ---
  `CREATE TABLE IF NOT EXISTS workers (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    companyId BIGINT UNSIGNED NOT NULL,
    name VARCHAR(255) NOT NULL,
    trade VARCHAR(120),
    phone VARCHAR(64),
    dailyWage DOUBLE,
    active TINYINT(1) NOT NULL DEFAULT 1,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX wk_company_idx (companyId)
  )`,
  `CREATE TABLE IF NOT EXISTS worker_assignments (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    workerId BIGINT UNSIGNED NOT NULL,
    projectId BIGINT UNSIGNED NOT NULL,
    workDate DATE NOT NULL,
    note VARCHAR(500),
    createdById BIGINT UNSIGNED NOT NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX wa_worker_idx (workerId),
    INDEX wa_project_date_idx (projectId, workDate)
  )`,
  `CREATE TABLE IF NOT EXISTS daily_reports (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    projectId BIGINT UNSIGNED NOT NULL,
    reportDate DATE NOT NULL,
    workerCount INT NOT NULL DEFAULT 0,
    weather VARCHAR(60),
    content TEXT NOT NULL,
    aiSummary TEXT,
    createdById BIGINT UNSIGNED NOT NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX dr_project_idx (projectId, reportDate)
  )`,
  // --- Ekipler, bildirimler, AI analiz önbelleği (2026-10-21) ---
  `CREATE TABLE IF NOT EXISTS teams (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    companyId BIGINT UNSIGNED NOT NULL,
    name VARCHAR(120) NOT NULL,
    description VARCHAR(500),
    leadMemberId BIGINT UNSIGNED NULL,
    projectId BIGINT UNSIGNED NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX tm_company_idx (companyId)
  )`,
  `CREATE TABLE IF NOT EXISTS team_members (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    teamId BIGINT UNSIGNED NOT NULL,
    memberId BIGINT UNSIGNED NOT NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY tmm_team_member_uq (teamId, memberId),
    INDEX tmm_member_idx (memberId)
  )`,
  `CREATE TABLE IF NOT EXISTS notifications (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    companyId BIGINT UNSIGNED NOT NULL,
    userId BIGINT UNSIGNED NOT NULL,
    kind VARCHAR(32) NOT NULL,
    severity VARCHAR(16) NOT NULL DEFAULT 'info',
    title VARCHAR(255) NOT NULL,
    body TEXT,
    link VARCHAR(255),
    dedupeKey VARCHAR(128) NOT NULL,
    readAt TIMESTAMP NULL DEFAULT NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY nt_user_dedupe_uq (userId, dedupeKey),
    INDEX nt_user_read_idx (userId, readAt)
  )`,
  `CREATE TABLE IF NOT EXISTS ai_insights (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    companyId BIGINT UNSIGNED NOT NULL,
    inputHash VARCHAR(64) NOT NULL,
    resultJson LONGTEXT NOT NULL,
    aiUsed TINYINT(1) NOT NULL DEFAULT 1,
    createdById BIGINT UNSIGNED NOT NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX ai_company_idx (companyId, createdAt)
  )`,
  // --- Şirketim görev tanımları, danışmanlık süreç takibi (2026-10-23) ---
  `CREATE TABLE IF NOT EXISTS company_duties (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    companyId BIGINT UNSIGNED NOT NULL,
    name VARCHAR(160) NOT NULL,
    description VARCHAR(500),
    category VARCHAR(64),
    defaultMemberId BIGINT UNSIGNED NULL,
    defaultWorkerId BIGINT UNSIGNED NULL,
    defaultAssignee VARCHAR(255),
    defaultTeamId BIGINT UNSIGNED NULL,
    defaultPriority VARCHAR(16) NOT NULL DEFAULT 'normal',
    active TINYINT(1) NOT NULL DEFAULT 1,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX cd_company_idx (companyId)
  )`,
  `CREATE TABLE IF NOT EXISTS consulting_cases (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    refCode VARCHAR(16) NOT NULL,
    leadId BIGINT UNSIGNED NULL,
    clientName VARCHAR(255) NOT NULL,
    companyName VARCHAR(255),
    email VARCHAR(320),
    phone VARCHAR(64),
    packageId VARCHAR(48) NOT NULL,
    stageIndex INT NOT NULL DEFAULT 0,
    approval VARCHAR(16) NOT NULL DEFAULT 'none',
    approvalNote VARCHAR(500),
    status VARCHAR(16) NOT NULL DEFAULT 'active',
    startDate DATE NULL,
    targetDate DATE NULL,
    internalNote TEXT,
    createdById BIGINT UNSIGNED NOT NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY cc_ref_uq (refCode),
    INDEX cc_lead_idx (leadId)
  )`,
  `CREATE TABLE IF NOT EXISTS consulting_events (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    caseId BIGINT UNSIGNED NOT NULL,
    kind VARCHAR(16) NOT NULL,
    title VARCHAR(255) NOT NULL,
    body TEXT,
    isPublic TINYINT(1) NOT NULL DEFAULT 1,
    createdById BIGINT UNSIGNED NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX ce_case_idx (caseId, createdAt)
  )`,
  // --- Analitik, abonelik, sesli asistan (2026-10-23, sürüm _19) ---
  `CREATE TABLE IF NOT EXISTS task_events (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    companyId BIGINT UNSIGNED NOT NULL,
    projectId BIGINT UNSIGNED NOT NULL,
    taskKind VARCHAR(8) NOT NULL,
    taskId BIGINT UNSIGNED NOT NULL,
    kind VARCHAR(16) NOT NULL,
    fromValue VARCHAR(255),
    toValue VARCHAR(255),
    assignee VARCHAR(255),
    teamId BIGINT UNSIGNED NULL,
    dueDate DATE NULL,
    actorUserId BIGINT UNSIGNED NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX te_company_idx (companyId, createdAt),
    INDEX te_task_idx (taskKind, taskId)
  )`,
  `CREATE TABLE IF NOT EXISTS billing_requests (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    companyId BIGINT UNSIGNED NOT NULL,
    requestedById BIGINT UNSIGNED NOT NULL,
    tier VARCHAR(16) NOT NULL DEFAULT 'premium',
    billingInterval VARCHAR(16) NOT NULL,
    method VARCHAR(16) NOT NULL,
    amount INT NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'pending',
    reference VARCHAR(32) NOT NULL,
    note VARCHAR(500),
    decidedById BIGINT UNSIGNED NULL,
    decidedAt TIMESTAMP NULL DEFAULT NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX br_company_idx (companyId),
    INDEX br_status_idx (status)
  )`,
  `CREATE TABLE IF NOT EXISTS assistant_logs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    companyId BIGINT UNSIGNED NOT NULL,
    userId BIGINT UNSIGNED NOT NULL,
    transcript VARCHAR(1000) NOT NULL,
    intentJson TEXT,
    status VARCHAR(16) NOT NULL,
    error VARCHAR(500),
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX al_company_idx (companyId, createdAt)
  )`,
  `CREATE TABLE IF NOT EXISTS user_devices (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    userId BIGINT UNSIGNED NOT NULL,
    tokenHash VARCHAR(64) NOT NULL,
    deviceKeyHash VARCHAR(64),
    label VARCHAR(120),
    ip VARCHAR(64),
    userAgent VARCHAR(255),
    lastIp VARCHAR(64),
    lastSeenAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revokedAt TIMESTAMP NULL DEFAULT NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY ud_token_uq (tokenHash),
    INDEX ud_user_idx (userId),
    INDEX ud_key_idx (deviceKeyHash)
  )`,
  `CREATE TABLE IF NOT EXISTS login_tokens (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    userId BIGINT UNSIGNED NOT NULL,
    companyId BIGINT UNSIGNED NOT NULL,
    tokenHash VARCHAR(64) NOT NULL,
    createdById BIGINT UNSIGNED NOT NULL,
    expiresAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    usedAt TIMESTAMP NULL DEFAULT NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY lt_token_uq (tokenHash),
    INDEX lt_user_idx (userId)
  )`,
  `CREATE TABLE IF NOT EXISTS company_logos (
    companyId BIGINT UNSIGNED NOT NULL PRIMARY KEY,
    png MEDIUMTEXT NOT NULL,
    jpeg MEDIUMTEXT,
    width INT NOT NULL DEFAULT 0,
    height INT NOT NULL DEFAULT 0,
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS password_resets (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    userId BIGINT UNSIGNED NOT NULL,
    tokenHash VARCHAR(64) NOT NULL,
    expiresAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    usedAt TIMESTAMP NULL DEFAULT NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY pwr_token_uq (tokenHash),
    INDEX pwr_user_idx (userId)
  )`,
  `CREATE TABLE IF NOT EXISTS site_photos (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    companyId BIGINT UNSIGNED NOT NULL,
    projectId BIGINT UNSIGNED NOT NULL,
    takenAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    takenAtSource VARCHAR(8) NOT NULL DEFAULT 'upload',
    lat DOUBLE NULL,
    lng DOUBLE NULL,
    device VARCHAR(80) NULL,
    stage VARCHAR(16) NOT NULL DEFAULT 'genel',
    stageSource VARCHAR(8) NOT NULL DEFAULT 'user',
    mahalId BIGINT UNSIGNED NULL,
    folder VARCHAR(120) NOT NULL,
    fileName VARCHAR(160) NOT NULL,
    seq INT NOT NULL DEFAULT 1,
    note VARCHAR(500) NULL,
    source VARCHAR(12) NOT NULL DEFAULT 'web',
    uploadedById BIGINT UNSIGNED NULL,
    uploaderLabel VARCHAR(120) NULL,
    width INT NOT NULL DEFAULT 0,
    height INT NOT NULL DEFAULT 0,
    imageData MEDIUMTEXT NOT NULL,
    thumbData MEDIUMTEXT NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX sp_project_idx (projectId, takenAt),
    INDEX sp_company_idx (companyId)
  )`,
  `CREATE TABLE IF NOT EXISTS whatsapp_links (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    phone VARCHAR(32) NOT NULL,
    companyId BIGINT UNSIGNED NOT NULL,
    projectId BIGINT UNSIGNED NULL,
    label VARCHAR(120) NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY wl_phone_uq (phone),
    INDEX wl_company_idx (companyId)
  )`,
  `CREATE TABLE IF NOT EXISTS finance_entries (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    companyId BIGINT UNSIGNED NOT NULL,
    projectId BIGINT UNSIGNED NULL,
    direction VARCHAR(4) NOT NULL,
    category VARCHAR(24) NOT NULL,
    amount DOUBLE NOT NULL,
    entryDate DATE NOT NULL,
    status VARCHAR(10) NOT NULL DEFAULT 'pending',
    counterparty VARCHAR(160) NULL,
    note VARCHAR(500) NULL,
    decidedById BIGINT UNSIGNED NULL,
    decidedAt TIMESTAMP NULL DEFAULT NULL,
    createdById BIGINT UNSIGNED NOT NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX fe_company_idx (companyId, entryDate)
  )`,
  `CREATE TABLE IF NOT EXISTS decisions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    companyId BIGINT UNSIGNED NOT NULL,
    projectId BIGINT UNSIGNED NULL,
    kind VARCHAR(8) NOT NULL DEFAULT 'soru',
    topic VARCHAR(24) NOT NULL DEFAULT 'genel',
    question VARCHAR(1000) NOT NULL,
    askedByLabel VARCHAR(120) NULL,
    status VARCHAR(10) NOT NULL DEFAULT 'open',
    decision VARCHAR(1000) NULL,
    decidedById BIGINT UNSIGNED NULL,
    decidedAt TIMESTAMP NULL DEFAULT NULL,
    createdById BIGINT UNSIGNED NOT NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX dc_company_idx (companyId, status)
  )`,
  `CREATE TABLE IF NOT EXISTS resto_documents (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    companyId BIGINT UNSIGNED NOT NULL,
    restoProjectId BIGINT UNSIGNED NOT NULL,
    kind VARCHAR(16) NOT NULL,
    title VARCHAR(255) NOT NULL,
    content LONGTEXT NOT NULL,
    version INT NOT NULL DEFAULT 1,
    updatedById BIGINT UNSIGNED NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX rd_project_idx (restoProjectId)
  )`,
  `CREATE TABLE IF NOT EXISTS resto_doc_versions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    documentId BIGINT UNSIGNED NOT NULL,
    version INT NOT NULL,
    content LONGTEXT NOT NULL,
    savedById BIGINT UNSIGNED NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX rdv_doc_idx (documentId, version)
  )`,
  `CREATE TABLE IF NOT EXISTS feedback (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    companyId BIGINT UNSIGNED NULL,
    userId BIGINT UNSIGNED NOT NULL,
    kind VARCHAR(12) NOT NULL,
    page VARCHAR(160) NULL,
    message TEXT NOT NULL,
    status VARCHAR(12) NOT NULL DEFAULT 'open',
    reply TEXT NULL,
    answeredAt TIMESTAMP NULL DEFAULT NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX fb_status_idx (status, createdAt)
  )`,
  `CREATE TABLE IF NOT EXISTS app_errors (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    source VARCHAR(12) NOT NULL,
    path VARCHAR(160) NULL,
    code VARCHAR(40) NULL,
    message VARCHAR(1000) NOT NULL,
    userId BIGINT UNSIGNED NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX ae_created_idx (createdAt)
  )`,
  `CREATE TABLE IF NOT EXISTS consulting_time (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    caseId BIGINT UNSIGNED NOT NULL,
    workDate DATE NOT NULL,
    minutes INT NOT NULL,
    note VARCHAR(255) NULL,
    userId BIGINT UNSIGNED NOT NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX ct_case_idx (caseId),
    INDEX ct_date_idx (workDate)
  )`,
  `CREATE TABLE IF NOT EXISTS usage_counters (
    companyId BIGINT UNSIGNED NOT NULL,
    period VARCHAR(7) NOT NULL,
    kind VARCHAR(24) NOT NULL,
    n INT NOT NULL DEFAULT 0,
    UNIQUE KEY uc_pk (companyId, period, kind)
  )`,
  `CREATE TABLE IF NOT EXISTS site_events (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    type VARCHAR(12) NOT NULL,
    sid VARCHAR(24) NOT NULL,
    vid VARCHAR(16) NOT NULL,
    path VARCHAR(200) NOT NULL,
    refHost VARCHAR(120) NULL,
    channel VARCHAR(12) NOT NULL,
    utmSource VARCHAR(80) NULL,
    utmMedium VARCHAR(80) NULL,
    utmCampaign VARCHAR(120) NULL,
    device VARCHAR(8) NOT NULL,
    tz VARCHAR(48) NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX se_created_idx (createdAt),
    INDEX se_sid_idx (sid)
  )`,
  `CREATE TABLE IF NOT EXISTS lead_events (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    leadId BIGINT UNSIGNED NOT NULL,
    kind VARCHAR(12) NOT NULL,
    body VARCHAR(1000) NOT NULL,
    userId BIGINT UNSIGNED NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX le_lead_idx (leadId)
  )`,
  `CREATE TABLE IF NOT EXISTS lead_notes (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    leadId BIGINT UNSIGNED NOT NULL,
    kind VARCHAR(12) NOT NULL,
    body VARCHAR(1000) NOT NULL,
    userId BIGINT UNSIGNED NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX ln_lead_idx (leadId)
  )`,
  `CREATE TABLE IF NOT EXISTS app_meta (
    metaKey VARCHAR(64) NOT NULL PRIMARY KEY,
    metaValue VARCHAR(255) NOT NULL,
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
];

/**
 * Var olan tablolara sonradan eklenen sütunlar.
 * MySQL/MariaDB sürüm farkına takılmamak için "ADD COLUMN IF NOT EXISTS" yerine
 * information_schema ile kontrol edilir (bkz. Ana Hafıza §8 ders 2).
 */
/** Sütun genişletmeleri (her açılışta güvenle tekrarlanır) */
export const COLUMN_WIDENINGS: string[] = [
  // Birden çok görev seçilebiliyor: "Seramik, Fayans, Alçı"
  "ALTER TABLE company_members MODIFY COLUMN trade VARCHAR(160) NULL",
];

export const COLUMN_ADDITIONS: { table: string; column: string; ddl: string }[] = [
  { table: "users", column: "passwordHash", ddl: "ALTER TABLE users ADD COLUMN passwordHash VARCHAR(255) NULL AFTER email" },
  { table: "company_members", column: "profession", ddl: "ALTER TABLE company_members ADD COLUMN profession VARCHAR(32) NULL AFTER displayName" },
  { table: "projects", column: "priority", ddl: "ALTER TABLE projects ADD COLUMN priority VARCHAR(16) NOT NULL DEFAULT 'normal' AFTER status" },
  { table: "projects", column: "targetDate", ddl: "ALTER TABLE projects ADD COLUMN targetDate DATE NULL AFTER priority" },
  { table: "tasks", column: "priority", ddl: "ALTER TABLE tasks ADD COLUMN priority VARCHAR(16) NOT NULL DEFAULT 'normal' AFTER dueDate" },
  { table: "tasks", column: "teamId", ddl: "ALTER TABLE tasks ADD COLUMN teamId BIGINT UNSIGNED NULL AFTER priority" },
  { table: "tasks", column: "dutyId", ddl: "ALTER TABLE tasks ADD COLUMN dutyId BIGINT UNSIGNED NULL AFTER teamId" },
  { table: "plan_tasks", column: "dutyId", ddl: "ALTER TABLE plan_tasks ADD COLUMN dutyId BIGINT UNSIGNED NULL AFTER note" },
  { table: "companies", column: "phone", ddl: "ALTER TABLE companies ADD COLUMN phone VARCHAR(64) NULL AFTER inviteCode" },
  { table: "companies", column: "email", ddl: "ALTER TABLE companies ADD COLUMN email VARCHAR(320) NULL AFTER phone" },
  { table: "companies", column: "address", ddl: "ALTER TABLE companies ADD COLUMN address VARCHAR(500) NULL AFTER email" },
  { table: "users", column: "tourState", ddl: "ALTER TABLE users ADD COLUMN tourState VARCHAR(255) NULL AFTER role" },
  { table: "tasks", column: "startedAt", ddl: "ALTER TABLE tasks ADD COLUMN startedAt TIMESTAMP NULL DEFAULT NULL AFTER dutyId" },
  { table: "tasks", column: "completedAt", ddl: "ALTER TABLE tasks ADD COLUMN completedAt TIMESTAMP NULL DEFAULT NULL AFTER startedAt" },
  { table: "plan_tasks", column: "dueDate", ddl: "ALTER TABLE plan_tasks ADD COLUMN dueDate DATE NULL AFTER dutyId" },
  { table: "plan_tasks", column: "priority", ddl: "ALTER TABLE plan_tasks ADD COLUMN priority VARCHAR(16) NOT NULL DEFAULT 'normal' AFTER dueDate" },
  { table: "plan_tasks", column: "teamId", ddl: "ALTER TABLE plan_tasks ADD COLUMN teamId BIGINT UNSIGNED NULL AFTER priority" },
  { table: "plan_tasks", column: "startedAt", ddl: "ALTER TABLE plan_tasks ADD COLUMN startedAt TIMESTAMP NULL DEFAULT NULL AFTER teamId" },
  { table: "plan_tasks", column: "completedAt", ddl: "ALTER TABLE plan_tasks ADD COLUMN completedAt TIMESTAMP NULL DEFAULT NULL AFTER startedAt" },
  { table: "subscriptions", column: "tier", ddl: "ALTER TABLE subscriptions ADD COLUMN tier VARCHAR(16) NOT NULL DEFAULT 'free'" },
  { table: "subscriptions", column: "trialEndsAt", ddl: "ALTER TABLE subscriptions ADD COLUMN trialEndsAt TIMESTAMP NULL DEFAULT NULL" },
  { table: "subscriptions", column: "currentPeriodEnd", ddl: "ALTER TABLE subscriptions ADD COLUMN currentPeriodEnd TIMESTAMP NULL DEFAULT NULL" },
  { table: "subscriptions", column: "provider", ddl: "ALTER TABLE subscriptions ADD COLUMN provider VARCHAR(32) NULL" },
  { table: "user_devices", column: "revokeReason", ddl: "ALTER TABLE user_devices ADD COLUMN revokeReason VARCHAR(16) NULL AFTER revokedAt" },
  { table: "floor_plans", column: "widthM", ddl: "ALTER TABLE floor_plans ADD COLUMN widthM DOUBLE NULL AFTER imageData" },
  { table: "floor_plans", column: "wallHeightM", ddl: "ALTER TABLE floor_plans ADD COLUMN wallHeightM DOUBLE NULL AFTER widthM" },
  { table: "floor_plans", column: "walls", ddl: "ALTER TABLE floor_plans ADD COLUMN walls MEDIUMTEXT NULL AFTER wallHeightM" },
  { table: "floor_plans", column: "textLayer", ddl: "ALTER TABLE floor_plans ADD COLUMN textLayer MEDIUMTEXT NULL AFTER walls" },
  { table: "floor_plans", column: "elements", ddl: "ALTER TABLE floor_plans ADD COLUMN elements MEDIUMTEXT NULL AFTER textLayer" },
  { table: "leads", column: "stage", ddl: "ALTER TABLE leads ADD COLUMN stage VARCHAR(16) NOT NULL DEFAULT 'basvuru' AFTER status" },
  { table: "leads", column: "stageAt", ddl: "ALTER TABLE leads ADD COLUMN stageAt TIMESTAMP NULL AFTER stage" },
  { table: "leads", column: "followUps", ddl: "ALTER TABLE leads ADD COLUMN followUps INT NOT NULL DEFAULT 0 AFTER stageAt" },
  { table: "leads", column: "lostReason", ddl: "ALTER TABLE leads ADD COLUMN lostReason VARCHAR(16) NULL AFTER followUps" },
  { table: "leads", column: "lostNote", ddl: "ALTER TABLE leads ADD COLUMN lostNote VARCHAR(255) NULL AFTER lostReason" },
  { table: "leads", column: "sid", ddl: "ALTER TABLE leads ADD COLUMN sid VARCHAR(24) NULL AFTER lostNote" },
  { table: "companies", column: "crewPin", ddl: "ALTER TABLE companies ADD COLUMN crewPin VARCHAR(8) NULL UNIQUE AFTER inviteCode" },
  { table: "companies", column: "pinMode", ddl: "ALTER TABLE companies ADD COLUMN pinMode VARCHAR(12) NOT NULL DEFAULT 'company' AFTER crewPin" },
  { table: "projects", column: "crewPin", ddl: "ALTER TABLE projects ADD COLUMN crewPin VARCHAR(8) NULL UNIQUE AFTER targetDate" },
  { table: "projects", column: "projectNo", ddl: "ALTER TABLE projects ADD COLUMN projectNo VARCHAR(16) NULL AFTER crewPin" },
  { table: "projects", column: "restoration", ddl: "ALTER TABLE projects ADD COLUMN restoration TINYINT(1) NOT NULL DEFAULT 0 AFTER projectNo" },
  { table: "projects", column: "budget", ddl: "ALTER TABLE projects ADD COLUMN budget DOUBLE NULL AFTER restoration" },
  { table: "resto_projects", column: "linkedProjectId", ddl: "ALTER TABLE resto_projects ADD COLUMN linkedProjectId BIGINT UNSIGNED NULL AFTER location" },
  { table: "companies", column: "logoVersion", ddl: "ALTER TABLE companies ADD COLUMN logoVersion INT NOT NULL DEFAULT 0 AFTER address" },
  { table: "user_devices", column: "deviceKeyHash", ddl: "ALTER TABLE user_devices ADD COLUMN deviceKeyHash VARCHAR(64) NULL AFTER tokenHash, ADD INDEX ud_key_idx (deviceKeyHash)" },
  { table: "users", column: "loginNo", ddl: "ALTER TABLE users ADD COLUMN loginNo VARCHAR(8) NULL UNIQUE AFTER tourState" },
  { table: "company_members", column: "trade", ddl: "ALTER TABLE company_members ADD COLUMN trade VARCHAR(80) NULL AFTER profession" },
  { table: "company_members", column: "phone", ddl: "ALTER TABLE company_members ADD COLUMN phone VARCHAR(32) NULL AFTER trade" },
  { table: "company_members", column: "joinedVia", ddl: "ALTER TABLE company_members ADD COLUMN joinedVia VARCHAR(16) NULL AFTER phone" },
  { table: "company_members", column: "lastSeenAt", ddl: "ALTER TABLE company_members ADD COLUMN lastSeenAt TIMESTAMP NULL DEFAULT NULL AFTER joinedVia" },
  { table: "company_members", column: "projectId", ddl: "ALTER TABLE company_members ADD COLUMN projectId BIGINT UNSIGNED NULL AFTER phone" },
  // Eski kurulumlarda mahals.code eksik olabilir → manuel mahal kaydı "Unknown column" ile düşer
  { table: "mahals", column: "code", ddl: "ALTER TABLE mahals ADD COLUMN code VARCHAR(64) NULL AFTER name" },
];

/** drizzle mysql2 execute: [rows, fields] dizisi döner; bazı sürümlerde {rows} objesi */
function firstRow(raw: unknown): Record<string, unknown> | undefined {
  const arr = Array.isArray(raw) ? (raw as unknown[][])[0] : (raw as { rows?: unknown[] }).rows;
  return arr?.[0] as Record<string, unknown> | undefined;
}

async function columnExists(table: string, column: string): Promise<boolean> {
  const raw: unknown = await getDb().execute(
    sql`SELECT COUNT(*) AS c FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ${table} AND COLUMN_NAME = ${column}`,
  );
  return Number(firstRow(raw)?.c ?? 0) > 0;
}

let ran = false;

export async function runMigrations() {
  if (ran) return;
  ran = true;
  const db = getDb();
  // Tek tek try/catch: tek bir ifade hata verse bile site açılır,
  // hata log'dan izlenir (boot crash'i önlenir).
  for (const stmt of STATEMENTS) {
    try {
      await db.execute(sql.raw(stmt));
    } catch (e) {
      console.error("[migrate] ifade atlandı:", (e as Error).message);
    }
  }
  for (const add of COLUMN_ADDITIONS) {
    try {
      if (!(await columnExists(add.table, add.column))) {
        try {
          await db.execute(sql.raw(add.ddl));
        } catch (e) {
          // "AFTER x" sütunu henüz yoksa (temiz kurulumda sıra) sütunu sona ekle — sütun sırası uygulamayı etkilemez
          const plain = add.ddl.replace(/\s+AFTER\s+\w+/g, "");
          if (plain === add.ddl) throw e;
          console.warn(`[migrate] ${add.table}.${add.column}: AFTER olmadan yeniden deneniyor (${(e as Error).message})`);
          await db.execute(sql.raw(plain));
        }
        console.log(`[migrate] ${add.table}.${add.column} eklendi`);
      }
    } catch (e) {
      console.error(`[migrate] ${add.table}.${add.column} kontrolü hatası:`, (e as Error).message);
    }
  }
  // Son kontrol: eksik sütun kalırsa açıkça yaz (aksi hâlde her sorgu "Failed query" ile düşer)
  for (const add of COLUMN_ADDITIONS) {
    try {
      if (!(await columnExists(add.table, add.column))) console.error(`[migrate] !!! EKSİK SÜTUN: ${add.table}.${add.column}`);
    } catch {
      /* yok say */
    }
  }
  for (const ddl of COLUMN_WIDENINGS) {
    try {
      await db.execute(sql.raw(ddl));
    } catch (e) {
      console.error("[migrate] genişletme atlandı:", (e as Error).message);
    }
  }
  try {
    await normalizeExistingData();
  } catch (e) {
    console.error("[migrate] veri biçimlendirme atlandı:", (e as Error).message);
  }
  try {
    await normalizeTitlesV2();
  } catch (e) {
    console.error("[migrate] başlık biçimlendirme atlandı:", (e as Error).message);
  }
  try {
    await grantInitialTrials();
  } catch (e) {
    console.error("[migrate] deneme süresi tanımlama atlandı:", (e as Error).message);
  }
  try {
    await backfillTaskTimestamps();
  } catch (e) {
    console.error("[migrate] görev zaman damgası doldurma atlandı:", (e as Error).message);
  }
  try {
    await assignCrewPins();
  } catch (e) {
    console.error("[migrate] şantiye PIN atama atlandı:", (e as Error).message);
  }
  try {
    await backfillLeadStages();
  } catch (e) {
    console.error("[migrate] başvuru aşaması doldurma atlandı:", (e as Error).message);
  }
  console.log("[migrate] şema kontrolü tamam");
}

/**
 * Tek seferlik: mevcut kayıtlardaki isim / e-posta / telefonları ortak biçime getirir
 * (contracts/normalize.ts). app_meta'ya işaret konur, sonraki açılışlarda çalışmaz.
 * unionId'ye (giriş anahtarı) DOKUNULMAZ.
 */
const NORMALIZE_KEY = "normalize_v1";

async function normalizeExistingData() {
  const db = getDb();
  const done = await db.query.appMeta.findFirst({ where: eq(appMeta.metaKey, NORMALIZE_KEY) });
  if (done) return;

  let changed = 0;
  const userRows = await db.select({ id: users.id, name: users.name, email: users.email }).from(users);
  for (const u of userRows) {
    const name = u.name ? formatPersonName(u.name) : u.name;
    const email = u.email ? normalizeEmail(u.email) : u.email;
    if (name !== u.name || email !== u.email) {
      await db.update(users).set({ name, email }).where(eq(users.id, u.id));
      changed++;
    }
  }
  const memberRows = await db
    .select({ id: companyMembers.id, displayName: companyMembers.displayName })
    .from(companyMembers);
  for (const m of memberRows) {
    if (!m.displayName) continue;
    const displayName = formatPersonName(m.displayName);
    if (displayName !== m.displayName) {
      await db.update(companyMembers).set({ displayName }).where(eq(companyMembers.id, m.id));
      changed++;
    }
  }
  const workerRows = await db.select({ id: workers.id, name: workers.name, phone: workers.phone }).from(workers);
  for (const w of workerRows) {
    const name = formatPersonName(w.name);
    const phone = w.phone ? formatPhoneTR(w.phone) : w.phone;
    if (name !== w.name || phone !== w.phone) {
      await db.update(workers).set({ name, phone }).where(eq(workers.id, w.id));
      changed++;
    }
  }
  const leadRows = await db
    .select({ id: leads.id, name: leads.name, email: leads.email, phone: leads.phone })
    .from(leads);
  for (const l of leadRows) {
    const name = formatPersonName(l.name);
    const email = l.email ? normalizeEmail(l.email) : l.email;
    const phone = l.phone ? formatPhoneTR(l.phone) : l.phone;
    if (name !== l.name || email !== l.email || phone !== l.phone) {
      await db.update(leads).set({ name, email, phone }).where(eq(leads.id, l.id));
      changed++;
    }
  }
  await db.insert(appMeta).values({ metaKey: NORMALIZE_KEY, metaValue: new Date().toISOString() });
  console.log(`[migrate] isim/e-posta biçimlendirme tamam (${changed} kayıt güncellendi)`);
}

/**
 * Tek seferlik (normalize_v2): şantiye, iş, mahal, malzeme, ekip, şirket, plan ve görev tanımı adlarını
 * başlık biçimine getirir ("çekmeköy" → "Çekmeköy", "İSTANBUL" → "İstanbul"). Sorumlu adları kişi biçimine.
 */
async function normalizeTitlesV2() {
  const KEY = "normalize_v2";
  const db = getDb();
  if (await db.query.appMeta.findFirst({ where: eq(appMeta.metaKey, KEY) })) return;
  let changed = 0;
  const bump = (a: unknown, b: unknown) => (a !== b ? 1 : 0);

  for (const r of await db.select({ id: projects.id, name: projects.name, location: projects.location }).from(projects)) {
    const name = formatTitle(r.name);
    const location = titleOrNull(r.location);
    if (bump(name, r.name) || bump(location, r.location)) {
      await db.update(projects).set({ name, location }).where(eq(projects.id, r.id));
      changed++;
    }
  }
  for (const r of await db.select({ id: tasks.id, title: tasks.title, assignee: tasks.assignee }).from(tasks)) {
    const title = formatTitle(r.title);
    const assignee = r.assignee ? formatPersonName(r.assignee) || null : null;
    if (bump(title, r.title) || bump(assignee, r.assignee)) {
      await db.update(tasks).set({ title, assignee }).where(eq(tasks.id, r.id));
      changed++;
    }
  }
  for (const r of await db.select({ id: planTasks.id, title: planTasks.title, assignee: planTasks.assignee }).from(planTasks)) {
    const title = formatTitle(r.title);
    const assignee = r.assignee ? formatPersonName(r.assignee) || null : null;
    if (bump(title, r.title) || bump(assignee, r.assignee)) {
      await db.update(planTasks).set({ title, assignee }).where(eq(planTasks.id, r.id));
      changed++;
    }
  }
  for (const r of await db.select({ id: mahals.id, name: mahals.name }).from(mahals)) {
    const name = formatTitle(r.name);
    if (bump(name, r.name)) {
      await db.update(mahals).set({ name }).where(eq(mahals.id, r.id));
      changed++;
    }
  }
  for (const r of await db.select({ id: materials.id, name: materials.name }).from(materials)) {
    const name = formatTitle(r.name);
    if (bump(name, r.name)) {
      await db.update(materials).set({ name }).where(eq(materials.id, r.id));
      changed++;
    }
  }
  for (const r of await db.select({ id: teams.id, name: teams.name }).from(teams)) {
    const name = formatTitle(r.name);
    if (bump(name, r.name)) {
      await db.update(teams).set({ name }).where(eq(teams.id, r.id));
      changed++;
    }
  }
  for (const r of await db.select({ id: companies.id, name: companies.name, city: companies.city }).from(companies)) {
    const name = formatTitle(r.name);
    const city = r.city ? formatPersonName(r.city) || null : null;
    if (bump(name, r.name) || bump(city, r.city)) {
      await db.update(companies).set({ name, city }).where(eq(companies.id, r.id));
      changed++;
    }
  }
  for (const r of await db.select({ id: floorPlans.id, name: floorPlans.name, floorLabel: floorPlans.floorLabel }).from(floorPlans)) {
    const name = formatTitle(r.name);
    const floorLabel = formatTitle(r.floorLabel);
    if (bump(name, r.name) || bump(floorLabel, r.floorLabel)) {
      await db.update(floorPlans).set({ name, floorLabel }).where(eq(floorPlans.id, r.id));
      changed++;
    }
  }
  for (const r of await db.select({ id: companyDuties.id, name: companyDuties.name }).from(companyDuties)) {
    const name = formatTitle(r.name);
    if (bump(name, r.name)) {
      await db.update(companyDuties).set({ name }).where(eq(companyDuties.id, r.id));
      changed++;
    }
  }
  await db.insert(appMeta).values({ metaKey: KEY, metaValue: new Date().toISOString() });
  console.log(`[migrate] başlık biçimlendirme tamam (${changed} kayıt)`);
}

/**
 * Analitik için: tamamlanmış ama completedAt'i boş eski işlere updatedAt yazılır (yaklaşık bitiş).
 * Her açılışta güvenle çalışır (yalnız boş olanlar).
 */
async function backfillTaskTimestamps() {
  const db = getDb();
  await db.execute(sql`UPDATE tasks SET completedAt = updatedAt WHERE status = 'done' AND completedAt IS NULL`);
  await db.execute(sql`UPDATE plan_tasks SET completedAt = updatedAt WHERE status = 'done' AND completedAt IS NULL`);
  await db.execute(sql`UPDATE tasks SET startedAt = updatedAt WHERE status = 'doing' AND startedAt IS NULL`);
  await db.execute(sql`UPDATE plan_tasks SET startedAt = updatedAt WHERE status = 'doing' AND startedAt IS NULL`);
}

/**
 * Tek seferlik (trial_v1): abonelik sistemi açılmadan önce kayıt olmuş şirketler aniden kilitlenmesin diye
 * TRIAL_DAYS (varsayılan 14) gün Premium deneme tanımlanır.
 */
async function grantInitialTrials() {
  const KEY = "trial_v1";
  const db = getDb();
  if (await db.query.appMeta.findFirst({ where: eq(appMeta.metaKey, KEY) })) return;
  const days = Number(process.env.TRIAL_DAYS ?? 14);
  const until = new Date(Date.now() + Math.max(days, 0) * 86_400_000);
  const all = await db.select({ id: companies.id }).from(companies);
  const subs = await db.select({ id: subscriptions.id, companyId: subscriptions.companyId, trialEndsAt: subscriptions.trialEndsAt }).from(subscriptions);
  let n = 0;
  for (const c of all) {
    const s = subs.find((x) => x.companyId === c.id);
    if (!s) {
      await db.insert(subscriptions).values({ companyId: c.id, plan: "pro", interval: "monthly", status: "trial", tier: "free", trialEndsAt: until });
      n++;
    } else if (!s.trialEndsAt) {
      await db.update(subscriptions).set({ trialEndsAt: until }).where(eq(subscriptions.id, s.id));
      n++;
    }
  }
  await db.insert(appMeta).values({ metaKey: KEY, metaValue: new Date().toISOString() });
  console.log(`[migrate] ${n} şirkete ${days} gün Premium deneme tanımlandı`);
}

/** Şantiye PIN'i olmayan şirketlere 4 haneli PIN ver (her açılışta yalnız eksikler) */
async function assignCrewPins() {
  const db = getDb();
  const rows = await db.query.companies.findMany({ where: isNull(companies.crewPin), columns: { id: true } });
  for (const r of rows) {
    await db.update(companies).set({ crewPin: await generateCrewPin() }).where(eq(companies.id, r.id));
  }
  if (rows.length) console.log(`[migrate] ${rows.length} şirkete ekip PIN'i verildi`);
  const prj = await db.query.projects.findMany({ where: isNull(projects.crewPin), columns: { id: true } });
  for (const r of prj) {
    await db.update(projects).set({ crewPin: await generateCrewPin() }).where(eq(projects.id, r.id));
  }
  if (prj.length) console.log(`[migrate] ${prj.length} şantiyeye PIN verildi`);
}

/**
 * Tek seferlik (lead_stage_v1): satış hunisi açılmadan önceki başvurulara aşama ver.
 * contacted → yanıt verildi; done → süreç başlatılmışsa imza, değilse kayıp (neden: diğer).
 */
async function backfillLeadStages() {
  const KEY = "lead_stage_v1";
  const db = getDb();
  if (await db.query.appMeta.findFirst({ where: eq(appMeta.metaKey, KEY) })) return;
  const rows = await db.select({ id: leads.id, status: leads.status, createdAt: leads.createdAt }).from(leads);
  const cases = await db.select({ leadId: consultingCases.leadId }).from(consultingCases);
  let n = 0;
  for (const l of rows) {
    if (l.status === "new") continue;
    const hasCase = cases.some((c) => c.leadId === l.id);
    const stage = l.status === "contacted" ? "yanit" : hasCase ? "imza" : "kayip";
    await db
      .update(leads)
      .set({ stage, stageAt: l.createdAt, lostReason: stage === "kayip" ? "diger" : null })
      .where(eq(leads.id, l.id));
    n++;
  }
  await db.insert(appMeta).values({ metaKey: KEY, metaValue: new Date().toISOString() });
  if (n) console.log(`[migrate] ${n} başvuruya huni aşaması verildi`);
}

// Drizzle şeması (SQLite). Zaman damgaları epoch-ms tamsayı; JSON sütunları metin + zod doğrulama.
// Postgres'e geçişte yalnızca bu dosyadaki sütun yardımcıları (pg-core) değişir.
import { sqliteTable, integer, text, real, primaryKey, uniqueIndex, index } from 'drizzle-orm/sqlite-core';

const now = () => Date.now();
const ts = (name: string) => integer(name).notNull().$defaultFn(now);

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull().unique(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  fullName: text('full_name').notNull().default(''),
  role: text('role', { enum: ['user', 'admin'] }).notNull().default('user'),
  plan: text('plan', { enum: ['free', 'premium'] }).notNull().default('free'),
  locale: text('locale', { enum: ['tr', 'en', 'ru'] }).notNull().default('tr'),
  theme: text('theme', { enum: ['paper', 'ink'] }).notNull().default('paper'),
  onboardedAt: integer('onboarded_at'),
  xp: integer('xp').notNull().default(0),
  streak: integer('streak').notNull().default(0),
  longestStreak: integer('longest_streak').notNull().default(0),
  lastActiveDay: text('last_active_day'),
  createdAt: ts('created_at'),
});

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(), // sha256(token)
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: integer('expires_at').notNull(),
  userAgent: text('user_agent').notNull().default(''),
  createdAt: ts('created_at'),
}, (t) => [index('sessions_user_idx').on(t.userId)]);

export const cognitiveProfiles = sqliteTable('cognitive_profiles', {
  userId: integer('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  modality: text('modality', { enum: ['visual', 'auditory', 'kinesthetic'] }).notNull(),
  reasoning: text('reasoning', { enum: ['analytic', 'holistic'] }).notNull(),
  profileKey: text('profile_key').notNull(),
  scores: text('scores', { mode: 'json' }).$type<Record<string, number>>().notNull(),
  updatedAt: ts('updated_at'),
});

/** Öğrenme grafiğinin ilk katmanı: metot başına gerçek doğruluk. */
export const methodStats = sqliteTable('method_stats', {
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  method: text('method').notNull(),
  attempts: integer('attempts').notNull().default(0),
  correct: integer('correct').notNull().default(0),
}, (t) => [primaryKey({ columns: [t.userId, t.method] })]);

export const courses = sqliteTable('courses', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  topic: text('topic').notNull(),
  level: text('level', { enum: ['beginner', 'intermediate', 'advanced'] }).notNull(),
  locale: text('locale', { enum: ['tr', 'en', 'ru'] }).notNull(),
  profileKey: text('profile_key').notNull(),
  method: text('method').notNull(),
  source: text('source', { enum: ['free', 'meb'] }).notNull().default('free'),
  mebGrade: text('meb_grade'),
  mebSubject: text('meb_subject'),
  mebUnit: text('meb_unit'),
  status: text('status', { enum: ['queued', 'generating', 'ready', 'failed'] }).notNull().default('queued'),
  generator: text('generator', { enum: ['ai', 'template'] }),
  doc: text('doc'), // CourseDoc JSON
  moduleCount: integer('module_count').notNull().default(0),
  shareSlug: text('share_slug').unique(),
  completedAt: integer('completed_at'),
  createdAt: ts('created_at'),
  updatedAt: ts('updated_at'),
}, (t) => [index('courses_user_idx').on(t.userId)]);

export const courseTranslations = sqliteTable('course_translations', {
  courseId: integer('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
  locale: text('locale').notNull(),
  doc: text('doc').notNull(),
  createdAt: ts('created_at'),
}, (t) => [primaryKey({ columns: [t.courseId, t.locale] })]);

export const jobs = sqliteTable('jobs', {
  id: text('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  courseId: integer('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
  kind: text('kind', { enum: ['generate', 'translate'] }).notNull().default('generate'),
  locale: text('locale'),
  stage: text('stage').notNull().default('queued'),
  percent: integer('percent').notNull().default(0),
  error: text('error'),
  createdAt: ts('created_at'),
  updatedAt: ts('updated_at'),
}, (t) => [index('jobs_user_idx').on(t.userId)]);

export const moduleProgress = sqliteTable('module_progress', {
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  courseId: integer('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
  moduleIdx: integer('module_idx').notNull(),
  taskDoneAt: integer('task_done_at'),
  quizPassedAt: integer('quiz_passed_at'),
  quizBest: integer('quiz_best').notNull().default(0),
  completedAt: integer('completed_at'),
  seconds: integer('seconds').notNull().default(0),
}, (t) => [primaryKey({ columns: [t.userId, t.courseId, t.moduleIdx] })]);

export const checkAnswers = sqliteTable('check_answers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  courseId: integer('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
  itemId: text('item_id').notNull(),
  correct: integer('correct', { mode: 'boolean' }).notNull(),
  confidence: integer('confidence').notNull().default(2),
  method: text('method').notNull(),
  createdAt: ts('created_at'),
}, (t) => [index('check_answers_user_idx').on(t.userId, t.courseId)]);

export const quizAttempts = sqliteTable('quiz_attempts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  courseId: integer('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
  moduleIdx: integer('module_idx').notNull(), // -1 = final değerlendirme
  answers: text('answers', { mode: 'json' }).$type<number[]>().notNull(),
  score: integer('score').notNull(),
  total: integer('total').notNull(),
  passed: integer('passed', { mode: 'boolean' }).notNull(),
  createdAt: ts('created_at'),
}, (t) => [index('quiz_attempts_user_idx').on(t.userId, t.courseId)]);

export const reviewCards = sqliteTable('review_cards', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  courseId: integer('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
  itemId: text('item_id').notNull(),
  stability: real('stability').notNull().default(0),
  difficulty: real('difficulty').notNull().default(0),
  reps: integer('reps').notNull().default(0),
  lapses: integer('lapses').notNull().default(0),
  lastReview: integer('last_review'),
  due: integer('due').notNull(),
}, (t) => [uniqueIndex('review_cards_item_uq').on(t.userId, t.courseId, t.itemId), index('review_cards_due_idx').on(t.userId, t.due)]);

/** XP defteri: refKey benzersizliği ödülleri idempotent yapar (çift tıklama / yarış). */
export const xpEvents = sqliteTable('xp_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(),
  amount: integer('amount').notNull(),
  refKey: text('ref_key').notNull(),
  createdAt: ts('created_at'),
}, (t) => [uniqueIndex('xp_events_ref_uq').on(t.userId, t.refKey)]);

export const activityDays = sqliteTable('activity_days', {
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  day: text('day').notNull(),
  xp: integer('xp').notNull().default(0),
  seconds: integer('seconds').notNull().default(0),
}, (t) => [primaryKey({ columns: [t.userId, t.day] })]);

export const modeUsage = sqliteTable('mode_usage', {
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  mode: text('mode').notNull(),
  seconds: integer('seconds').notNull().default(0),
}, (t) => [primaryKey({ columns: [t.userId, t.mode] })]);

export const userBadges = sqliteTable('user_badges', {
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  badgeKey: text('badge_key').notNull(),
  awardedAt: ts('awarded_at'),
}, (t) => [primaryKey({ columns: [t.userId, t.badgeKey] })]);

export const mindmaps = sqliteTable('mindmaps', {
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  courseId: integer('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
  nodes: text('nodes').notNull(),
  updatedAt: ts('updated_at'),
}, (t) => [primaryKey({ columns: [t.userId, t.courseId] })]);

export const certificates = sqliteTable('certificates', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  code: text('code').notNull().unique(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  courseId: integer('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
  scorePct: integer('score_pct').notNull(),
  issuedAt: ts('issued_at'),
}, (t) => [uniqueIndex('certificates_course_uq').on(t.userId, t.courseId)]);

export const submissions = sqliteTable('submissions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  courseId: integer('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
  moduleIdx: integer('module_idx').notNull(),
  kind: text('kind', { enum: ['note', 'audio'] }).notNull(),
  filename: text('filename').notNull(),
  stored: text('stored').notNull(),
  mime: text('mime').notNull(),
  size: integer('size').notNull(),
  createdAt: ts('created_at'),
});

export const aiCache = sqliteTable('ai_cache', {
  key: text('key').primaryKey(),
  task: text('task').notNull(),
  model: text('model').notNull(),
  normInput: text('norm_input').notNull(),
  embedding: text('embedding'), // JSON number[] (opsiyonel semantik eşleşme)
  output: text('output').notNull(),
  hits: integer('hits').notNull().default(0),
  createdAt: ts('created_at'),
  expiresAt: integer('expires_at').notNull(),
}, (t) => [index('ai_cache_task_idx').on(t.task, t.createdAt)]);

export const aiUsage = sqliteTable('ai_usage', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id'),
  task: text('task').notNull(),
  tier: text('tier').notNull(),
  provider: text('provider').notNull(),
  model: text('model').notNull(),
  inTokens: integer('in_tokens').notNull().default(0),
  outTokens: integer('out_tokens').notNull().default(0),
  cached: integer('cached', { mode: 'boolean' }).notNull().default(false),
  ms: integer('ms').notNull().default(0),
  ok: integer('ok', { mode: 'boolean' }).notNull().default(true),
  createdAt: ts('created_at'),
});

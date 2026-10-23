// Ortam değişkenleri — tek noktada doğrulanır; eksik/yanlış değerle sunucu açılmaz.
import fs from 'node:fs';
import { z } from 'zod';

const bool = z.enum(['0', '1', 'true', 'false']).transform((v) => v === '1' || v === 'true');

const Env = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().default(3000),
  HOST: z.string().default('0.0.0.0'),
  // Render/Railway gibi platformlar genel adresi kendisi verir; yoksa localhost.
  APP_URL: z.string().url().default(process.env.RENDER_EXTERNAL_URL || process.env.RAILWAY_PUBLIC_DOMAIN && `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` || 'http://localhost:3000'),
  DATA_DIR: z.string().default('./data'),
  SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  COOKIE_SECURE: bool.optional(),
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().min(10).optional(),
  FREE_COURSE_LIMIT: z.coerce.number().int().min(0).default(3),
  ALLOW_SIMULATED_UPGRADE: bool.default('1'),

  AI_PROVIDER: z.enum(['auto', 'anthropic', 'openai', 'ollama', 'none']).default('auto'),
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_BASE_URL: z.string().url().default('https://api.openai.com/v1'),
  OLLAMA_URL: z.string().url().optional(),
  AI_MODEL_LIGHT: z.string().optional(),
  AI_MODEL_HEAVY: z.string().optional(),
  AI_EMBED_MODEL: z.string().optional(),
  AI_CACHE_TTL_DAYS: z.coerce.number().int().min(0).default(30),
  AI_TIMEOUT_MS: z.coerce.number().int().min(5000).default(120000),
});

// .env varsa yükle (Node ≥ 21.7 yerleşik); boş değerler "tanımsız" sayılır.
try { if (fs.existsSync('.env')) process.loadEnvFile('.env'); } catch (e) { console.warn('[env] .env okunamadı:', (e as Error).message); }
const raw = Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== undefined && v !== ''));
// Render: genel adres otomatik gelir
if (!raw.APP_URL && raw.RENDER_EXTERNAL_URL) raw.APP_URL = raw.RENDER_EXTERNAL_URL;
const parsed = Env.safeParse(raw);
if (!parsed.success) {
  console.error('[env] geçersiz yapılandırma:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}
export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';

export type ProviderName = 'anthropic' | 'openai' | 'ollama' | 'none';
export function resolveProvider(): ProviderName {
  if (env.AI_PROVIDER !== 'auto') return env.AI_PROVIDER;
  if (env.ANTHROPIC_API_KEY) return 'anthropic';
  if (env.OPENAI_API_KEY) return 'openai';
  if (env.OLLAMA_URL) return 'ollama';
  return 'none';
}

const DEFAULT_MODELS: Record<Exclude<ProviderName, 'none'>, { light: string; heavy: string }> = {
  anthropic: { light: 'claude-haiku-5-5', heavy: 'claude-sonnet-5-5' },
  openai: { light: 'gpt-4.1-mini', heavy: 'gpt-4.1' },
  ollama: { light: 'llama3.1:8b', heavy: 'qwen2.5:32b' },
};

export function modelsFor(p: ProviderName) {
  if (p === 'none') return { light: 'template', heavy: 'template' };
  return { light: env.AI_MODEL_LIGHT || DEFAULT_MODELS[p].light, heavy: env.AI_MODEL_HEAVY || DEFAULT_MODELS[p].heavy };
}

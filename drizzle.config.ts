// drizzle-kit (studio / generate). Çalışma zamanı migrator'ı: server/db/client.ts → migrate().
import type { Config } from 'drizzle-kit';

export default {
  schema: './server/db/schema.ts',
  out: './server/db/migrations',
  dialect: 'sqlite',
  dbCredentials: { url: `${process.env.DATA_DIR ?? './data'}/atahorse.db` },
} satisfies Config;

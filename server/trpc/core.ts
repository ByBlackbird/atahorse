// tRPC çekirdeği: bağlam, hata eşleme, yetki ve hız sınırı ara katmanları.
import { initTRPC, TRPCError } from '@trpc/server';
import { ZodError } from 'zod';
import { readCookie, userFromToken, type User } from '../services/auth';
import { AppError } from '../services/courses';
import { clientIp, rateLimit, LIMITS } from '../security';

export interface Ctx {
  req: Request;
  resHeaders: Headers;
  user: User | null;
  token: string | null;
  ip: string;
}

export async function createContext({ req, resHeaders }: { req: Request; resHeaders: Headers }): Promise<Ctx> {
  const token = readCookie(req.headers.get('cookie'));
  const user = await userFromToken(token);
  return { req, resHeaders, user, token, ip: clientIp(req.headers) };
}

const STATUS = { BAD_REQUEST: 'BAD_REQUEST', FORBIDDEN: 'FORBIDDEN', NOT_FOUND: 'NOT_FOUND', CONFLICT: 'CONFLICT', TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS', PAYMENT_REQUIRED: 'PAYMENT_REQUIRED' } as const;

const t = initTRPC.context<Ctx>().create({
  errorFormatter({ shape, error }) {
    const cause = error.cause;
    const code = cause instanceof AppError ? cause.code : cause instanceof ZodError ? 'validation' : error.code === 'INTERNAL_SERVER_ERROR' ? 'e_generic' : error.message;
    return { ...shape, message: code, data: { ...shape.data, appCode: code, stack: undefined } };
  },
});

/** AppError → TRPCError (istemci message alanından i18n anahtarını okur). */
const errors = t.middleware(async ({ next }) => {
  const r = await next();
  if (!r.ok && r.error.cause instanceof AppError) {
    const c = r.error.cause;
    throw new TRPCError({ code: STATUS[c.status], message: c.code, cause: c });
  }
  return r;
});

export const router = t.router;
export const publicProcedure = t.procedure.use(errors);

export const authed = publicProcedure.use(({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED', message: 'unauthorized' });
  return next({ ctx: { ...ctx, user: ctx.user } });
});

export const adminProcedure = authed.use(({ ctx, next }) => {
  if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN', message: 'forbidden' });
  return next();
});

export const limited = (bucket: keyof typeof LIMITS) => t.middleware(({ ctx, next }) => {
  const id = (ctx as Ctx).user?.id ?? (ctx as Ctx).ip;
  const l = LIMITS[bucket];
  const r = rateLimit(`${bucket}:${id}`, l.limit, l.windowMs);
  if (!r.ok) throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: 'rate_limited' });
  return next();
});

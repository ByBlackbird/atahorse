import { createTRPCReact, httpBatchLink, type inferReactQueryProcedureOptions } from '@trpc/react-query';
import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { isPaymentError, openUpgrade } from './upgrade-bus';
import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from '../../server/trpc/router';

export const trpc = createTRPCReact<AppRouter>();
export type RouterOutputs = inferRouterOutputs<AppRouter>;
export type RouterInputs = inferRouterInputs<AppRouter>;
export type ReactQueryOptions = inferReactQueryProcedureOptions<AppRouter>;

export const queryClient = new QueryClient({
  // Premium gerektiren her hata tek yerden şık modala döner (sayfa bazında ayrı ele alma yok)
  queryCache: new QueryCache({ onError: (e) => { if (isPaymentError(e)) openUpgrade('feature'); } }),
  mutationCache: new MutationCache({ onError: (e) => { if (isPaymentError(e)) openUpgrade(e.message === 'limit_reached' ? 'limit' : 'feature'); } }),
  defaultOptions: {
    queries: {
      staleTime: 20_000,
      refetchOnWindowFocus: false,
      retry: (n, err) => n < 2 && !/unauthorized|forbidden|not_found|module_locked|limit_reached/.test((err as Error).message),
    },
  },
});

export const trpcClient = trpc.createClient({
  links: [httpBatchLink({ url: '/api/trpc', maxURLLength: 2000, fetch: (url, init) => fetch(url, { ...init, credentials: 'same-origin' }) })],
});

/** tRPC hatasından i18n anahtarı (sunucu message = uygulama kodu). */
export const errCode = (e: unknown) => (e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'e_generic');

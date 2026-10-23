import { createTRPCReact, httpBatchLink, type inferReactQueryProcedureOptions } from '@trpc/react-query';
import { QueryClient } from '@tanstack/react-query';
import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from '../../server/trpc/router';

export const trpc = createTRPCReact<AppRouter>();
export type RouterOutputs = inferRouterOutputs<AppRouter>;
export type RouterInputs = inferRouterInputs<AppRouter>;
export type ReactQueryOptions = inferReactQueryProcedureOptions<AppRouter>;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 20_000,
      refetchOnWindowFocus: false,
      retry: (n, err) => n < 2 && !/unauthorized|forbidden|not_found|module_locked/.test((err as Error).message),
    },
  },
});

export const trpcClient = trpc.createClient({
  links: [httpBatchLink({ url: '/api/trpc', maxURLLength: 2000, fetch: (url, init) => fetch(url, { ...init, credentials: 'same-origin' }) })],
});

/** tRPC hatasından i18n anahtarı (sunucu message = uygulama kodu). */
export const errCode = (e: unknown) => (e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'e_generic');

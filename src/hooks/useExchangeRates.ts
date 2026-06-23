/** 為替レートの取得・設定フック。 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { backend } from '@/data';
import { queryKeys } from '@/lib/queryClient';
import { useRequireSession } from './useSession';
import type { ExchangeRate } from '@/types/models';

export function useExchangeRates() {
  const session = useRequireSession();
  return useQuery<ExchangeRate[]>({
    queryKey: queryKeys.rates(session.pair.id),
    queryFn: () => backend.listExchangeRates(),
    staleTime: 10 * 60 * 1000,
  });
}

export function useExchangeRateActions() {
  const session = useRequireSession();
  const qc = useQueryClient();

  const upsertRate = useMutation({
    mutationFn: ({ fromCurrency, rate }: { fromCurrency: string; rate: number }) =>
      backend.upsertExchangeRate(fromCurrency, rate),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.rates(session.pair.id) }),
  });

  return { upsertRate };
}

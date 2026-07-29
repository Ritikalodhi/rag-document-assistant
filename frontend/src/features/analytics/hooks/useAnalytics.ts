import { useQuery } from '@tanstack/react-query';
import { analyticsService } from '@/services/analytics.service';

export function useAnalytics() {
  return useQuery({
    queryKey: ['analytics'],
    queryFn: () => analyticsService.get(),
    staleTime: 30_000,
  });
}

export function useServerInfo() {
  return useQuery({
    queryKey: ['server-info'],
    queryFn: () => analyticsService.getServerInfo(),
    staleTime: 60_000,
  });
}

export function useStats() {
  return useQuery({
    queryKey: ['stats'],
    queryFn: () => analyticsService.getStats(),
    staleTime: 30_000,
  });
}


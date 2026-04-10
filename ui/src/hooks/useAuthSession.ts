import { useQuery } from "@tanstack/react-query";
import { authApi } from "../api/auth";
import { queryKeys } from "../lib/queryKeys";

export function useAuthSession(enabled: boolean = true) {
  return useQuery({
    queryKey: queryKeys.auth.session,
    queryFn: () => authApi.getSession(),
    enabled,
    retry: false,
    staleTime: 30_000,
  });
}

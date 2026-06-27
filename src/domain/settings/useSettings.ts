import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { loadSettings, updateQuerySettings } from "./repository";
import type { QuerySettings } from "./types";

export const settingsQueryKey = ["settings"] as const;

export function useSettings() {
  const queryClient = useQueryClient();

  const settingsQuery = useQuery({
    queryKey: settingsQueryKey,
    queryFn: loadSettings,
  });

  const updateQuery = useMutation({
    mutationFn: (settings: Partial<QuerySettings>) => updateQuerySettings(settings),
    onSuccess: (settings) => {
      queryClient.setQueryData(settingsQueryKey, settings);
    },
  });

  return {
    settings: settingsQuery.data,
    isLoading: settingsQuery.isLoading,
    updateQuery,
  };
}

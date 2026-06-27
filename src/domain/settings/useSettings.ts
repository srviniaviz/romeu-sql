import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { loadSettings, resetSettings, updateQuerySettings, updateSettings } from "./repository";
import type { AppSettings, QuerySettings } from "./types";

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

  const update = useMutation({
    mutationFn: (settings: Partial<AppSettings>) => updateSettings(settings),
    onSuccess: (settings) => {
      queryClient.setQueryData(settingsQueryKey, settings);
    },
  });

  const reset = useMutation({
    mutationFn: resetSettings,
    onSuccess: (settings) => {
      queryClient.setQueryData(settingsQueryKey, settings);
    },
  });

  return {
    settings: settingsQuery.data,
    isLoading: settingsQuery.isLoading,
    updateQuery,
    update,
    reset,
  };
}

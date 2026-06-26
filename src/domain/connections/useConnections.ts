import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addConnection, listConnections, removeConnection, updateConnection } from "./repository";
import { Connection, NewConnection } from "./types";

export const connectionsQueryKey = ["connections"];

export function useConnections() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: connectionsQueryKey,
    queryFn: listConnections,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: connectionsQueryKey });
  };

  const addMutation = useMutation({
    mutationFn: (conn: NewConnection) => addConnection(conn),
    onSuccess: invalidate,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, conn }: { id: string; conn: Partial<Connection> }) =>
      updateConnection(id, conn),
    onSuccess: invalidate,
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => removeConnection(id),
    onSuccess: invalidate,
  });

  return {
    connections: query.data || [],
    loading: query.isLoading,
    refresh: query.refetch,
    addConnection: addMutation.mutateAsync,
    updateConnection: (id: string, conn: Partial<Connection>) =>
      updateMutation.mutateAsync({ id, conn }),
    removeConnection: removeMutation.mutateAsync,
  };
}

export type { Connection, NewConnection };

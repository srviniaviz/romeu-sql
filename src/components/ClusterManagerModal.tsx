import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Database, KeyRound, RefreshCw, Shield, Terminal, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SqlEditor } from "@/components/ui/SqlEditor";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Connection } from "@/lib/useConnections";
import {
  executeSql,
  listClusterPermissions,
  listClusterUsers,
} from "@/domain/database/service";

interface Props {
  connection: Connection | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function quoteDouble(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function adminTemplate(connection: Connection) {
  if (connection.type === "postgres") {
    return `CREATE ROLE analyst LOGIN PASSWORD 'change-me';\nGRANT CONNECT ON DATABASE ${quoteDouble(connection.database || "postgres")} TO analyst;`;
  }

  if (connection.type === "mysql") {
    return "CREATE USER 'analyst'@'%' IDENTIFIED BY 'change-me';\nGRANT SELECT ON *.* TO 'analyst'@'%';";
  }

  if (connection.type === "sqlserver") {
    return "CREATE LOGIN analyst WITH PASSWORD = 'change-me';\nCREATE USER analyst FOR LOGIN analyst;";
  }

  return "-- SQLite does not have cluster users. Use file permissions outside the database.";
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Command failed.";
}

export function ClusterManagerModal({ connection, open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [adminSql, setAdminSql] = useState("");

  const enabled = open && !!connection;
  const usersQueryKey = ["clusterUsers", connection?.id, connection?.database];
  const permissionsQueryKey = ["clusterPermissions", connection?.id, connection?.database];

  const {
    data: users = [],
    isFetching: fetchingUsers,
    error: usersError,
    refetch: refetchUsers,
  } = useQuery({
    queryKey: usersQueryKey,
    queryFn: () => listClusterUsers(connection!),
    enabled,
  });

  const {
    data: permissions = [],
    isFetching: fetchingPermissions,
    error: permissionsError,
    refetch: refetchPermissions,
  } = useQuery({
    queryKey: permissionsQueryKey,
    queryFn: () => listClusterPermissions(connection!),
    enabled,
  });

  const executeMutation = useMutation({
    mutationFn: (query: string) => executeSql(connection!, query),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: usersQueryKey });
      queryClient.invalidateQueries({ queryKey: permissionsQueryKey });
    },
  });

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return users;
    return users.filter((user) =>
      [user.name, user.role, user.canLogin ? "login" : "group", user.isAdmin ? "admin" : "user"]
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [search, users]);

  const filteredPermissions = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return permissions;
    return permissions.filter((permission) =>
      [permission.principal, permission.objectName, permission.privilege]
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [permissions, search]);

  const refreshAll = () => {
    void refetchUsers();
    void refetchPermissions();
  };

  useEffect(() => {
    if (open && connection) {
      setAdminSql(adminTemplate(connection));
    }
  }, [connection, open]);

  if (!connection) return null;

  const loading = fetchingUsers || fetchingPermissions;
  const error = usersError || permissionsError;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[86vh] gap-0 overflow-hidden rounded-lg border-border/50 bg-background p-0 text-foreground shadow-2xl sm:max-w-[920px]">
        <DialogHeader className="border-b border-border/30 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Shield size={20} />
              </div>
              <div className="min-w-0">
                <DialogTitle className="truncate text-[18px] font-semibold tracking-tight">
                  Cluster manager
                </DialogTitle>
                <DialogDescription className="truncate text-[12px] text-muted-foreground">
                  {connection.name} · {connection.host}:{connection.port} · {connection.type}
                </DialogDescription>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 rounded-md px-2 text-[12px]"
              onClick={refreshAll}
              disabled={loading}
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              Refresh
            </Button>
          </div>
        </DialogHeader>

        <Tabs defaultValue="overview" className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center justify-between gap-4 border-b border-border/25 px-6 py-3">
            <TabsList className="bg-muted/35">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="members">Users</TabsTrigger>
              <TabsTrigger value="permissions">Permissions</TabsTrigger>
              <TabsTrigger value="sql">Admin SQL</TabsTrigger>
            </TabsList>
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search users and permissions"
              className="h-8 max-w-[260px] rounded-md border-border/50 bg-background text-[12px] shadow-none"
            />
          </div>

          <div className="min-h-0 flex-1 overflow-auto px-6 py-5">
            {error && (
              <div className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-[12px] text-destructive">
                {getErrorMessage(error)}
              </div>
            )}

            <TabsContent value="overview" className="m-0 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg bg-muted/35 p-4">
                  <Database className="mb-3 text-primary" size={18} />
                  <div className="text-[11px] text-muted-foreground">Database</div>
                  <div className="mt-1 truncate text-[15px] font-semibold">{connection.database}</div>
                </div>
                <div className="rounded-lg bg-muted/35 p-4">
                  <Users className="mb-3 text-primary" size={18} />
                  <div className="text-[11px] text-muted-foreground">Known users</div>
                  <div className="mt-1 text-[15px] font-semibold">{users.length}</div>
                </div>
                <div className="rounded-lg bg-muted/35 p-4">
                  <KeyRound className="mb-3 text-primary" size={18} />
                  <div className="text-[11px] text-muted-foreground">Permission entries</div>
                  <div className="mt-1 text-[15px] font-semibold">{permissions.length}</div>
                </div>
              </div>

              <div className="rounded-lg bg-muted/25 p-4 text-[12px] leading-5 text-muted-foreground">
                Use this manager for cluster-level inspection and administrative SQL. Role creation,
                grants, revokes, and password changes still depend on the permissions of the connected database user.
              </div>
            </TabsContent>

            <TabsContent value="members" className="m-0">
              <div className="overflow-hidden rounded-lg bg-muted/25">
                <div className="grid grid-cols-[1fr_150px_90px_90px] gap-3 px-4 py-2 text-[11px] font-medium text-muted-foreground">
                  <span>User / role</span>
                  <span>Type</span>
                  <span>Login</span>
                  <span>Admin</span>
                </div>
                {filteredUsers.map((user) => (
                  <div key={`${user.name}:${user.role}`} className="grid grid-cols-[1fr_150px_90px_90px] gap-3 px-4 py-2 text-[12px]">
                    <span className="truncate font-medium">{user.name}</span>
                    <span className="truncate text-muted-foreground">{user.role}</span>
                    <span>{user.canLogin ? "Yes" : "No"}</span>
                    <span className={user.isAdmin ? "text-primary" : "text-muted-foreground"}>{user.isAdmin ? "Yes" : "No"}</span>
                  </div>
                ))}
                {!loading && filteredUsers.length === 0 && (
                  <div className="px-4 py-8 text-center text-[12px] text-muted-foreground">No users found</div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="permissions" className="m-0">
              <div className="overflow-hidden rounded-lg bg-muted/25">
                <div className="grid grid-cols-[180px_1fr_180px] gap-3 px-4 py-2 text-[11px] font-medium text-muted-foreground">
                  <span>Principal</span>
                  <span>Object</span>
                  <span>Privilege</span>
                </div>
                {filteredPermissions.map((permission, index) => (
                  <div key={`${permission.principal}:${permission.objectName}:${permission.privilege}:${index}`} className="grid grid-cols-[180px_1fr_180px] gap-3 px-4 py-2 text-[12px]">
                    <span className="truncate font-medium">{permission.principal}</span>
                    <span className="truncate text-muted-foreground">{permission.objectName}</span>
                    <span className="truncate text-primary">{permission.privilege}</span>
                  </div>
                ))}
                {!loading && filteredPermissions.length === 0 && (
                  <div className="px-4 py-8 text-center text-[12px] text-muted-foreground">No permissions found</div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="sql" className="m-0 space-y-3">
              <div className="h-[260px] overflow-hidden rounded-lg bg-muted/25">
                <SqlEditor
                  value={adminSql}
                  onChange={setAdminSql}
                  minHeight="260px"
                  completions={["CREATE ROLE", "CREATE USER", "GRANT", "REVOKE", "ALTER USER", "DROP ROLE", "DROP USER"]}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="text-[12px] text-muted-foreground">
                  {executeMutation.isError ? (
                    <span className="text-destructive">{getErrorMessage(executeMutation.error)}</span>
                  ) : executeMutation.isSuccess ? (
                    <span className="text-primary">Command executed. Lists refreshed.</span>
                  ) : (
                    "Run administrative SQL against the current connection."
                  )}
                </div>
                <Button
                  type="button"
                  className="h-8 rounded-md px-3 text-[12px]"
                  disabled={executeMutation.isPending || !adminSql.trim()}
                  onClick={() => executeMutation.mutate(adminSql.trim())}
                >
                  <Terminal size={14} />
                  Run SQL
                </Button>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}


import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  Database,
  KeyRound,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Terminal,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SqlEditor } from "@/components/ui/SqlEditor";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Connection } from "@/lib/useConnections";
import type { ClusterUserInfo } from "@/domain/database/types";
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

interface UserEditorState {
  mode: "create" | "edit";
  originalName?: string;
  username: string;
  host: string;
  password: string;
  canLogin: boolean;
  isAdmin: boolean;
  roleInfo: string;
}

function quoteDouble(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function quoteSingle(value: string) {
  return `'${value.replace(/'/g, "''")}'`;
}

function quoteSqlServerIdentifier(value: string) {
  return `[${value.replace(/]/g, "]]")}]`;
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

function buildCreateUserSql(connection: Connection, state: UserEditorState) {
  const username = state.username.trim();
  const host = state.host.trim() || "%";
  const password = state.password;

  if (connection.type === "postgres") {
    const attrs = [state.canLogin ? "LOGIN" : "NOLOGIN", state.isAdmin ? "SUPERUSER" : "NOSUPERUSER"];
    if (password) attrs.push(`PASSWORD ${quoteSingle(password)}`);
    return `CREATE ROLE ${quoteDouble(username)} WITH ${attrs.join(" ")};`;
  }

  if (connection.type === "mysql") {
    const statements = [
      `CREATE USER ${quoteSingle(username)}@${quoteSingle(host)} IDENTIFIED BY ${quoteSingle(password || "change-me")};`,
    ];
    if (state.isAdmin) {
      statements.push(`GRANT ALL PRIVILEGES ON *.* TO ${quoteSingle(username)}@${quoteSingle(host)} WITH GRANT OPTION;`);
      statements.push("FLUSH PRIVILEGES;");
    }
    return statements.join("\n");
  }

  if (connection.type === "sqlserver") {
    const statements = [
      `CREATE LOGIN ${quoteSqlServerIdentifier(username)} WITH PASSWORD = ${quoteSingle(password || "Change-me-123!")};`,
      `CREATE USER ${quoteSqlServerIdentifier(username)} FOR LOGIN ${quoteSqlServerIdentifier(username)};`,
    ];
    if (!state.canLogin) statements.push(`ALTER LOGIN ${quoteSqlServerIdentifier(username)} DISABLE;`);
    if (state.isAdmin) statements.push(`ALTER SERVER ROLE [sysadmin] ADD MEMBER ${quoteSqlServerIdentifier(username)};`);
    return statements.join("\n");
  }

  return "";
}

function buildEditUserSql(connection: Connection, state: UserEditorState) {
  const username = state.originalName || state.username.trim();
  const host = state.host.trim() || state.roleInfo || "%";

  if (connection.type === "postgres") {
    const attrs = [state.canLogin ? "LOGIN" : "NOLOGIN", state.isAdmin ? "SUPERUSER" : "NOSUPERUSER"];
    if (state.password) attrs.push(`PASSWORD ${quoteSingle(state.password)}`);
    return `ALTER ROLE ${quoteDouble(username)} WITH ${attrs.join(" ")};`;
  }

  if (connection.type === "mysql") {
    const statements = [];
    if (state.password) {
      statements.push(`ALTER USER ${quoteSingle(username)}@${quoteSingle(host)} IDENTIFIED BY ${quoteSingle(state.password)};`);
    }
    if (state.isAdmin) {
      statements.push(`GRANT ALL PRIVILEGES ON *.* TO ${quoteSingle(username)}@${quoteSingle(host)} WITH GRANT OPTION;`);
    } else {
      statements.push(`REVOKE ALL PRIVILEGES, GRANT OPTION FROM ${quoteSingle(username)}@${quoteSingle(host)};`);
    }
    statements.push("FLUSH PRIVILEGES;");
    return statements.join("\n");
  }

  if (connection.type === "sqlserver") {
    const statements = [state.canLogin
      ? `ALTER LOGIN ${quoteSqlServerIdentifier(username)} ENABLE;`
      : `ALTER LOGIN ${quoteSqlServerIdentifier(username)} DISABLE;`];
    if (state.password) {
      statements.push(`ALTER LOGIN ${quoteSqlServerIdentifier(username)} WITH PASSWORD = ${quoteSingle(state.password)};`);
    }
    statements.push(state.isAdmin
      ? `ALTER SERVER ROLE [sysadmin] ADD MEMBER ${quoteSqlServerIdentifier(username)};`
      : `ALTER SERVER ROLE [sysadmin] DROP MEMBER ${quoteSqlServerIdentifier(username)};`);
    return statements.join("\n");
  }

  return "";
}

function buildUserEditorSql(connection: Connection, state: UserEditorState) {
  return state.mode === "create"
    ? buildCreateUserSql(connection, state)
    : buildEditUserSql(connection, state);
}

function userEditorFromUser(user: ClusterUserInfo): UserEditorState {
  return {
    mode: "edit",
    originalName: user.name,
    username: user.name,
    host: user.role,
    password: "",
    canLogin: user.canLogin,
    isAdmin: user.isAdmin,
    roleInfo: user.role,
  };
}

function newUserEditor(): UserEditorState {
  return {
    mode: "create",
    username: "",
    host: "%",
    password: "",
    canLogin: true,
    isAdmin: false,
    roleInfo: "%",
  };
}

function clampPage(page: number, totalPages: number) {
  return Math.min(Math.max(page, 1), Math.max(totalPages, 1));
}

function pageBounds(page: number, pageSize: number, total: number) {
  if (total === 0) return "0 - 0 of 0";
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  return `${start} - ${end} of ${total}`;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Command failed.";
}

export function ClusterManagerModal({ connection, open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");
  const [search, setSearch] = useState("");
  const [adminSql, setAdminSql] = useState("");
  const [usersPage, setUsersPage] = useState(1);
  const [permissionsPage, setPermissionsPage] = useState(1);
  const [usersPageSize, setUsersPageSize] = useState(10);
  const [permissionsPageSize, setPermissionsPageSize] = useState(12);
  const [userEditor, setUserEditor] = useState<UserEditorState | null>(null);

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

  const userMutation = useMutation({
    mutationFn: (state: UserEditorState) => {
      if (!connection) throw new Error("No active connection.");
      const query = buildUserEditorSql(connection, state);
      if (!query.trim()) {
        throw new Error("User management is not supported for this connection type.");
      }
      return executeSql(connection, query);
    },
    onSuccess: () => {
      setUserEditor(null);
      queryClient.invalidateQueries({ queryKey: usersQueryKey });
      queryClient.invalidateQueries({ queryKey: permissionsQueryKey });
    },
  });

  const loginUsers = useMemo(() => users.filter((user) => user.canLogin), [users]);

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return loginUsers;
    return loginUsers.filter((user) =>
      [user.name, user.role, user.canLogin ? "login" : "group", user.isAdmin ? "admin" : "user"]
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [loginUsers, search]);

  const filteredPermissions = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return permissions;
    return permissions.filter((permission) =>
      [permission.principal, permission.objectName, permission.privilege]
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [permissions, search]);

  const usersTotalPages = Math.max(1, Math.ceil(filteredUsers.length / usersPageSize));
  const permissionsTotalPages = Math.max(1, Math.ceil(filteredPermissions.length / permissionsPageSize));
  const safeUsersPage = clampPage(usersPage, usersTotalPages);
  const safePermissionsPage = clampPage(permissionsPage, permissionsTotalPages);
  const pagedUsers = filteredUsers.slice(
    (safeUsersPage - 1) * usersPageSize,
    safeUsersPage * usersPageSize
  );
  const pagedPermissions = filteredPermissions.slice(
    (safePermissionsPage - 1) * permissionsPageSize,
    safePermissionsPage * permissionsPageSize
  );

  const refreshAll = () => {
    void refetchUsers();
    void refetchPermissions();
  };

  const startNewUser = () => {
    setUserEditor(newUserEditor());
  };

  const startEditUser = (user: ClusterUserInfo) => {
    setUserEditor(userEditorFromUser(user));
  };

  useEffect(() => {
    if (open && connection) {
      setAdminSql(adminTemplate(connection));
    }
  }, [connection, open]);

  useEffect(() => {
    setUsersPage(1);
    setPermissionsPage(1);
  }, [search, activeTab]);

  if (!connection) return null;

  const loading = fetchingUsers || fetchingPermissions;
  const error = usersError || permissionsError;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="max-h-[86vh] gap-0 overflow-hidden rounded-lg border-border/50 bg-background p-0 text-foreground shadow-2xl sm:max-w-[920px]">
        <DialogHeader className="border-b border-border/30 px-6 py-5 pr-24">
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
            <div className="absolute right-4 top-4 flex items-center rounded-md bg-muted/25 p-0.5">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="size-7 rounded-[5px] text-muted-foreground hover:bg-background hover:text-foreground"
                onClick={refreshAll}
                disabled={loading}
                title="Refresh users and permissions"
              >
                <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                <span className="sr-only">Refresh users and permissions</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="size-7 rounded-[5px] text-muted-foreground hover:bg-background hover:text-foreground"
                onClick={() => onOpenChange(false)}
                title="Close"
              >
                <X size={14} />
                <span className="sr-only">Close</span>
              </Button>
            </div>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center justify-between gap-4 border-b border-border/25 px-6 py-3">
            <TabsList className="bg-muted/35">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="members">Users {loginUsers.length > 0 && <span className="rounded bg-muted px-1 text-[11px]">{loginUsers.length}</span>}</TabsTrigger>
              <TabsTrigger value="permissions">Permissions {permissions.length > 0 && <span className="rounded bg-muted px-1 text-[11px]">{permissions.length}</span>}</TabsTrigger>
              <TabsTrigger value="sql">Admin SQL</TabsTrigger>
            </TabsList>
            <div className="relative w-[300px] max-w-[40vw]">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/60" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={activeTab === "permissions" ? "Search principal, object, privilege" : "Search user, role, admin"}
                className="h-8 rounded-md border-border/50 bg-background pl-8 text-[12px] shadow-none"
              />
            </div>
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
                  <div className="text-[11px] text-muted-foreground">Login users</div>
                  <div className="mt-1 text-[15px] font-semibold">{loginUsers.length}</div>
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
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="text-[12px] text-muted-foreground">
                  {filteredUsers.length} login users
                </div>
                <Button type="button" size="sm" className="h-8 rounded-md text-[12px]" onClick={startNewUser}>
                  <Plus size={14} />
                  New user
                </Button>
              </div>
              <div className="overflow-hidden rounded-lg bg-muted/20">
                <div className="grid grid-cols-[minmax(160px,1fr)_150px_90px_90px_80px] gap-3 px-4 py-2 text-[11px] font-medium text-muted-foreground">
                  <span>User / role</span>
                  <span>Type</span>
                  <span>Login</span>
                  <span>Admin</span>
                  <span className="text-right">Actions</span>
                </div>
                {pagedUsers.map((user) => (
                  <div key={`${user.name}:${user.role}`} className="group grid grid-cols-[minmax(160px,1fr)_150px_90px_90px_80px] items-center gap-3 px-4 py-2 text-[12px] transition-colors hover:bg-muted/35">
                    <span className="truncate font-medium">{user.name}</span>
                    <span className="truncate text-muted-foreground">{user.role}</span>
                    <span>{user.canLogin ? "Yes" : "No"}</span>
                    <span className={user.isAdmin ? "text-primary" : "text-muted-foreground"}>{user.isAdmin ? "Yes" : "No"}</span>
                    <span className="flex justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        className="opacity-70 hover:opacity-100"
                        title={`Edit ${user.name}`}
                        onClick={() => startEditUser(user)}
                      >
                        <Pencil size={13} />
                      </Button>
                    </span>
                  </div>
                ))}
                {!loading && pagedUsers.length === 0 && (
                  <div className="px-4 py-8 text-center text-[12px] text-muted-foreground">No users found</div>
                )}
              </div>
              <div className="mt-3 flex items-center justify-between">
                <PageSizeSelect value={usersPageSize} onChange={setUsersPageSize} />
                <Pager
                  page={safeUsersPage}
                  totalPages={usersTotalPages}
                  label={pageBounds(safeUsersPage, usersPageSize, filteredUsers.length)}
                  onPageChange={setUsersPage}
                />
              </div>
            </TabsContent>

            <TabsContent value="permissions" className="m-0">
              <div className="mb-3 text-[12px] text-muted-foreground">
                {filteredPermissions.length} permission entries
              </div>
              <div className="overflow-hidden rounded-lg bg-muted/20">
                <div className="grid grid-cols-[180px_1fr_180px] gap-3 px-4 py-2 text-[11px] font-medium text-muted-foreground">
                  <span>Principal</span>
                  <span>Object</span>
                  <span>Privilege</span>
                </div>
                {pagedPermissions.map((permission, index) => (
                  <div key={`${permission.principal}:${permission.objectName}:${permission.privilege}:${index}`} className="grid grid-cols-[180px_1fr_180px] gap-3 px-4 py-2 text-[12px] transition-colors hover:bg-muted/35">
                    <span className="truncate font-medium">{permission.principal}</span>
                    <span className="truncate text-muted-foreground">{permission.objectName}</span>
                    <span className="truncate text-primary">{permission.privilege}</span>
                  </div>
                ))}
                {!loading && pagedPermissions.length === 0 && (
                  <div className="px-4 py-8 text-center text-[12px] text-muted-foreground">No permissions found</div>
                )}
              </div>
              <div className="mt-3 flex items-center justify-between">
                <PageSizeSelect value={permissionsPageSize} onChange={setPermissionsPageSize} />
                <Pager
                  page={safePermissionsPage}
                  totalPages={permissionsTotalPages}
                  label={pageBounds(safePermissionsPage, permissionsPageSize, filteredPermissions.length)}
                  onPageChange={setPermissionsPage}
                />
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
        <UserEditorDialog
          connection={connection}
          state={userEditor}
          loading={userMutation.isPending}
          error={userMutation.isError ? getErrorMessage(userMutation.error) : ""}
          onChange={setUserEditor}
          onClose={() => setUserEditor(null)}
          onSave={(next) => userMutation.mutate(next)}
        />
      </DialogContent>
    </Dialog>
  );
}

function UserEditorDialog({
  connection,
  state,
  loading,
  error,
  onChange,
  onClose,
  onSave,
}: {
  connection: Connection;
  state: UserEditorState | null;
  loading: boolean;
  error: string;
  onChange: (state: UserEditorState | null) => void;
  onClose: () => void;
  onSave: (state: UserEditorState) => void;
}) {
  if (!state) return null;

  const isCreate = state.mode === "create";
  const supportsLoginToggle = connection.type === "postgres" || connection.type === "sqlserver";
  const supportsAdminToggle = connection.type !== "sqlite";
  const supportsHost = connection.type === "mysql";
  const saveDisabled = loading || !state.username.trim();

  const update = (patch: Partial<UserEditorState>) => {
    onChange({ ...state, ...patch });
  };

  return (
    <Dialog open onOpenChange={(nextOpen) => {
      if (!nextOpen) onClose();
    }}>
      <DialogContent className="w-[520px] gap-0 overflow-hidden rounded-lg border-border/50 p-0 shadow-2xl">
        <DialogHeader className="border-b border-border/30 px-5 py-4">
          <DialogTitle className="text-[16px] font-semibold">
            {isCreate ? "New cluster user" : `Edit ${state.originalName}`}
          </DialogTitle>
          <DialogDescription className="text-[12px]">
            {connection.name} · {connection.type}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-5 py-4">
          {error && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-[12px] text-destructive">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>User name</Label>
              <Input
                value={state.username}
                disabled={!isCreate}
                onChange={(event) => update({ username: event.target.value })}
                placeholder="analyst"
                className="h-9 rounded-md border-border/60 text-[13px]"
              />
            </div>

            {supportsHost ? (
              <div className="space-y-2">
                <Label>Host</Label>
                <Input
                  value={state.host}
                  disabled={!isCreate}
                  onChange={(event) => update({ host: event.target.value })}
                  placeholder="%"
                  className="h-9 rounded-md border-border/60 text-[13px]"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Role type</Label>
                <Input
                  value={state.roleInfo}
                  disabled
                  className="h-9 rounded-md border-border/60 text-[13px]"
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>{isCreate ? "Password" : "New password"}</Label>
            <Input
              type="password"
              value={state.password}
              onChange={(event) => update({ password: event.target.value })}
              placeholder={isCreate ? "Set initial password" : "Leave empty to keep current password"}
              className="h-9 rounded-md border-border/60 text-[13px]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-start gap-3 rounded-lg bg-muted/25 p-3 text-[12px]">
              <Checkbox
                checked={state.canLogin}
                disabled={!supportsLoginToggle}
                onCheckedChange={(checked) => update({ canLogin: checked === true })}
              />
              <span className="space-y-1">
                <span className="block font-medium text-foreground">Can login</span>
                <span className="block text-muted-foreground">
                  {supportsLoginToggle ? "Allow direct database login." : "This engine reports login access automatically."}
                </span>
              </span>
            </label>

            <label className="flex items-start gap-3 rounded-lg bg-muted/25 p-3 text-[12px]">
              <Checkbox
                checked={state.isAdmin}
                disabled={!supportsAdminToggle}
                onCheckedChange={(checked) => update({ isAdmin: checked === true })}
              />
              <span className="space-y-1">
                <span className="block font-medium text-foreground">Admin</span>
                <span className="block text-muted-foreground">
                  {connection.type === "postgres" && "Maps to SUPERUSER."}
                  {connection.type === "mysql" && "Grants all privileges with grant option."}
                  {connection.type === "sqlserver" && "Maps to sysadmin server role."}
                  {connection.type === "sqlite" && "SQLite uses file permissions."}
                </span>
              </span>
            </label>
          </div>

          {!isCreate && connection.type === "mysql" && !state.password && !state.isAdmin && (
            <div className="rounded-md bg-muted/35 px-3 py-2 text-[12px] text-muted-foreground">
              For MySQL, saving without a password or admin change may only revoke broad privileges.
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-border/30 px-5 py-4">
          <Button type="button" variant="ghost" className="h-8 rounded-md text-[12px]" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            className="h-8 rounded-md text-[12px]"
            disabled={saveDisabled}
            onClick={() => onSave(state)}
          >
            {loading ? "Saving..." : isCreate ? "Create user" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PageSizeSelect({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
      <span>Rows</span>
      <Select value={String(value)} onValueChange={(next) => onChange(Number(next))}>
        <SelectTrigger className="h-8 w-[76px] rounded-md border-border/50 bg-background text-[12px] shadow-none">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {[10, 25, 50, 100].map((size) => (
            <SelectItem key={size} value={String(size)}>
              {size}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function Pager({
  page,
  totalPages,
  label,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  label: string;
  onPageChange: (page: number) => void;
}) {
  return (
    <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
      <span>{label}</span>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        title="Previous page"
      >
        <ChevronLeft size={14} />
      </Button>
      <span className="min-w-14 text-center">
        {page} / {totalPages}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        title="Next page"
      >
        <ChevronRight size={14} />
      </Button>
    </div>
  );
}


import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import * as z from "zod";
import { cn } from "@/lib/utils";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Database,
  User,
  Lock,
  RefreshCw,
  Globe,
  FileCode,
  FolderOpen,
  Check,
  AlertCircle
} from "lucide-react";
import SqlDatabase from "@tauri-apps/plugin-sql";

/**
 * Define the schema for connection settings.
 * Mirrored after pgAdmin's extensive configuration options.
 */
const connectionSchema = z.object({
  // General Tab
  name: z.string().min(1, "Name is required"),
  group: z.string().optional(),
  comment: z.string().optional(),
  
  // Connection Tab
  connectionUrl: z.string().optional(),
  type: z.enum(["postgres", "mysql", "sqlite", "sqlserver"]),
  host: z.string().min(1, "Host is required"),
  port: z.string().regex(/^\d+$/, "Must be a number"),
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
  database: z.string().min(1, "Database is required"),
  savePassword: z.boolean(),
  role: z.string().optional(),
  sslMode: z.enum(["disable", "allow", "prefer", "require", "verify-ca", "verify-full"]),

  // SSL Tab
  sslRootCert: z.string().optional(),
  sslCert: z.string().optional(),
  sslKey: z.string().optional(),
  sslCrl: z.string().optional(),

  // SSH Tunnel Tab
  sshEnabled: z.boolean(),
  sshHost: z.string().optional(),
  sshPort: z.string().optional(),
  sshUser: z.string().optional(),
  sshAuthMethod: z.enum(["password", "key"]),
  sshPassword: z.string().optional(),
  sshIdentityFile: z.string().optional(),

  // Parameters Tab
  clientEncoding: z.string().optional(),
  appName: z.string().optional(),
  connectTimeout: z.string()
});

/**
 * Infer form values from the zod schema.
 * Using a partial or mapping specifically if needed, but infer is usually correct.
 */
type ConnectionFormValues = z.infer<typeof connectionSchema>;

import { useConnections, Connection } from "../lib/useConnections";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  connectionToEdit?: Connection | null;
}

export function CreateConnectionModal({ isOpen, onClose, connectionToEdit }: Props) {
  const { t } = useTranslation();
  const { addConnection, updateConnection } = useConnections();
  
  const { register, handleSubmit, control, watch, setValue, reset, formState: { isSubmitting, errors } } = useForm<ConnectionFormValues>({
    resolver: zodResolver(connectionSchema),
    defaultValues: { 
      type: "postgres", 
      host: "localhost", 
      port: "5432",
      savePassword: true,
      sslMode: "disable",
      sshEnabled: false,
      sshAuthMethod: "password",
      connectTimeout: "10"
    }
  });

  // Handle Edit Mode Reset
  useEffect(() => {
    if (connectionToEdit && isOpen) {
      reset({
        name: connectionToEdit.name,
        type: connectionToEdit.type as any,
        host: connectionToEdit.host,
        port: connectionToEdit.port,
        database: connectionToEdit.database,
        username: connectionToEdit.username,
        password: connectionToEdit.password || "",
        group: connectionToEdit.group || "Default",
        savePassword: true,
        sshEnabled: false,
        sshAuthMethod: "password",
        sslMode: "disable",
      });
    } else if (isOpen) {
      reset({
        name: "",
        type: "postgres",
        host: "localhost",
        port: "5432",
        database: "",
        username: "",
        password: "",
        savePassword: true,
        sshEnabled: false,
        sshAuthMethod: "password",
        sslMode: "disable",
      });
    }
  }, [connectionToEdit, reset, isOpen]);

  const sshEnabled = watch("sshEnabled");
  const sshAuthMethod = watch("sshAuthMethod");
  const connectionUrl = watch("connectionUrl");

  // Magic URL Parser
  useEffect(() => {
    if (!connectionUrl) return;

    try {
      const url = new URL(connectionUrl);
      
      // Map protocol to type
      const protocol = url.protocol.replace(':', '');
      if (['postgres', 'postgresql'].includes(protocol)) setValue('type', 'postgres');
      else if (['mysql', 'mariadb'].includes(protocol)) setValue('type', 'mysql');
      else if (['sqlite'].includes(protocol)) setValue('type', 'sqlite');
      else if (['sqlserver', 'mssql', 'sqlserver'].includes(protocol)) setValue('type', 'sqlserver');

      if (url.hostname) setValue('host', url.hostname);
      if (url.port) setValue('port', url.port);
      if (url.username) setValue('username', decodeURIComponent(url.username));
      if (url.password) setValue('password', decodeURIComponent(url.password));
      
      // Handle database name (path)
      const dbName = url.pathname.replace('/', '');
      if (dbName) setValue('database', dbName);

    } catch (e) {
      // Not a valid URL yet, skip
    }
  }, [connectionUrl, setValue]);

  const [testingStatus, setTestingStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testError, setTestError] = useState<string | null>(null);

  const testConnection = async () => {
    const data = watch();
    setTestingStatus('testing');
    setTestError(null);

    try {
      // Construct connection string for testing
      let connectionString = "";
      if (data.type === 'postgres') {
        connectionString = `postgres://${data.username}:${data.password}@${data.host}:${data.port}/${data.database}`;
      } else if (data.type === 'mysql') {
        connectionString = `mysql://${data.username}:${data.password}@${data.host}:${data.port}/${data.database}`;
      } else if (data.type === 'sqlite') {
        connectionString = `sqlite:${data.host}`;
      } else if (data.type === 'sqlserver') {
        connectionString = `sqlserver://${data.host}:${data.port};database=${data.database};user=${data.username};password=${data.password}`;
      }

      const db = await SqlDatabase.load(connectionString);
      await db.close();
      setTestingStatus('success');
      setTimeout(() => setTestingStatus('idle'), 3000);
    } catch (err: any) {
      console.error("Connection test failed:", err);
      setTestingStatus('error');
      setTestError(err.message || "Failed to connect");
      setTimeout(() => setTestingStatus('idle'), 5000);
    }
  };

  const onSubmit = async (data: ConnectionFormValues) => {
    try {
      if (connectionToEdit) {
        await updateConnection(connectionToEdit.id, data);
      } else {
        await addConnection(data);
      }
      onClose();
    } catch (error) {
      console.error("Failed to save connection:", error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[720px] gap-0 p-0 overflow-hidden border-none shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] ring-1 ring-white/10 bg-zinc-950/95 backdrop-blur-xl">
        <DialogHeader className="p-8 pb-2">
          <div className="flex items-center gap-4">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg">
              <Database className="size-5" />
            </div>
            <div className="grid gap-0.5">
              <DialogTitle className="text-2xl font-black tracking-tight uppercase italic">{t('modal.new_connection')}</DialogTitle>
              <DialogDescription className="text-[10px] font-bold uppercase tracking-widest opacity-40">{t('modal.init_node')}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <Tabs defaultValue="general" className="w-full">
            <div className="px-8 py-2">
              <TabsList className="grid w-full grid-cols-5 h-12 p-1.5 bg-muted/30 rounded-xl">
                <TabsTrigger value="general" className="text-[11px] font-black uppercase tracking-[0.15em] rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-md transition-all">
                  {t('modal.tabs.general')}
                </TabsTrigger>
                <TabsTrigger value="connection" className="text-[11px] font-black uppercase tracking-[0.15em] rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-md transition-all">
                  {t('modal.tabs.connection')}
                </TabsTrigger>
                <TabsTrigger value="ssl" className="text-[11px] font-black uppercase tracking-[0.15em] rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-md transition-all">
                  {t('modal.tabs.ssl')}
                </TabsTrigger>
                <TabsTrigger value="ssh" className="text-[11px] font-black uppercase tracking-[0.15em] rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-md transition-all">
                  {t('modal.tabs.ssh_tunnel')}
                </TabsTrigger>
                <TabsTrigger value="params" className="text-[11px] font-black uppercase tracking-[0.15em] rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-md transition-all">
                  {t('modal.tabs.parameters')}
                </TabsTrigger>
              </TabsList>
            </div>

            <ScrollArea className="h-[480px]">
              <div className="p-10 pb-16">
                <TabsContent value="general" className="space-y-6 mt-0">
                  <div className="grid gap-4">
                    <div className="space-y-2">
                      <Label className={cn("text-[11px] uppercase tracking-widest font-black opacity-60", errors.name && "text-red-500 opacity-100")}>
                        {t('modal.general.name')}
                      </Label>
                      <Input 
                        {...register("name")} 
                        placeholder="My Primary DB" 
                        className={cn(errors.name && "border-red-500/50 focus-visible:ring-red-500/20")}
                      />
                      {errors.name && <p className="text-[9px] font-bold text-red-500 uppercase tracking-tighter italic">{errors.name.message}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] uppercase tracking-widest font-black opacity-60">{t('modal.general.group')}</Label>
                      <Input {...register("group")} placeholder="Production" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] uppercase tracking-widest font-black opacity-60">{t('modal.general.comment')}</Label>
                      <Textarea {...register("comment")} placeholder="Add notes here..." className="min-h-[140px] bg-muted/20 border-border/10 focus-visible:ring-1" />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="connection" className="space-y-6 mt-0">
                  <div className="grid gap-5">
                    {/* Magic URL Field */}
                    <div className="space-y-2 p-4 rounded-xl bg-primary/5 border border-primary/10">
                      <div className="flex items-center gap-2 mb-1">
                        <RefreshCw size={14} className="text-primary opacity-60" />
                        <Label className="text-[11px] uppercase tracking-widest font-black text-primary">{t('modal.connection.magic_url')}</Label>
                      </div>
                      <Input 
                        {...register("connectionUrl")} 
                        placeholder="postgresql://user:password@localhost:5432/database" 
                        className="bg-background/80 border-primary/10 focus-visible:ring-primary/20"
                      />
                      <p className="text-[9px] font-bold text-muted-foreground/40 uppercase tracking-tighter italic">Pasting a URL will automatically fill all fields below</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-[11px] uppercase tracking-widest font-black opacity-60">{t('modal.engine')}</Label>
                        <Controller
                          name="type"
                          control={control}
                          render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value}>
                              <SelectTrigger className="w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="postgres">PostgreSQL</SelectItem>
                                <SelectItem value="mysql">MySQL</SelectItem>
                                <SelectItem value="sqlite">SQLite</SelectItem>
                                <SelectItem value="sqlserver">SQL Server</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] uppercase tracking-widest font-black opacity-60">{t('modal.connection.ssl_mode')}</Label>
                        <Controller
                          name="sslMode"
                          control={control}
                          render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value}>
                              <SelectTrigger className="w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="disable">Disable</SelectItem>
                                <SelectItem value="allow">Allow</SelectItem>
                                <SelectItem value="prefer">Prefer</SelectItem>
                                <SelectItem value="require">Require</SelectItem>
                                <SelectItem value="verify-ca">Verify-CA</SelectItem>
                                <SelectItem value="verify-full">Verify-Full</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-12 gap-4">
                      <div className="col-span-10 space-y-2">
                        <Label className={cn("text-[10px] uppercase tracking-widest font-black opacity-60", errors.host && "text-red-500 opacity-100")}>
                          {t('modal.connection.host')}
                        </Label>
                        <div className="relative group">
                          <Globe className={cn("absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/40 group-focus-within:text-primary transition-colors", errors.host && "text-red-500") } />
                          <Input 
                            {...register("host")} 
                            className={cn("pl-9", errors.host && "border-red-500/50 focus-visible:ring-red-500/20")} 
                          />
                        </div>
                        {errors.host && <p className="text-[9px] font-bold text-red-500 uppercase tracking-tighter italic">{errors.host.message}</p>}
                      </div>
                      <div className="col-span-2 space-y-2">
                        <Label className={cn("text-[10px] uppercase tracking-widest font-black opacity-60", errors.port && "text-red-500 opacity-100")}>
                          {t('modal.connection.port')}
                        </Label>
                        <Input 
                          {...register("port")} 
                          className={cn("text-center font-bold", errors.port && "border-red-500/50 focus-visible:ring-red-500/20")} 
                        />
                        {errors.port && <p className="text-[9px] font-bold text-red-500 uppercase tracking-tighter italic">{errors.port.message}</p>}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className={cn("text-[10px] uppercase tracking-widest font-black opacity-60", errors.database && "text-red-500 opacity-100")}>
                        {t('modal.connection.database')}
                      </Label>
                      <div className="relative group">
                        <Database className={cn("absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/40 group-focus-within:text-primary transition-colors", errors.database && "text-red-500")} />
                        <Input 
                          {...register("database")} 
                          className={cn("pl-9", errors.database && "border-red-500/50 focus-visible:ring-red-500/20")} 
                        />
                      </div>
                      {errors.database && <p className="text-[9px] font-bold text-red-500 uppercase tracking-tighter italic">{errors.database.message}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className={cn("text-[10px] uppercase tracking-widest font-black opacity-60", errors.username && "text-red-500 opacity-100")}>
                          {t('modal.connection.user')}
                        </Label>
                        <div className="relative group">
                          <User className={cn("absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/40 group-focus-within:text-primary transition-colors", errors.username && "text-red-500")} />
                          <Input 
                            {...register("username")} 
                            className={cn("pl-9", errors.username && "border-red-500/50 focus-visible:ring-red-500/20")} 
                          />
                        </div>
                        {errors.username && <p className="text-[9px] font-bold text-red-500 uppercase tracking-tighter italic">{errors.username.message}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label className={cn("text-[10px] uppercase tracking-widest font-black opacity-60", errors.password && "text-red-500 opacity-100")}>
                          {t('modal.connection.password')}
                        </Label>
                        <div className="relative group">
                          <Lock className={cn("absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/40 group-focus-within:text-primary transition-colors", errors.password && "text-red-500")} />
                          <Input 
                            {...register("password")} 
                            type="password" 
                            className={cn("pl-9", errors.password && "border-red-500/50 focus-visible:ring-red-500/20")} 
                          />
                        </div>
                        {errors.password && <p className="text-[9px] font-bold text-red-500 uppercase tracking-tighter italic">{errors.password.message}</p>}
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 pt-2">
                      <Controller
                        name="savePassword"
                        control={control}
                        render={({ field }) => (
                          <Checkbox 
                            id="savePass" 
                            checked={field.value} 
                            onCheckedChange={field.onChange}
                          />
                        )}
                      />
                      <Label htmlFor="savePass" className="text-xs font-bold tracking-tight cursor-pointer">{t('modal.connection.save_password')}</Label>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="ssl" className="space-y-6 mt-0">
                  <div className="grid gap-5">
                    {['sslRootCert', 'sslCert', 'sslKey', 'sslCrl'].map((cert) => (
                      <div key={cert} className="space-y-2">
                        <Label className="text-[10px] uppercase tracking-widest font-black opacity-60">{t(`modal.ssl.${cert.replace('ssl', '').toLowerCase()}`)}</Label>
                        <div className="flex gap-2">
                          <div className="relative flex-1 group">
                            <FileCode className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/40 group-focus-within:text-primary transition-colors" />
                            <Input {...register(cert as any)} className="pl-9" placeholder="/path/to/identity.key" />
                          </div>
                          <Button type="button" variant="secondary" size="sm" className="h-9 px-4 font-bold text-[10px] uppercase tracking-widest">
                            <FolderOpen size={14} className="mr-2 opacity-60" />Browse
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="ssh" className="space-y-6 mt-0">
                  <div className="space-y-5">
                    <div className="flex items-center justify-between p-5 rounded-xl bg-muted/20 border border-border/10">
                      <div className="space-y-0.5">
                        <Label className="text-sm font-bold">{t('modal.ssh.use_tunnel')}</Label>
                        <p className="text-[10px] text-muted-foreground opacity-60 uppercase tracking-widest font-semibold italic">Connect via Bastion Host</p>
                      </div>
                      <Controller
                        name="sshEnabled"
                        control={control}
                        render={({ field }) => (
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        )}
                      />
                    </div>

                    {sshEnabled && (
                      <div className="grid gap-5 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="grid grid-cols-12 gap-4">
                          <div className="col-span-10 space-y-2">
                            <Label className="text-[10px] uppercase tracking-widest font-black opacity-60">{t('modal.ssh.host')}</Label>
                            <Input {...register("sshHost")} />
                          </div>
                          <div className="col-span-2 space-y-2">
                            <Label className="text-[10px] uppercase tracking-widest font-black opacity-60">{t('modal.ssh.port')}</Label>
                            <Input {...register("sshPort")} placeholder="22" className="text-center font-bold" />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-[10px] uppercase tracking-widest font-black opacity-60">{t('modal.ssh.user')}</Label>
                            <Input {...register("sshUser")} />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[10px] uppercase tracking-widest font-black opacity-60">{t('modal.ssh.auth_method')}</Label>
                            <Controller
                              name="sshAuthMethod"
                              control={control}
                              render={({ field }) => (
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="password">Password</SelectItem>
                                    <SelectItem value="key">Identity File</SelectItem>
                                  </SelectContent>
                                </Select>
                              )}
                            />
                          </div>
                        </div>

                        {sshAuthMethod === "password" ? (
                          <div className="space-y-2">
                            <Label className="text-[10px] uppercase tracking-widest font-black opacity-60">{t('modal.ssh.password')}</Label>
                            <Input {...register("sshPassword")} type="password" />
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <Label className="text-[10px] uppercase tracking-widest font-black opacity-60">{t('modal.ssh.identity_file')}</Label>
                            <div className="flex gap-2">
                              <Input {...register("sshIdentityFile")} placeholder="/path/to/key" className="flex-1" />
                              <Button type="button" variant="secondary" size="sm" className="h-9 font-bold text-[10px] uppercase tracking-widest">
                                <FolderOpen size={14} className="mr-2 opacity-60" />Browse
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="params" className="space-y-6 mt-0">
                  <div className="grid gap-5">
                    <div className="space-y-2">
                      <Label className="text-[10px] uppercase tracking-widest font-black opacity-60">{t('modal.params.encoding')}</Label>
                      <Controller
                        name="clientEncoding"
                        control={control}
                        render={({ field }) => (
                          <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger>
                              <SelectValue placeholder="AUTO" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="UTF8">UTF8</SelectItem>
                              <SelectItem value="SQL_ASCII">SQL_ASCII</SelectItem>
                              <SelectItem value="LATIN1">LATIN1</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] uppercase tracking-widest font-black opacity-60">{t('modal.params.app_name')}</Label>
                      <Input {...register("appName")} placeholder="Romeu SQL Client" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] uppercase tracking-widest font-black opacity-60">{t('modal.params.timeout')}</Label>
                      <Input {...register("connectTimeout")} type="number" />
                    </div>
                  </div>
                </TabsContent>
              </div>
            </ScrollArea>

            <DialogFooter className="px-10 pb-10 pt-4 flex items-center justify-between w-full">
              <div className="flex items-center gap-3">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={testConnection}
                  disabled={testingStatus === 'testing' || isSubmitting}
                  className={cn(
                    "h-11 px-6 font-black uppercase tracking-[0.15em] text-[10px] transition-all",
                    testingStatus === 'success' && "border-green-500/50 text-green-500 bg-green-500/5",
                    testingStatus === 'error' && "border-red-500/50 text-red-500 bg-red-500/5"
                  )}
                >
                  {testingStatus === 'testing' ? (
                    <RefreshCw className="mr-2 size-3 animate-spin" />
                  ) : testingStatus === 'success' ? (
                    <Check className="mr-2 size-3" />
                  ) : testingStatus === 'error' ? (
                    <AlertCircle className="mr-2 size-3" />
                  ) : null}
                  {testingStatus === 'success' ? t('common.success') : testingStatus === 'error' ? t('common.error') : t('modal.test_connection')}
                </Button>
                {testError && (
                  <p className="text-[10px] font-bold text-red-500/60 uppercase tracking-tighter animate-in fade-in slide-in-from-left-2">
                    {testError}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-3">
                <Button type="button" variant="ghost" onClick={onClose} className="h-11 px-6 font-bold uppercase tracking-widest text-[11px] opacity-40 hover:opacity-100 hover:bg-white/5 transition-all">
                  {t('common.cancel')}
                </Button>
                <Button type="submit" disabled={isSubmitting} className="h-11 px-12 font-bold uppercase tracking-widest text-[11px] bg-white text-black hover:bg-white/90 shadow-xl shadow-white/5 transition-all active:scale-[0.98]">
                  {isSubmitting ? <RefreshCw className="mr-2 size-3 animate-spin" /> : null}
                  {t('modal.connect')}
                </Button>
              </div>
            </DialogFooter>
          </Tabs>
        </form>
      </DialogContent>
    </Dialog>
  );
}

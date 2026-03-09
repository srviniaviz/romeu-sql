import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import * as z from "zod";
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
import { 
  Database,
  Server,
  User,
  Lock,
  RefreshCw
} from "lucide-react";

const connectionSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(["postgres", "mysql", "sqlite", "sqlserver"]),
  host: z.string().min(1, "Host is required"),
  port: z.string().regex(/^\d+$/, "Must be a number"),
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
  database: z.string().min(1, "Database is required"),
});

type ConnectionFormValues = z.infer<typeof connectionSchema>;

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateConnectionModal({ isOpen, onClose }: Props) {
  const { t } = useTranslation();
  
  const { register, handleSubmit, control, formState: { errors, isSubmitting } } = useForm<ConnectionFormValues>({
    resolver: zodResolver(connectionSchema),
    defaultValues: { type: "postgres", host: "localhost", port: "5432" }
  });

  const onSubmit = async (data: ConnectionFormValues) => {
    await new Promise(r => setTimeout(r, 1000));
    console.log("Saving Connection:", data);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Database className="size-5" />
            </div>
            <div className="grid gap-0.5 text-left">
              <DialogTitle>{t('modal.new_connection')}</DialogTitle>
              <DialogDescription>{t('modal.init_node')}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="name">{t('modal.alias')}</Label>
              <Input 
                id="name"
                {...register("name")} 
                placeholder="Production DB" 
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>

            <div className="grid gap-2">
              <Label>{t('modal.engine')}</Label>
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
          </div>

          <div className="grid grid-cols-4 gap-4 items-start">
            <div className="col-span-3 grid gap-2">
              <Label htmlFor="host">{t('modal.host')}</Label>
              <div className="relative group">
                <Server className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/50 pointer-events-none" />
                <Input 
                  id="host"
                  {...register("host")} 
                  placeholder="localhost" 
                  className="pl-9"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="port">{t('modal.port')}</Label>
              <Input 
                id="port"
                {...register("port")} 
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="database">{t('modal.database')}</Label>
            <Input 
              id="database"
              {...register("database")} 
              placeholder="postgres"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="username">{t('modal.username')}</Label>
              <div className="relative group">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/50 pointer-events-none" />
                <Input 
                  id="username"
                  {...register("username")} 
                  className="pl-9"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">{t('modal.password')}</Label>
              <div className="relative group">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/50 pointer-events-none" />
                <Input 
                  id="password"
                  {...register("password")} 
                  type="password" 
                  className="pl-9"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose} className="flex-1">
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={isSubmitting} className="flex-1 font-bold">
              {isSubmitting ? <RefreshCw className="mr-2 size-4 animate-spin" /> : null}
              {t('modal.connect')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

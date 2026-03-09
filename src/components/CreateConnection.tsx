import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react- i18next";
import * as z from "zod";
import { 
  Dialog, 
  Flex, 
  Text, 
  Button, 
  TextField, 
  Select, 
  Grid, 
  Box, 
  IconButton
} from "@radix-ui/themes";
import { 
  X,
  Server,
  User,
  Lock,
  Database,
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
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Content 
        maxWidth="520px" 
        size="4" 
        className="animate-in fade-in zoom-in-95 duration-200 border border-[--border-subtle] overflow-hidden !p-0"
      >
        <Flex direction="column">
          <Box p="6">
            <Flex align="center" gap="4">
              <Box p="3" className="bg-[--accent-color] text-[--accent-text] rounded-2xl shadow-xl">
                 <Database size={24} />
              </Box>
              <Box>
                <Dialog.Title className="text-2xl font-black uppercase tracking-tight italic m-0">{t('modal.new_connection')}</Dialog.Title>
                <Dialog.Description className="text-[10px] font-black uppercase tracking-widest opacity-60 m-0 mt-1">{t('modal.init_node')}</Dialog.Description>
              </Box>
              <Dialog.Close ml="auto" asChild>
                <IconButton size="3" variant="soft" color="gray" className="rounded-2xl shrink-0">
                  <X size={20} />
                </IconButton>
              </Dialog.Close>
            </Flex>
          </Box>

          <Box className="bg-black/5 dark:bg-white/[0.02]" p="6">
            <form onSubmit={handleSubmit(onSubmit)}>
              <Flex direction="column" gap="5">
                <Grid columns="2" gap="4">
                  <Flex direction="column" gap="2">
                    <label className="text-[10px] font-black uppercase tracking-widest opacity-70 ml-1">{t('modal.alias')}</label>
                    <TextField.Root {...register("name")} size="3" variant="soft" placeholder="Main Tunnel" radius="large" />
                    {errors.name && <Text size="1" color="red" weight="bold">{errors.name.message}</Text>}
                  </Flex>

                  <Flex direction="column" gap="2">
                    <label className="text-[10px] font-black uppercase tracking-widest opacity-70 ml-1">{t('modal.engine')}</label>
                    <Controller
                      name="type"
                      control={control}
                      render={({ field }) => (
                        <Select.Root onValueChange={field.onChange} value={field.value} size="3">
                          <Select.Trigger variant="soft" radius="large" className="w-full" />
                          <Select.Content position="popper" sideOffset={5} className="z-[200] rounded-xl border border-[--border-subtle] shadow-2xl">
                            <Select.Item className="uppercase font-black text-[10px] tracking-widest focus:bg-[--accent-color] focus:text-[--accent-text]" value="postgres">Postgre</Select.Item>
                            <Select.Item className="uppercase font-black text-[10px] tracking-widest focus:bg-[--accent-color] focus:text-[--accent-text]" value="mysql">MySQL</Select.Item>
                            <Select.Item className="uppercase font-black text-[10px] tracking-widest focus:bg-[--accent-color] focus:text-[--accent-text]" value="sqlite">SQLite</Select.Item>
                            <Select.Item className="uppercase font-black text-[10px] tracking-widest focus:bg-[--accent-color] focus:text-[--accent-text]" value="sqlserver">SQL Server</Select.Item>
                          </Select.Content>
                        </Select.Root>
                      )}
                    />
                  </Flex>
                </Grid>

                <Grid columns="12" gap="4">
                  <Box className="col-span-8">
                    <Flex direction="column" gap="2">
                      <label className="text-[10px] font-black uppercase tracking-widest opacity-70 ml-1">{t('modal.host')}</label>
                      <TextField.Root {...register("host")} size="3" variant="soft" placeholder="localhost" radius="large">
                        <TextField.Slot>
                          <Server size={14} className="opacity-40" />
                        </TextField.Slot>
                      </TextField.Root>
                    </Flex>
                  </Box>
                  <Box className="col-span-4">
                    <Flex direction="column" gap="2">
                      <label className="text-[10px] font-black uppercase tracking-widest opacity-70 ml-1">{t('modal.port')}</label>
                      <TextField.Root {...register("port")} size="3" variant="soft" radius="large" className="text-center font-bold" />
                    </Flex>
                  </Box>
                </Grid>

                <Flex direction="column" gap="2">
                  <label className="text-[10px] font-black uppercase tracking-widest opacity-70 ml-1">{t('modal.database')}</label>
                  <TextField.Root {...register("database")} size="3" variant="soft" radius="large" placeholder="master" />
                </Flex>

                <Grid columns="2" gap="4">
                  <Flex direction="column" gap="2">
                    <label className="text-[10px] font-black uppercase tracking-widest opacity-70 ml-1">{t('modal.username')}</label>
                    <TextField.Root {...register("username")} size="3" variant="soft" radius="large">
                      <TextField.Slot>
                        <User size={14} className="opacity-40" />
                      </TextField.Slot>
                    </TextField.Root>
                  </Flex>
                  <Flex direction="column" gap="2">
                    <label className="text-[10px] font-black uppercase tracking-widest opacity-70 ml-1">{t('modal.password')}</label>
                    <TextField.Root {...register("password")} type="password" size="3" variant="soft" radius="large">
                      <TextField.Slot>
                        <Lock size={14} className="opacity-40" />
                      </TextField.Slot>
                    </TextField.Root>
                  </Flex>
                </Grid>

                <Flex gap="3" mt="2">
                  <Dialog.Close asChild>
                    <Button variant="surface" size="3" color="gray" className="flex-1 rounded-xl h-12 font-black uppercase tracking-widest transition-all">
                      {t('common.cancel')}
                    </Button>
                  </Dialog.Close>
                  <Button type="submit" size="3" color="gray" disabled={isSubmitting} highContrast className="flex-[1.5] rounded-xl h-12 font-black uppercase tracking-widest shadow-xl transition-all">
                    {isSubmitting ? <RefreshCw size={20} className="animate-spin" /> : t('modal.connect')}
                  </Button>
                </Flex>
              </Flex>
            </form>
          </Box>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}

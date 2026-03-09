import { useState } from "react";
import { useTranslation } from "react-i18next";
import { 
  Box, 
  Flex, 
  Text, 
  Button, 
  Card, 
  Heading, 
  Section, 
  Container, 
  IconButton,
  Inset
} from "@radix-ui/themes";
import { Titlebar } from "./components/Titlebar";
import { CreateConnectionModal } from "./components/CreateConnection";
import { 
  Plus, 
  Settings, 
  LayoutGrid, 
  Database, 
  Search, 
  DatabaseZap, 
  ExternalLink, 
  Lock 
} from "lucide-react";

function App() {
  const { t } = useTranslation();
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <Flex direction="column" height="100vh" overflow="hidden" className="bg-[--bg-app]">
      <Titlebar />

      <Flex flexGrow="1" overflow="hidden">
        {/* Radix Styled Sidebar */}
        <Box width="260px" p="4" className="hidden lg:flex flex-col gap-4 border-r border-[--border-subtle]">
          <Flex align="center" gap="3" px="2" mb="4">
            <Box className="bg-[--accent-color] text-[--accent-text] p-2 rounded-lg shadow-sm">
              <DatabaseZap size={18} />
            </Box>
            <Text size="3" weight="bold" className="tracking-tight uppercase">Romeu SQL</Text>
          </Flex>

          <Flex direction="column" gap="1">
            <Box className="sidebar-nav-item active">
              <LayoutGrid size={16} />
              <Text size="2" weight="bold" className="uppercase tracking-widest">{t('common.overview')}</Text>
            </Box>
            <Box className="sidebar-nav-item">
              <Flex flexGrow="1" align="center" justify="between">
                <Flex align="center" gap="3">
                  <Database size={16} />
                  <Text size="2" weight="bold" className="uppercase tracking-widest">{t('common.nodes')}</Text>
                </Flex>
                <IconButton 
                  size="1" 
                  variant="ghost" 
                  color="gray"
                  onClick={(e) => { e.stopPropagation(); setIsModalOpen(true); }}
                >
                  <Plus size={14} />
                </IconButton>
              </Flex>
            </Box>
            <Box className="sidebar-nav-item">
              <Search size={16} />
              <Text size="2" weight="bold" className="uppercase tracking-widest">{t('common.search')}</Text>
            </Box>
          </Flex>

          <Box mt="auto">
            <Box className="sidebar-nav-item">
              <Settings size={16} />
              <Text size="2" weight="bold" className="uppercase tracking-widest">{t('common.settings')}</Text>
            </Box>
          </Box>
        </Box>

        {/* Content Area */}
        <Box flexGrow="1" overflow="auto" p="6" lg:p="9">
          <Container size="3">
            <Flex direction="column" gap="8">
              <header>
                <Heading size="8" weight="black" className="uppercase tracking-tight italic">{t('dashboard.title')}</Heading>
                <Text size="2" color="gray" weight="bold" className="uppercase tracking-widest opacity-60">
                  {t('dashboard.subtitle')}
                </Text>
              </header>

              <Card 
                size="4" 
                variant="surface"
                onClick={() => setIsModalOpen(true)}
                className="cursor-pointer hover:shadow-lg transition-all border border-[--border-subtle]"
              >
                <Flex direction="column" justify="between" height="240px" position="relative">
                  <Box className="bg-[--accent-color] text-[--accent-text] p-4 rounded-2xl w-fit shadow-md">
                    <Plus size={32} />
                  </Box>
                  <Box>
                    <Heading size="6" weight="bold" className="uppercase italic tracking-tighter mb-2">
                       {t('dashboard.init_node_title')}
                    </Heading>
                    <Text size="3" color="gray" className="max-w-xs">{t('dashboard.init_node_desc')}</Text>
                  </Box>
                  <Box position="absolute" top="0" right="0" m="4" className="opacity-5 rotate-12">
                    <Database size={120} />
                  </Box>
                </Flex>
              </Card>

              <Box>
                <Flex align="center" justify="between" mb="5">
                  <Flex align="center" gap="2">
                    <Lock size={14} className="opacity-40" />
                    <Text size="1" weight="bold" color="gray" className="uppercase tracking-[0.2em]">
                      {t('dashboard.recent_nodes')}
                    </Text>
                  </Flex>
                  <Button variant="ghost" size="1" color="gray" className="uppercase tracking-widest font-black">
                    {t('dashboard.view_registry')} <ExternalLink size={12} />
                  </Button>
                </Flex>

                <Card 
                  size="3" 
                  variant="ghost" 
                  className="bg-black/5 dark:bg-white/5 border-2 border-dashed border-[--border-subtle] h-40 flex items-center justify-center cursor-pointer hover:bg-black/[0.08] dark:hover:bg-white/[0.08]"
                  onClick={() => setIsModalOpen(true)}
                >
                  <Flex direction="column" align="center" gap="3" className="opacity-30">
                    <Database size={32} />
                    <Text size="1" weight="bold" className="uppercase tracking-widest">{t('dashboard.no_nodes')}</Text>
                  </Flex>
                </Card>
              </Box>
            </Flex>
          </Container>
        </Box>
      </Flex>

      <CreateConnectionModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
      />
    </Flex>
  );
}

export default App;

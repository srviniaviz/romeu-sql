import { useTheme } from "../context/ThemeContext";
import { useTranslation } from "react-i18next";
import { Flex, Box, Text, Button, IconButton, Separator } from "@radix-ui/themes";
import { Minus, Square, X, Sun, Moon } from "lucide-react";

export function Titlebar() {
  const { theme, toggleTheme } = useTheme();
  const { i18n } = useTranslation();

  const toggleLanguage = () => {
    const nextLang = i18n.language.startsWith('en') ? 'pt' : 'en';
    i18n.changeLanguage(nextLang);
  };

  const minimize = async () => {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().minimize();
  };

  const toggleMaximize = async () => {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().toggleMaximize();
  };

  const close = async () => {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().close();
  };

  return (
    <Flex align="center" justify="between" height="44px" position="relative" className="select-none z-50">
      <Flex 
        data-tauri-drag-region 
        className="flex-1 h-full flex items-center px-4 gap-3 bg-transparent"
      >
        <Text size="1" weight="black" className="uppercase tracking-[0.2em] opacity-40">Romeu SQL</Text>
      </Flex>

      <Flex height="100%" align="center" px="1">
        <IconButton 
          variant="ghost" 
          color="gray"
          onClick={toggleLanguage}
          className="uppercase font-black text-[10px] tracking-tighter w-11 h-11"
          title="Change Language"
        >
          {i18n.language.startsWith('en') ? 'PT' : 'EN'}
        </IconButton>

        <Separator orientation="vertical" size="1" className="bg-[--border-subtle] mx-1 h-4" />

        <IconButton 
          variant="ghost" 
          color="gray"
          onClick={(e) => {
            e.stopPropagation();
            toggleTheme();
          }}
          className="w-11 h-11"
          title={theme === 'dark' ? "Switch to Light" : "Switch to Dark"}
        >
          {theme === 'dark' ? <Sun size={16} strokeWidth={2} /> : <Moon size={16} strokeWidth={2} />}
        </IconButton>

        <Separator orientation="vertical" size="1" className="bg-[--border-subtle] mx-1 h-4" />

        <IconButton variant="ghost" color="gray" onClick={minimize} className="w-11 h-11">
          <Minus size={16} strokeWidth={2} />
        </IconButton>
        
        <IconButton variant="ghost" color="gray" onClick={toggleMaximize} className="w-11 h-11">
          <Square size={14} strokeWidth={2} />
        </IconButton>
        
        <IconButton 
          variant="ghost" 
          color="red" 
          onClick={close} 
          className="w-11 h-11 hover:bg-red-500 hover:text-white"
        >
          <X size={16} strokeWidth={2} />
        </IconButton>
      </Flex>
    </Flex>
  );
}

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { Theme } from "@radix-ui/themes";
import { ThemeProvider } from "./context/ThemeContext";
import "./index.css";
import "./i18n/config";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider>
      <Theme accentColor="gray" radius="large" scaling="95%">
        <App />
      </Theme>
    </ThemeProvider>
  </React.StrictMode>
);

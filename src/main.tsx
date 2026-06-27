import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ThemeProvider } from "./context/ThemeContext";
import "./index.css";
import "./i18n/config";
import { benchmarkStronghold } from "./domain/connections/secretsRepository";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

declare global {
  interface Window {
    romeuBenchStronghold?: (connectionId: string, iterations?: number) => Promise<Array<{ step: string; ms: number }>>;
  }
}

window.romeuBenchStronghold = benchmarkStronghold;

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </QueryClientProvider>
  </React.StrictMode>
);

import React from "react";
import { createRoot } from "react-dom/client";
import { ChevronLeft, ChevronRight, Database, Download, Github, LogOut, Pencil, RefreshCw, Search, Shield, Table2, Trash2 } from "lucide-react";
import iconUrl from "../assets/icon.png";
import "./styles.css";

type Language = "pt" | "en";
const releasesApiUrl = "https://api.github.com/repos/srviniaviz/romeu-sql/releases/latest";

const copy = {
  pt: {
    navWhy: "Por que existe",
    navAlpha: "Status",
    heroKicker: "Alpha para Windows",
    latestLabel: "Última versão",
    latestFallback: "Última versão: alpha",
    latestLoading: "Buscando última versão",
    pageTitle: "Romeu SQL - Cliente desktop para PostgreSQL",
    pageDescription:
      "Romeu SQL é um cliente desktop alpha para PostgreSQL. Gerencie conexões locais, navegue por bancos e tabelas, execute consultas SQL e exporte dados no Windows.",
    heroTitle: "Cliente desktop para PostgreSQL",
    heroText:
      "Romeu SQL é um aplicativo local para gerenciar conexões PostgreSQL, navegar por bancos e tabelas, consultar dados e executar SQL em uma interface desktop.",
    download: "Baixar para Windows",
    releases: "Ver releases",
    available: "Disponível somente para Windows nesta fase alpha.",
    whyTitle: "Motivação",
    whyText:
      "O projeto nasceu porque eu queria uma ferramenta para PostgreSQL que fosse mais leve que os clientes grandes atuais e mais agradável que interfaces antigas. A prioridade é abrir o app, conectar, navegar pelo schema e trabalhar com dados sem fricção.",
    tribute:
      "O nome é uma homenagem ao Romeu, um gatinho frajola que eu tinha quando era criança.",
    principles: [
      ["Aplicativo local", "Conexões, dados e preferências são tratados no ambiente desktop."],
      ["PostgreSQL primeiro", "O suporte inicial é focado em PostgreSQL antes de adicionar outros bancos."],
    ],
    alphaTitle: "Estado atual",
    alphaText:
      "A aplicação ainda está em alpha. Já existe base para explorer, editor SQL, paginação, exportação, permissões e análise de performance, mas a experiência ainda está sendo ajustada.",
    footer: "GPLv3. Versão alpha.",
  },
  en: {
    navWhy: "Why it exists",
    navAlpha: "Status",
    heroKicker: "Alpha for Windows",
    latestLabel: "Latest version",
    latestFallback: "Latest version: alpha",
    latestLoading: "Fetching latest version",
    pageTitle: "Romeu SQL - Desktop client for PostgreSQL",
    pageDescription:
      "Romeu SQL is an alpha desktop PostgreSQL client. Manage local connections, browse databases and tables, run SQL queries, and export data on Windows.",
    heroTitle: "Desktop client for PostgreSQL",
    heroText:
      "Romeu SQL is a local application for managing PostgreSQL connections, browsing databases and tables, querying data, and running SQL in a desktop interface.",
    download: "Download for Windows",
    releases: "View releases",
    available: "Available for Windows only during this alpha phase.",
    whyTitle: "Motivation",
    whyText:
      "The project started because I wanted a PostgreSQL tool that felt lighter than the large clients available today and more pleasant than older interfaces. The priority is to open the app, connect, browse the schema, and work with data in fewer steps.",
    tribute: "The name is a tribute to Romeu, a black-and-white cat I had when I was a kid.",
    principles: [
      ["Local application", "Connections, data, and preferences are handled in the desktop environment."],
      ["PostgreSQL first", "Initial support is focused on PostgreSQL before adding other databases."],
    ],
    alphaTitle: "Current status",
    alphaText:
      "The application is still in alpha. The foundation already covers the explorer, SQL editor, pagination, export, permissions, and performance analysis, but the experience is still being refined.",
    footer: "GPLv3. Alpha version.",
  },
} satisfies Record<Language, unknown>;

function getInitialLanguage(): Language {
  const stored = localStorage.getItem("romeu-sql-language");
  if (stored === "pt" || stored === "en") return stored;
  return navigator.language.toLowerCase().startsWith("pt") ? "pt" : "en";
}

function App() {
  const [language, setLanguage] = React.useState<Language>(getInitialLanguage);
  const text = copy[language];

  React.useEffect(() => {
    localStorage.setItem("romeu-sql-language", language);
    document.documentElement.lang = language === "pt" ? "pt-BR" : "en";
    document.title = text.pageTitle;
    document.querySelector('meta[name="description"]')?.setAttribute("content", text.pageDescription);
    document.querySelector('meta[property="og:title"]')?.setAttribute("content", text.pageTitle);
    document.querySelector('meta[property="og:description"]')?.setAttribute("content", text.pageDescription);
    document.querySelector('meta[name="twitter:title"]')?.setAttribute("content", text.pageTitle);
    document.querySelector('meta[name="twitter:description"]')?.setAttribute("content", text.pageDescription);
  }, [language]);

  return (
    <main className="min-h-screen overflow-hidden bg-[#0b0b0a] text-stone-100 selection:bg-stone-100 selection:text-neutral-950">
      <div className="pointer-events-none fixed inset-0 -z-0 bg-[radial-gradient(circle_at_70%_12%,rgba(255,255,255,0.055),transparent_28%),linear-gradient(rgba(255,255,255,0.022)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.016)_1px,transparent_1px)] bg-[length:auto,40px_40px,40px_40px]" />
      <div className="relative z-10">
        <Header language={language} onLanguageChange={setLanguage} text={text} />
        <Hero text={text} />
        <ProductPreview />
        <Why text={text} />
        <Principles text={text} />
        <Alpha text={text} />
        <Footer text={text} />
      </div>
    </main>
  );
}

function Header({
  language,
  onLanguageChange,
  text,
}: {
  language: Language;
  onLanguageChange: (language: Language) => void;
  text: (typeof copy)[Language];
}) {
  return (
    <header className="border-b border-white/10">
      <div className="mx-auto flex h-20 w-full max-w-7xl items-center justify-between px-6">
        <a className="flex items-center gap-3 text-[15px] font-semibold" href="#top">
          <img className="h-8 w-8 object-contain" src={iconUrl} alt="" />
          <span>Romeu SQL</span>
        </a>

        <nav className="flex items-center gap-6 text-sm text-stone-400">
          <a className="hidden hover:text-stone-100 sm:inline" href="#why">
            {text.navWhy}
          </a>
          <a className="hidden hover:text-stone-100 sm:inline" href="#alpha">
            {text.navAlpha}
          </a>
        <a className="hidden hover:text-stone-100 sm:inline" href="https://github.com/srviniaviz/romeu-sql" rel="noreferrer">
            GitHub
          </a>
          <div className="flex rounded-full border border-white/15 bg-white/[0.03] p-1">
            {(["pt", "en"] as const).map((item) => (
              <button
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  language === item ? "bg-stone-100 text-neutral-950" : "text-stone-400 hover:text-stone-100"
                }`}
                key={item}
                type="button"
                onClick={() => onLanguageChange(item)}
              >
                {item.toUpperCase()}
              </button>
            ))}
          </div>
        </nav>
      </div>
    </header>
  );
}

function Hero({ text }: { text: (typeof copy)[Language] }) {
  const [latestVersion, setLatestVersion] = React.useState<string | null>(null);
  const [versionLoading, setVersionLoading] = React.useState(true);

  React.useEffect(() => {
    let canceled = false;

    async function loadLatestVersion() {
      try {
        const response = await fetch(releasesApiUrl, { headers: { Accept: "application/vnd.github+json" } });
        if (!response.ok) throw new Error(`GitHub responded ${response.status}`);
        const release = await response.json();
        if (!canceled) setLatestVersion(release.name || release.tag_name || null);
      } catch {
        if (!canceled) setLatestVersion(null);
      } finally {
        if (!canceled) setVersionLoading(false);
      }
    }

    void loadLatestVersion();

    return () => {
      canceled = true;
    };
  }, []);

  return (
    <section id="top" className="mx-auto w-full max-w-7xl px-6 py-20">
      <div className="max-w-2xl">
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <p className="m-0 text-sm font-medium text-stone-400">{text.heroKicker}</p>
          <span className="rounded-full border border-white/10 bg-white/[0.035] px-2.5 py-1 text-[11px] font-medium text-stone-500">
            {versionLoading ? text.latestLoading : latestVersion ? `${text.latestLabel}: ${latestVersion}` : text.latestFallback}
          </span>
        </div>
        <h1 className="max-w-2xl font-serif text-5xl font-semibold leading-[1.02] tracking-[-0.03em] text-stone-50 sm:text-6xl">
          {text.heroTitle}
        </h1>
        <p className="mt-7 max-w-xl text-lg leading-8 text-stone-400">{text.heroText}</p>
        <div className="mt-9 flex flex-wrap gap-3">
          <a
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-stone-100 px-4 text-sm font-semibold text-neutral-950 shadow-sm transition hover:bg-white"
            href="https://github.com/srviniaviz/romeu-sql/releases/latest"
            rel="noreferrer"
          >
            <Download size={16} />
            {text.download}
          </a>
          <a
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-white/10 px-4 text-sm font-semibold text-stone-100 ring-1 ring-white/10 transition hover:bg-white/15"
            href="https://github.com/srviniaviz/romeu-sql/releases/latest"
            rel="noreferrer"
          >
            {text.releases}
          </a>
        </div>
        <p className="mt-4 text-sm text-stone-500">{text.available}</p>
      </div>
    </section>
  );
}

function ProductPreview() {
  const tables = ["audit_logs", "bad_performance_logs", "inventory_transactions", "order_headers", "order_items", "products", "slow_search_data", "user_accounts"];
  const records = [
    [
      ["id", '"e4079b19-72a8-4de4-884a-00f7aae0711b"'],
      ["createdAt", '"<TIMESTAMP>"'],
      ["updatedAt", '"<TIMESTAMP>"'],
      ["orderId", '"ord_370260"'],
      ["productId", '"prod_260"'],
      ["productName", '"Super Product 260"'],
      ["fulfillmentStatus", "FULFILLED"],
      ["carrier", '"CORREIOS"'],
      ["discountAmount", "0"],
      ["quantity", "1"],
      ["totalAmount", "314.33"],
    ],
    [
      ["id", '"8216cf93-5e05-493b-af21-02bdd75d31ff"'],
      ["createdAt", '"<TIMESTAMP>"'],
      ["updatedAt", '"<TIMESTAMP>"'],
      ["orderId", '"ord_370261"'],
      ["productId", '"prod_261"'],
      ["productName", '"Super Product 261"'],
      ["fulfillmentStatus", "UNFULFILLED"],
    ],
  ];

  return (
    <section className="mx-auto w-full max-w-7xl px-6 pb-24">
      <div className="overflow-hidden rounded-lg border border-white/10 bg-[#0b0b0a] shadow-2xl shadow-black/40">
        <div className="grid min-h-[650px] md:grid-cols-[300px_1fr]">
          <aside className="border-r border-white/10 bg-[#10100f]">
            <div className="flex h-16 items-start justify-between px-4 pt-4">
              <div>
                <h3 className="text-lg font-bold text-stone-50">Workspace</h3>
                <p className="mt-1 text-xs text-stone-500">Connections and schema browser</p>
              </div>
              <Database className="text-blue-500" size={18} />
            </div>

            <div className="flex items-center justify-between px-4 pb-3 pt-1 text-xs">
              <span className="font-semibold text-stone-100">Connections <b className="ml-1 rounded bg-white/[0.06] px-1.5 py-0.5">2</b></span>
              <span className="text-stone-400">New</span>
            </div>

            <div className="px-4 pb-3">
              <div className="flex h-9 items-center gap-2 rounded-md border border-white/10 bg-[#0b0b0a]/80 px-3 text-[13px] text-stone-400">
                <Search size={14} />
                Search connections
              </div>
            </div>

            <div className="space-y-0.5 px-2 pb-8 text-sm">
              <div className="flex h-8 items-center gap-2 rounded-md px-2 text-stone-400">
                <ChevronRight size={14} />
                test
              </div>
              <div>
                <div className="flex h-8 items-center justify-between rounded-md bg-blue-500/10 px-2 text-blue-400">
                  <div className="flex min-w-0 items-center gap-2">
                    <ChevronRight className="rotate-90" size={14} />
                    <Database size={14} />
                    <span className="truncate text-[12px] font-medium">postgres@localhost</span>
                  </div>
                  <div className="flex items-center gap-1 text-stone-400">
                    <LogOut size={12} className="text-blue-400" />
                    <RefreshCw size={12} />
                    <Database size={12} />
                    <Shield size={12} />
                    <Pencil size={12} />
                    <Trash2 size={12} />
                  </div>
                </div>
                <div className="ml-6 py-1 pr-2">
                  <div className="flex items-center gap-2 rounded-md bg-white/[0.06] px-2 py-1.5 text-blue-400">
                    <ChevronRight className="rotate-90 text-stone-500" size={12} />
                    <Database size={13} />
                    postgres
                  </div>
                  <div className="ml-4 mt-0.5 space-y-0.5 overflow-hidden pl-2">
                    {tables.map((table) => (
                      <div
                        className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-[12px] ${
                          table === "order_items" ? "bg-blue-500/10 font-medium text-blue-400" : "text-stone-400"
                        }`}
                        key={table}
                      >
                        <Table2 size={12} />
                        {table}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </aside>

          <div className="min-w-0 bg-[#0b0b0a]">
            <header className="flex h-16 items-center justify-between border-b border-white/10 px-5">
              <div className="min-w-0">
                <div className="flex items-center gap-2 leading-none">
                  <Database className="text-blue-500" size={17} />
                  <h3 className="text-lg font-bold text-stone-50">postgres</h3>
                </div>
                <p className="mt-2 text-xs leading-none text-stone-400">localhost:5432 · postgres</p>
              </div>
              <div className="flex h-8 items-center rounded-lg border border-white/10 bg-white/[0.04] px-3 text-xs text-stone-400">
                Rows <b className="ml-1 text-stone-100">1000000</b>
              </div>
            </header>

            <div className="px-5 py-7">
              <div className="mb-5 flex h-10 items-center gap-2 text-sm font-bold text-stone-100">
                <ChevronLeft size={14} className="text-stone-500" />
                <Database size={14} />
                order_items
              </div>

              <div className="mb-3 flex gap-7 text-sm font-semibold">
                <span className="border-b-2 border-blue-500 pb-3 text-blue-400">Rows <b className="ml-1 rounded bg-white/[0.06] px-1.5 text-xs text-stone-300">1000000</b></span>
                <span className="pb-3 text-stone-300">Query</span>
                <span className="pb-3 text-stone-300">Schema <b className="ml-1 rounded bg-white/[0.06] px-1.5 text-xs">26</b></span>
                <span className="pb-3 text-stone-300">Indexes <b className="ml-1 rounded bg-white/[0.06] px-1.5 text-xs">1</b></span>
              </div>

              <div className="grid gap-2">
                <div className="rounded-md bg-white/[0.025] px-3 py-2 font-mono text-xs text-stone-300">
                  WHERE <span className="text-blue-300">id</span> = 1
                </div>
                <div className="rounded-md bg-white/[0.025] px-3 py-2 font-mono text-xs text-stone-300">
                  ORDER BY <span className="text-stone-500">createdAt desc</span>
                </div>
              </div>

              <div className="my-4 flex items-center justify-between">
                <div className="flex gap-2">
                  <button className="rounded-md bg-blue-500 px-3 py-2 text-xs font-semibold text-white">+ Add row</button>
                  <button className="rounded-md bg-white/[0.04] px-3 py-2 text-xs font-semibold text-stone-100">Export</button>
                </div>
                <div className="text-xs text-stone-400">1 - 10 of 1000000</div>
              </div>

              <div className="space-y-2">
                {records.map((record, index) => (
                  <div className="rounded-md bg-white/[0.025] px-3 py-2 font-mono text-xs leading-[1.45] text-stone-200" key={index}>
                    <div className="mb-1 text-stone-500">⌄</div>
                    {record.map(([key, value]) => (
                      <div className="grid grid-cols-[130px_1fr]" key={key}>
                        <span className="font-bold text-stone-100">{key} :</span>
                        <span className={value === "FULFILLED" || value === "UNFULFILLED" ? "w-fit rounded bg-blue-500/20 px-1.5 text-blue-300" : "text-blue-300"}>
                          {value}
                        </span>
                      </div>
                    ))}
                    <button className="mt-2 text-blue-400">Hide 18 fields</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Why({ text }: { text: (typeof copy)[Language] }) {
  return (
    <section id="why" className="mx-auto grid w-full max-w-7xl gap-10 border-t border-white/10 px-6 py-20 md:grid-cols-[0.72fr_1fr]">
      <h2 className="font-serif text-4xl font-semibold leading-tight tracking-[-0.025em] text-stone-50 sm:text-5xl">{text.whyTitle}</h2>
      <div className="max-w-2xl space-y-5 text-lg leading-8 text-stone-400">
        <p>{text.whyText}</p>
        <p>{text.tribute}</p>
      </div>
    </section>
  );
}

function Principles({ text }: { text: (typeof copy)[Language] }) {
  return (
    <section className="mx-auto grid w-full max-w-7xl border-t border-white/10 px-6 md:grid-cols-2">
      {text.principles.map(([title, body]) => (
        <article className="border-b border-white/10 py-10 md:border-b-0 md:border-r md:border-white/10 md:px-8 first:md:pl-0 last:md:border-r-0 last:md:pr-0" key={title}>
          <h3 className="text-sm font-semibold text-stone-200">{title}</h3>
          <p className="mt-12 max-w-sm text-xl leading-8 text-stone-400">{body}</p>
        </article>
      ))}
    </section>
  );
}

function Alpha({ text }: { text: (typeof copy)[Language] }) {
  return (
    <section id="alpha" className="mx-auto grid w-full max-w-7xl gap-10 border-t border-white/10 px-6 py-20 md:grid-cols-[0.72fr_1fr]">
      <h2 className="font-serif text-4xl font-semibold leading-tight tracking-[-0.025em] text-stone-50 sm:text-5xl">{text.alphaTitle}</h2>
      <p className="max-w-2xl text-lg leading-8 text-stone-400">{text.alphaText}</p>
    </section>
  );
}

function Footer({ text }: { text: (typeof copy)[Language] }) {
  return (
    <footer className="border-t border-white/10">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-6 py-8 text-sm text-stone-500 sm:flex-row sm:items-center sm:justify-between">
        <span>{text.footer}</span>
        <a className="inline-flex items-center gap-2 hover:text-stone-200" href="https://github.com/srviniaviz/romeu-sql" rel="noreferrer">
          <Github size={15} />
          srviniaviz/romeu-sql
        </a>
      </div>
    </footer>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

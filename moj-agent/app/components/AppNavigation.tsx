"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type NavigationItem = {
  href: string;
  icon: string;
  label: string;
};

type NavigationGroup = {
  id: string;
  label: string;
  icon: string;
  items: NavigationItem[];
};

const dashboardItem: NavigationItem = {
  href: "/",
  icon: "HOME",
  label: "Dashboard",
};

const navigationGroups: NavigationGroup[] = [
  {
    id: "ai",
    label: "AI",
    icon: "AI",
    items: [
      { href: "/chat", icon: "CHAT", label: "Chat z personą" },
      { href: "/think", icon: "BRAIN", label: "Tryb myślenia" },
      { href: "/react", icon: "LOOP", label: "Agent ReAct" },
      { href: "/agent", icon: "BOT", label: "Agent multi-tool" },
      { href: "/fewshot", icon: "BOOK", label: "Słownik AI" },
    ],
  },
  {
    id: "creator",
    label: "Kreator",
    icon: "MAKE",
    items: [
      { href: "/generate", icon: "ART", label: "Generator grafik" },
      { href: "/generator-opisu-produktu", icon: "DESC", label: "Kreator opisów" },
      { href: "/vision", icon: "EYE", label: "Analiza obrazów" },
      { href: "/format", icon: "FORM", label: "Formatowanie" },
    ],
  },
  {
    id: "knowledge",
    label: "Wiedza",
    icon: "DATA",
    items: [
      { href: "/upload", icon: "BOOK", label: "Baza wiedzy" },
      { href: "/knowledge", icon: "RAG", label: "Podgląd bazy RAG" },
      { href: "/history", icon: "HIST", label: "Historia" },
      { href: "/briefings", icon: "NEWS", label: "Briefingi" },
    ],
  },
  {
    id: "tools",
    label: "Narzędzia",
    icon: "TOOL",
    items: [
      { href: "/search", icon: "FIND", label: "Wyszukiwarka Google" },
      { href: "/travel", icon: "MAP", label: "Asystent podróży" },
      { href: "/report", icon: "RPT", label: "Raporty" },
      { href: "/competitor", icon: "COMP", label: "Konkurencja" },
      { href: "/admin/security", icon: "SAFE", label: "Bezpieczeństwo" },
    ],
  },
  {
    id: "workflow",
    label: "Workflow",
    icon: "FLOW",
    items: [
      { href: "/email-triage", icon: "MAIL", label: "E-mail Triage" },
    ],
  },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/" || pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function getActiveGroupId(pathname: string) {
  return navigationGroups.find((group) =>
    group.items.some((item) => isActive(pathname, item.href)),
  )?.id ?? null;
}

export function AppNavigation() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [accordionState, setAccordionState] = useState<{
    pathname: string;
    openGroupId: string | null;
  }>(() => ({ pathname, openGroupId: getActiveGroupId(pathname) }));
  const activeGroupId = getActiveGroupId(pathname);
  const openGroupId =
    accordionState.pathname === pathname
      ? accordionState.openGroupId
      : activeGroupId ?? accordionState.openGroupId;

  useEffect(() => {
    if (!isOpen) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isOpen]);

  const closeMobileNavigation = () => setIsOpen(false);

  const renderNavigation = (instance: "desktop" | "mobile") => (
    <div className="flex h-full flex-col gap-2">
      <Link
        href="/"
        onClick={() => {
          setAccordionState({ pathname: "/", openGroupId });
          closeMobileNavigation();
        }}
        className="mb-3 rounded-lg border border-[#2f403b] bg-[#07100e] px-3 py-3"
      >
        <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-[#8aa59b]">
          Mój Agent
        </span>
        <span className="mt-1 block text-lg font-semibold text-[#f4f7f5]">
          Centrum dowodzenia
        </span>
      </Link>

      <nav aria-label="Główna nawigacja" className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        <Link
          href={dashboardItem.href}
          onClick={() => {
            setAccordionState({ pathname: dashboardItem.href, openGroupId });
            closeMobileNavigation();
          }}
          aria-current={isActive(pathname, dashboardItem.href) ? "page" : undefined}
          className={`flex min-h-12 items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition ${
            isActive(pathname, dashboardItem.href)
              ? "border-[#3dd6a3] bg-[#12342b] text-white shadow-lg shadow-[#3dd6a3]/10"
              : "border-[#20302b] bg-[#08100e] text-[#b6c4be] hover:border-[#3d6257] hover:bg-[#0d1715] hover:text-white"
          }`}
        >
          <span className="grid h-8 w-10 shrink-0 place-items-center rounded-md border border-white/10 bg-white/[0.04] font-mono text-[10px] font-semibold">
            {dashboardItem.icon}
          </span>
          <span className="min-w-0 truncate">{dashboardItem.label}</span>
        </Link>

        {navigationGroups.map((group) => {
          const isExpanded = openGroupId === group.id;
          const hasActiveItem = group.items.some((item) =>
            isActive(pathname, item.href),
          );
          const panelId = `${instance}-${group.id}-navigation`;

          return (
            <div key={group.id}>
              <button
                type="button"
                aria-expanded={isExpanded}
                aria-controls={panelId}
                onClick={() =>
                  setAccordionState({
                    pathname,
                    openGroupId: isExpanded ? null : group.id,
                  })
                }
                className={`flex min-h-12 w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition ${
                  hasActiveItem
                    ? "border-[#3dd6a3]/70 bg-[#0d211b] text-white"
                    : "border-[#20302b] bg-[#08100e] text-[#b6c4be] hover:border-[#3d6257] hover:bg-[#0d1715] hover:text-white"
                }`}
              >
                <span className="grid h-8 w-10 shrink-0 place-items-center rounded-md border border-white/10 bg-white/[0.04] font-mono text-[10px] font-semibold">
                  {group.icon}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium">{group.label}</span>
                <span
                  aria-hidden="true"
                  className={`text-xs text-[#8aa59b] transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                >
                  ▼
                </span>
              </button>

              <div id={panelId} hidden={!isExpanded} className="ml-5 mt-1 space-y-1 border-l border-[#24312d] pl-3">
                {group.items.map((item) => {
                  const active = isActive(pathname, item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => {
                        setAccordionState({
                          pathname: item.href,
                          openGroupId: group.id,
                        });
                        closeMobileNavigation();
                      }}
                      aria-current={active ? "page" : undefined}
                      className={`flex min-h-11 items-center gap-3 rounded-lg border px-3 py-2 text-sm transition ${
                        active
                          ? "border-[#3dd6a3] bg-[#12342b] font-medium text-white shadow-md shadow-[#3dd6a3]/10"
                          : "border-transparent bg-transparent text-[#9fb0aa] hover:border-[#2f403b] hover:bg-[#0d1715] hover:text-white"
                      }`}
                    >
                      <span className="grid h-7 w-9 shrink-0 place-items-center rounded-md border border-white/[0.07] bg-white/[0.03] font-mono text-[9px] font-semibold text-[#8aa59b]">
                        {item.icon}
                      </span>
                      <span className="min-w-0 truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <button
        type="button"
        onClick={() => void supabase.auth.signOut()}
        className="mt-auto min-h-11 rounded-lg border border-red-900/60 px-3 py-2.5 text-sm text-red-300 hover:bg-red-950/40"
      >
        Wyloguj
      </button>
    </div>
  );

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 border-b border-[#24312d] bg-[#050807]/95 px-4 py-3 text-[#ededed] backdrop-blur-md lg:hidden">
        <div className="flex items-center justify-between">
          <Link href="/" className="font-semibold">
            Centrum dowodzenia
          </Link>
          <button
            type="button"
            onClick={() => setIsOpen((current) => !current)}
            aria-label={isOpen ? "Zamknij menu" : "Otwórz menu"}
            aria-expanded={isOpen}
            aria-controls="mobile-navigation"
            className="min-h-11 rounded-lg border border-[#2f403b] bg-[#091310] px-3 py-2 font-mono text-sm"
          >
            {isOpen ? "X" : "MENU"}
          </button>
        </div>
      </header>

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-[#24312d] bg-[#050807]/95 p-4 text-[#ededed] shadow-2xl shadow-black/30 backdrop-blur-md lg:block">
        {renderNavigation("desktop")}
      </aside>

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm lg:hidden">
          <div id="mobile-navigation" className="h-full w-[min(86vw,22rem)] border-r border-[#24312d] bg-[#050807] p-4 text-[#ededed] shadow-2xl">
            {renderNavigation("mobile")}
          </div>
          <button
            type="button"
            aria-label="Zamknij menu"
            onClick={closeMobileNavigation}
            className="absolute right-4 top-4 min-h-11 rounded-lg border border-white/15 bg-white/10 px-3 py-2 font-mono text-sm text-white"
          >
            X
          </button>
        </div>
      )}
    </>
  );
}

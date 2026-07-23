"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

const links = [
  { href: "/", icon: "HOME", label: "Dashboard" },
  { href: "/chat", icon: "CHAT", label: "Chat z persona" },
  { href: "/history", icon: "HIST", label: "Historia" },
  { href: "/upload", icon: "BOOK", label: "📚 Baza wiedzy" },
  { href: "/knowledge", icon: "RAG", label: "Podgląd bazy RAG" },
  { href: "/think", icon: "BRAIN", label: "Tryb myslenia" },
  { href: "/fewshot", icon: "BOOK", label: "Slownik AI" },
  { href: "/format", icon: "FORM", label: "Formatowanie" },
  { href: "/search", icon: "FIND", label: "Wyszukiwarka Google" },
  { href: "/generate", icon: "ART", label: "Generator grafik" },
  { href: "/vision", icon: "EYE", label: "Analiza obrazow" },
  { href: "/agent", icon: "BOT", label: "Agent multi-tool" },
  { href: "/react", icon: "LOOP", label: "Agent ReAct" },
  { href: "/travel", icon: "MAP", label: "Asystent podrozy" },
  { href: "/report", icon: "RPT", label: "📊 Raporty" },
  { href: "/email-triage", icon: "MAIL", label: "📧 E-mail Triage" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/" || pathname === "/dashboard";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppNavigation() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  const navigation = (
    <div className="flex h-full flex-col gap-2">
      <Link
        href="/"
        onClick={() => setIsOpen(false)}
        className="mb-3 rounded-lg border border-[#2f403b] bg-[#07100e] px-3 py-3"
      >
        <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-[#8aa59b]">
          Moj Agent
        </span>
        <span className="mt-1 block text-lg font-semibold text-[#f4f7f5]">
          Centrum dowodzenia
        </span>
      </Link>

      {links.map((link) => {
        const active = isActive(pathname, link.href);

        return (
          <Link
            key={link.href}
            href={link.href}
            onClick={() => setIsOpen(false)}
            className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition ${
              active
                ? "border-[#3dd6a3] bg-[#12342b] text-white shadow-lg shadow-[#3dd6a3]/10"
                : "border-[#20302b] bg-[#08100e] text-[#b6c4be] hover:border-[#3d6257] hover:bg-[#0d1715] hover:text-white"
            }`}
          >
            <span className="grid h-8 w-10 shrink-0 place-items-center rounded-md border border-white/10 bg-white/[0.04] font-mono text-[10px] font-semibold">
              {link.icon}
            </span>
            <span className="min-w-0 truncate">{link.label}</span>
          </Link>
        );
      })}
      <button type="button" onClick={() => void supabase.auth.signOut()} className="mt-auto rounded-lg border border-red-900/60 px-3 py-2.5 text-sm text-red-300 hover:bg-red-950/40">Wyloguj</button>
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
            aria-label="Otworz menu"
            className="rounded-lg border border-[#2f403b] bg-[#091310] px-3 py-2 font-mono text-sm"
          >
            {isOpen ? "X" : "MENU"}
          </button>
        </div>
      </header>

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-[#24312d] bg-[#050807]/95 p-4 text-[#ededed] shadow-2xl shadow-black/30 backdrop-blur-md lg:block">
        {navigation}
      </aside>

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm lg:hidden">
          <div className="h-full w-[min(86vw,22rem)] border-r border-[#24312d] bg-[#050807] p-4 text-[#ededed] shadow-2xl">
            {navigation}
          </div>
          <button
            type="button"
            aria-label="Zamknij menu"
            onClick={() => setIsOpen(false)}
            className="absolute right-4 top-4 rounded-lg border border-white/15 bg-white/10 px-3 py-2 font-mono text-sm text-white"
          >
            X
          </button>
        </div>
      )}
    </>
  );
}

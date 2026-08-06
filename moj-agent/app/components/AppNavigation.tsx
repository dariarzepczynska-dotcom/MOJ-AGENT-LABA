"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

const sections = [
  {
    label: "Centrum",
    links: [
      { href: "/", icon: "⌂", label: "Pulpit" },
      { href: "/chat", icon: "✦", label: "Chat z personą" },
      { href: "/history", icon: "◷", label: "Historia" },
      { href: "/briefings", icon: "◫", label: "Briefingi" },
    ],
  },
  {
    label: "Tworzenie",
    links: [
      { href: "/generator-opisu-produktu", icon: "✎", label: "Kreator opisów" },
      { href: "/generate", icon: "◇", label: "Generator grafik" },
      { href: "/format", icon: "≡", label: "Formatowanie" },
      { href: "/report", icon: "▥", label: "Raporty" },
      { href: "/email-triage", icon: "@", label: "E-mail Triage" },
    ],
  },
  {
    label: "Wiedza i analiza",
    links: [
      { href: "/upload", icon: "+", label: "Baza wiedzy" },
      { href: "/knowledge", icon: "◎", label: "Podgląd bazy RAG" },
      { href: "/search", icon: "⌕", label: "Wyszukiwarka" },
      { href: "/vision", icon: "◉", label: "Analiza obrazów" },
      { href: "/competitor", icon: "↗", label: "Konkurencja" },
    ],
  },
  {
    label: "Agenci",
    links: [
      { href: "/think", icon: "∴", label: "Tryb myślenia" },
      { href: "/fewshot", icon: "Aa", label: "Słownik AI" },
      { href: "/agent", icon: "✣", label: "Agent multi-tool" },
      { href: "/react", icon: "↻", label: "Agent ReAct" },
      { href: "/travel", icon: "⌖", label: "Asystent podróży" },
      { href: "/admin/security", icon: "△", label: "Bezpieczeństwo" },
    ],
  },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/" || pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppNavigation() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  const navigation = (
    <div className="flex h-full flex-col">
      <Link
        href="/"
        onClick={() => setIsOpen(false)}
        className="mb-5 rounded-2xl border border-[#d8c9bb] bg-white/70 px-4 py-4 shadow-[0_12px_32px_rgba(71,51,37,.06)]"
      >
        <span className="block text-[10px] font-bold uppercase tracking-[0.24em] text-[#9b765d]">
          Fikartki · AI studio
        </span>
        <span className="mt-1.5 block font-serif text-xl text-[#342c27]">
          Mój Agent
        </span>
      </Link>

      <nav className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
        {sections.map((section) => (
          <section key={section.label}>
            <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-[#a17a60]">
              {section.label}
            </p>
            <div className="space-y-1">
              {section.links.map((link) => {
                const active = isActive(pathname, link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setIsOpen(false)}
                    className={`flex items-center gap-3 rounded-xl border px-3 py-2 text-sm transition ${
                      active
                        ? "border-[#c9b29e] bg-[#eadfd4] font-semibold text-[#342c27] shadow-sm"
                        : "border-transparent text-[#71645b] hover:border-[#ded2c5] hover:bg-white/65 hover:text-[#342c27]"
                    }`}
                  >
                    <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg font-serif text-sm ${active ? "bg-white text-[#846a54]" : "bg-[#eee5dc] text-[#8f8075]"}`}>
                      {link.icon}
                    </span>
                    <span className="min-w-0 truncate">{link.label}</span>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </nav>

      <button
        type="button"
        onClick={() => void supabase.auth.signOut()}
        className="mt-4 rounded-xl border border-[#d8c9bb] bg-white/55 px-3 py-2.5 text-sm text-[#876b59] transition hover:bg-white hover:text-[#a34747]"
      >
        Wyloguj
      </button>
    </div>
  );

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 border-b border-[#ded2c5] bg-[#f3ece3]/95 px-4 py-3 text-[#342c27] backdrop-blur-md lg:hidden">
        <div className="flex items-center justify-between">
          <Link href="/" className="font-serif text-lg">
            Mój Agent
          </Link>
          <button
            type="button"
            onClick={() => setIsOpen((current) => !current)}
            aria-label="Otwórz menu"
            className="rounded-full border border-[#cdbba9] bg-white px-4 py-2 text-xs font-bold tracking-wide text-[#725f51]"
          >
            {isOpen ? "ZAMKNIJ" : "MENU"}
          </button>
        </div>
      </header>

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-[#ded2c5] bg-[#f3ece3]/95 p-4 text-[#342c27] shadow-[12px_0_40px_rgba(71,51,37,.06)] backdrop-blur-md lg:block">
        {navigation}
      </aside>

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-[#342c27]/45 backdrop-blur-sm lg:hidden">
          <div className="h-full w-[min(86vw,22rem)] border-r border-[#ded2c5] bg-[#f3ece3] p-4 text-[#342c27] shadow-2xl">
            {navigation}
          </div>
          <button
            type="button"
            aria-label="Zamknij menu"
            onClick={() => setIsOpen(false)}
            className="absolute right-4 top-4 rounded-full border border-white/60 bg-white/85 px-3 py-2 text-xs font-bold text-[#342c27]"
          >
            X
          </button>
        </div>
      )}
    </>
  );
}

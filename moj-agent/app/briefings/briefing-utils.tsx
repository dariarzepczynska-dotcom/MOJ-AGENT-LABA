import { Fragment, ReactNode } from "react";

export type BriefingRow = {
  id: string | number;
  content: string | null;
  date?: string | null;
  created_at?: string | null;
};

export function formatBriefingDate(briefing: BriefingRow) {
  const rawDate = briefing.created_at ?? briefing.date;

  if (!rawDate) return "Brak daty";

  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(rawDate)
    ? `${rawDate}T12:00:00`
    : rawDate;
  const date = new Date(normalized);

  if (Number.isNaN(date.getTime())) return "Brak daty";

  return new Intl.DateTimeFormat("pl-PL", {
    day: "numeric",
    month: "long",
    year: "numeric",
    weekday: "long",
  }).format(date);
}

export function getBriefingPreview(content: string | null) {
  const clean = (content ?? "")
    .replace(/[#*_`>-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return clean.length > 150 ? `${clean.slice(0, 150).trim()}…` : clean;
}

function renderInline(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\(https?:\/\/[^)]+\))/g);

  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={index} className="font-semibold text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }

    const link = part.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/);

    if (link) {
      return (
        <a
          key={index}
          href={link[2]}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-[#7af0cb] underline decoration-[#7af0cb]/40 underline-offset-2 hover:text-white"
        >
          {link[1]}
        </a>
      );
    }

    return <Fragment key={index}>{part}</Fragment>;
  });
}

export function BriefingMarkdown({ content }: { content: string }) {
  const lines = content.split(/\r?\n/);
  const blocks: ReactNode[] = [];
  let list: string[] = [];

  const flushList = () => {
    if (!list.length) return;
    const items = list;
    list = [];
    blocks.push(
      <ul
        key={`list-${blocks.length}`}
        className="my-4 list-disc space-y-2 pl-6 text-[#c8d7d1]"
      >
        {items.map((item, index) => (
          <li key={index}>{renderInline(item)}</li>
        ))}
      </ul>,
    );
  };

  lines.forEach((rawLine) => {
    const line = rawLine.trim();

    if (/^[-*]\s+/.test(line)) {
      list.push(line.replace(/^[-*]\s+/, ""));
      return;
    }

    flushList();
    if (!line) return;

    if (line.startsWith("# ")) {
      blocks.push(
        <h1 key={blocks.length} className="mb-6 text-3xl font-semibold text-white">
          {renderInline(line.slice(2))}
        </h1>,
      );
    } else if (line.startsWith("## ")) {
      blocks.push(
        <h2
          key={blocks.length}
          className="mb-3 mt-8 border-b border-[#2f403b] pb-2 text-xl font-semibold text-[#9fe8cf]"
        >
          {renderInline(line.slice(3))}
        </h2>,
      );
    } else if (line.startsWith("### ")) {
      blocks.push(
        <h3 key={blocks.length} className="mb-2 mt-6 text-lg font-semibold text-white">
          {renderInline(line.slice(4))}
        </h3>,
      );
    } else {
      blocks.push(
        <p key={blocks.length} className="my-3 leading-7 text-[#c8d7d1]">
          {renderInline(line)}
        </p>,
      );
    }
  });

  flushList();
  return <div>{blocks}</div>;
}

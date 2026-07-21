import Link from "next/link";

const sourcePattern = /^\s*📎\s*Źródł(?:o|a):\s*(.+?)\s*$/im;

export function MessageWithSources({ text }: { text: string }) {
  const match = sourcePattern.exec(text);

  if (!match) {
    return <div className="whitespace-pre-wrap">{text}</div>;
  }

  const content = `${text.slice(0, match.index)}${text.slice(match.index + match[0].length)}`.trim();
  const isMultiple = /^\s*📎\s*Źródła:/i.test(match[0]);
  const sourceNames = match[1]
    .trim()
    .replace(/^\[|\]$/g, "")
    .replace(/\]\s*,\s*\[/g, ", ");

  return (
    <div>
      {content && <div className="whitespace-pre-wrap">{content}</div>}
      <Link
        href="/knowledge"
        className="mt-3 flex items-center gap-2 border-t border-white/10 pt-2 text-xs text-[#94a3b8] transition hover:text-[#cbd5e1]"
      >
        <span aria-hidden="true">📄</span>
        <span>
          {isMultiple ? "Źródła" : "Źródło"}: {sourceNames}
        </span>
      </Link>
    </div>
  );
}

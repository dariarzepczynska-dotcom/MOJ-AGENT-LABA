import type { StreamTextTransform, TextStreamPart } from "ai";
import type { ToolSet } from "@ai-sdk/provider-utils";

export const BLOCKED_INPUT_MESSAGE =
  "Ta wiadomość została zablokowana z powodów bezpieczeństwa.";
export const BLOCKED_OUTPUT_MESSAGE =
  "Przepraszam, nie mogę udostępnić tych informacji.";
export const MAX_MESSAGE_LENGTH = 2000;

const forbiddenInputPhrases = [
  "ignore previous",
  "system prompt",
  "ignore instructions",
  "reveal",
  "show me your",
  "translate your prompt",
] as const;

const sensitiveOutputPatterns = [
  /\bAPI_KEY\b/i,
  /\bSUPABASE_URL\b/i,
  /\bsystem\s+prompt\b/i,
  /\b(?:GOOGLE|OPENAI|SUPABASE)[_-]?API[_-]?KEY\b/i,
  /\bSUPABASE[_-]?(?:SERVICE[_-]?ROLE|ANON)[_-]?KEY\b/i,
  /\bservice[_-]?role[_-]?key\b/i,
  /\b(?:user_profiles|message_logs|webhook_events|match_documents)\b/i,
  /\b(?:table|from|into|update)\s+(?:public\.)?(?:conversations|messages|documents|reports|briefings)\b/i,
] as const;

const controlAndZeroWidthCharacters =
  /[\p{Cc}\u00ad\u034f\u061c\u115f\u1160\u17b4\u17b5\u180e\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff\uffa0]/gu;

function normalizeForComparison(value: string) {
  return value.replace(/\s+/g, " ").trim().toLocaleLowerCase("en-US");
}

export function sanitizeUserInput(value: string) {
  return value.replace(controlAndZeroWidthCharacters, "");
}

export type InputValidationResult =
  | { ok: true; value: string }
  | { ok: false; reason: "length" | "blacklist" };

export function validateUserInput(value: string): InputValidationResult {
  const sanitized = sanitizeUserInput(value);
  const normalized = normalizeForComparison(sanitized);

  if (sanitized.length > MAX_MESSAGE_LENGTH) {
    return { ok: false, reason: "length" };
  }

  if (forbiddenInputPhrases.some((phrase) => normalized.includes(phrase))) {
    return { ok: false, reason: "blacklist" };
  }

  return { ok: true, value: sanitized };
}

function containsSystemPromptFragment(output: string, systemPrompt: string) {
  const normalizedOutput = normalizeForComparison(output);

  return systemPrompt
    .split(/\r?\n/)
    .map(normalizeForComparison)
    .filter((line) => line.length >= 40)
    .some((line) => normalizedOutput.includes(line));
}

export function containsSensitiveOutput(output: string, systemPrompt: string) {
  return (
    sensitiveOutputPatterns.some((pattern) => pattern.test(output)) ||
    containsSystemPromptFragment(output, systemPrompt)
  );
}

/**
 * Buffers the complete model stream so a leak cannot be partially sent before
 * a later chunk makes it detectable.
 */
export function createOutputFilterTransform<TOOLS extends ToolSet>(
  systemPrompt: string,
): StreamTextTransform<TOOLS> {
  return () => {
    const chunks: TextStreamPart<TOOLS>[] = [];
    let generatedText = "";

    return new TransformStream<TextStreamPart<TOOLS>, TextStreamPart<TOOLS>>({
      transform(chunk) {
        chunks.push(chunk);
        if (chunk.type === "text-delta") {
          generatedText += chunk.text;
        }
      },
      flush(controller) {
        if (!containsSensitiveOutput(generatedText, systemPrompt)) {
          for (const chunk of chunks) controller.enqueue(chunk);
          return;
        }

        let replacementWritten = false;

        for (const chunk of chunks) {
          if (chunk.type === "text-start") {
            if (!replacementWritten) {
              controller.enqueue(chunk);
              controller.enqueue({
                type: "text-delta",
                id: chunk.id,
                text: BLOCKED_OUTPUT_MESSAGE,
              });
              controller.enqueue({ type: "text-end", id: chunk.id });
              replacementWritten = true;
            }
            continue;
          }

          if (chunk.type === "text-delta" || chunk.type === "text-end") {
            continue;
          }

          controller.enqueue(chunk);
        }
      },
    });
  };
}

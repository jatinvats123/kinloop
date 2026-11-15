// Typed message dictionary for elder-facing strings; adding a language means adding one more map.
import { en, type MessageKey } from "./en";

export type { MessageKey };
export type Lang = "en";

const dictionaries: Record<Lang, Record<MessageKey, string>> = { en };

/**
 * Looks up `key` for `lang` and fills `{placeholders}` from `vars`.
 * Unknown placeholders are left visible so a missing value is obvious in review.
 */
export function t(
  key: MessageKey,
  vars: Record<string, string | number> = {},
  lang: Lang = "en",
): string {
  const template = dictionaries[lang][key];
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

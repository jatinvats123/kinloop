"use client";
// Elder comfort: read Today aloud with the browser's speech synthesis, and pick a text size.
import { Type, Volume2, VolumeX } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

export function ReadAloud({
  text,
  startLabel,
  stopLabel,
}: {
  text: string;
  startLabel: string;
  stopLabel: string;
}) {
  const supported = useSyncExternalStore(
    noopSubscribe,
    () => "speechSynthesis" in window,
    () => false,
  );
  const [speaking, setSpeaking] = useState(false);

  useEffect(
    () => () => {
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    },
    [],
  );

  if (!supported) return null;

  function toggle() {
    const synth = window.speechSynthesis;
    if (speaking) {
      synth.cancel();
      setSpeaking(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.lang = "en-IN";
    utterance.onend = () => setSpeaking(false);
    synth.speak(utterance);
    setSpeaking(true);
  }

  const Icon = speaking ? VolumeX : Volume2;
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={speaking}
      className="inline-flex min-h-14 items-center gap-2 rounded-full bg-card px-5 text-base font-semibold ring-1 ring-inset ring-ink/20 hover:ring-ink/50"
    >
      <Icon aria-hidden="true" size={22} />
      {speaking ? stopLabel : startLabel}
    </button>
  );
}

const SIZES = [
  { value: "normal", label: "A", cls: "text-base" },
  { value: "large", label: "A", cls: "text-xl" },
  { value: "larger", label: "A", cls: "text-2xl" },
] as const;

export function TextSizeControl({
  action,
  current,
  label,
}: {
  action: (fd: FormData) => Promise<void>;
  current: string;
  label: string;
}) {
  return (
    <form action={action} className="flex items-center gap-2" aria-label={label}>
      <Type aria-hidden="true" size={22} />
      <span className="sr-only">{label}</span>
      <div className="flex rounded-full bg-card p-1 ring-1 ring-inset ring-ink/20">
        {SIZES.map((s, i) => (
          <button
            key={s.value}
            type="submit"
            name="size"
            value={s.value}
            aria-pressed={current === s.value}
            aria-label={["Normal text", "Large text", "Largest text"][i]}
            className={`grid size-12 place-items-center rounded-full font-semibold ${s.cls} ${current === s.value ? "bg-ink text-card" : "text-ink hover:bg-stage"}`}
          >
            {s.label}
          </button>
        ))}
      </div>
    </form>
  );
}

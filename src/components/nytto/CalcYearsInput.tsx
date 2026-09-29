import { useEffect, useState } from "react";
import { clampYears } from "@/lib/nyttokalkyl/calc";

export function CalcYearsInput({
  id,
  value,
  onCommit,
}: {
  id: string;
  value: number;
  onCommit: (n: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setDraft(String(value));
  }, [value, focused]);
  return (
    <input
      id={id}
      type="text"
      inputMode="numeric"
      placeholder="6"
      value={draft}
      onFocus={() => setFocused(true)}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, "").slice(0, 2);
        setDraft(digits);
        const n = Number(digits);
        if (digits !== "" && n >= 1 && n <= 15) onCommit(n);
      }}
      onBlur={() => {
        setFocused(false);
        const n = clampYears(Number(draft) || value);
        setDraft(String(n));
        onCommit(n);
      }}
      className="h-9 w-20 rounded-md border border-input bg-background px-3 text-sm"
    />
  );
}

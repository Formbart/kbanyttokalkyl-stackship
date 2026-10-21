import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, MessageCircle, Send, X } from "lucide-react";
import { toast } from "sonner";
import { useNyttokalkyl } from "@/lib/nyttokalkyl/store";
import type { ChatMessage } from "@/lib/nyttokalkyl/agent";
import { useCalculationAgent } from "@/hooks/useCalculationAgent";
import { FactCheckBadge } from "./shared";
import type { AppState } from "@/lib/nyttokalkyl/types";

export function ChatAssistant() {
  const callAgent = useCalculationAgent();
  const { state, setState } = useNyttokalkyl();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [factCheck, setFactCheck] = useState<{ factChecked?: boolean; report?: string }>({});
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [patch, setPatch] = useState<Partial<AppState> | null>(null);

  const send = async () => {
    const message = input.trim();
    if (!message) return;
    const prior = history;
    setHistory([...prior, { role: "user", content: message }]);
    setInput("");
    setLoading(true);
    const res = await callAgent<{
      reply?: string;
      suggestedPatch?: Partial<AppState> | null;
    }>("chat", { message, history: prior, fullState: state });
    setLoading(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    setFactCheck({ factChecked: res.factChecked, report: res.factCheckReport });
    const data = res.data ?? {};
    const reply = data.reply;
    if (reply) setHistory((h) => [...h, { role: "assistant", content: reply }]);
    setPatch(data.suggestedPatch ?? null);
  };

  const applyPatch = () => {
    if (!patch) return;
    setState((s) => ({
      ...s,
      ...patch,
      project: { ...s.project, ...(patch.project ?? {}) },
      costToday: { ...s.costToday, ...(patch.costToday ?? {}) },
      costChange: { ...s.costChange, ...(patch.costChange ?? {}) },
    }));
    setPatch(null);
    toast.success("Förslaget applicerades.");
  };

  if (!open) {
    return (
      <Button
        onClick={() => setOpen(true)}
        className="no-print fixed bottom-5 right-5 z-40 gap-2 rounded-full shadow-lg"
      >
        <MessageCircle className="size-4" />
        Fråga AI
      </Button>
    );
  }

  return (
    <div className="no-print surface-card fixed bottom-5 right-5 z-40 flex max-h-[70vh] w-[min(24rem,calc(100vw-2.5rem))] flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <p className="text-sm font-semibold">Fråga AI</p>
        <button
          type="button"
          aria-label="Stäng chatt"
          onClick={() => setOpen(false)}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3 text-sm">
        {history.length === 0 && (
          <p className="text-muted-foreground">
            Fråga om nyttor, kostnadsantaganden eller hur du tolkar resultatet.
          </p>
        )}
        {history.map((m, i) => (
          <div
            key={i}
            className={
              m.role === "user"
                ? "ml-auto max-w-[85%] rounded-2xl bg-brand px-3 py-2 text-primary-foreground"
                : "max-w-[90%] rounded-2xl bg-brand-soft px-3 py-2 text-brand-dark"
            }
          >
            {m.content}
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> AI tänker…
          </div>
        )}
        <FactCheckBadge {...factCheck} />
        {patch && (
          <Button size="sm" onClick={applyPatch}>
            Använd förslag
          </Button>
        )}
      </div>
      <div className="flex items-end gap-2 border-t border-border p-3">
        <Textarea
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Skriv din fråga…"
        />
        <Button
          size="icon"
          aria-label="Skicka"
          onClick={() => void send()}
          disabled={loading || !input.trim()}
        >
          <Send className="size-4" />
        </Button>
      </div>
    </div>
  );
}

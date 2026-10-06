"use client";

import { useState } from "react";
import { AlertCircle, ChevronRight, Footprints, Navigation } from "lucide-react";
import { cn } from "cn";

import { RouteMap } from "@/components/route-map";
import type { Message, Route } from "@/lib/types";

export function ChatMessage({ message }: { message: Message }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-3xl bg-muted px-4 py-2.5 whitespace-pre-wrap">{message.text}</div>
      </div>
    );
  }

  return (
    <div className="flex gap-4">
      <AgentAvatar />
      <div className="min-w-0 flex-1 space-y-3 pt-0.5">
        {message.steps && message.steps.length > 0 && (
          <Thoughts steps={message.steps} seconds={message.thoughtSeconds ?? 1} />
        )}

        {message.isError ? (
          <p className="flex items-center gap-2 text-destructive">
            <AlertCircle className="size-4 shrink-0" />
            {message.text}
          </p>
        ) : (
          <p className="leading-7 whitespace-pre-wrap">{message.text}</p>
        )}

        {message.route && <RouteCard route={message.route} />}
      </div>
    </div>
  );
}

// Shown while the agent is working
export function ThinkingMessage() {
  return (
    <div className="flex gap-4">
      <AgentAvatar />
      <p className="shimmer pt-1 text-sm font-medium">Thinking...</p>
    </div>
  );
}

function AgentAvatar() {
  return (
    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 ring-1 ring-emerald-500/30">
      <Navigation className="size-3.5 text-emerald-400" />
    </div>
  );
}

// Collapsible list of what the agent did
function Thoughts({ steps, seconds }: { steps: string[]; seconds: number }) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        Thought for {seconds}s
        <ChevronRight className={cn("size-4 transition-transform", open && "rotate-90")} />
      </button>

      {open && (
        <ol className="mt-2 space-y-2 border-l border-border pl-4">
          {steps.map((step) => (
            <li key={step} className="text-sm text-muted-foreground">
              {step}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function RouteCard({ route }: { route: Route }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <p className="truncate text-sm font-medium">
          {route.path[0]} → {route.path.at(-1)}
        </p>
        <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-300">
          <Footprints className="size-3.5" />
          {route.total_time} min walk
        </span>
      </div>
      <div className="px-2 py-3">
        <RouteMap route={route} />
      </div>
    </div>
  );
}

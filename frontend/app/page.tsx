"use client";

import { useRef, useState } from "react";
import { Radar } from "lucide-react";
import { cn } from "cn";

import { ChatPanel } from "@/components/chat-panel";
import { MonitorPanel } from "@/components/monitor-panel";
import { requestRoute } from "@/lib/api";
import type { Message, Role } from "@/lib/types";

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const nextId = useRef(0);

  const appendMessage = (role: Role, text: string, isError = false) => {
    setMessages((prev) => [...prev, { id: nextId.current++, role, text, isError }]);
  };

  const sendInstruction = async (instruction: string) => {
    const trimmed = instruction.trim();
    if (!trimmed || isLoading) return;

    appendMessage("user", trimmed);
    setIsLoading(true);

    try {
      appendMessage("agent", await requestRoute(trimmed));
    } catch (error) {
      appendMessage("agent", error instanceof Error ? error.message : "Something went wrong.", true);
    } finally {
      setIsLoading(false);
    }
  };

  const lastAgentMessage = messages.findLast((m) => m.role === "agent");

  return (
    <main className="flex min-h-dvh flex-col bg-background text-foreground lg:h-dvh">
      <Header isLoading={isLoading} />

      {/* Stacked on small screens, side by side on large screens */}
      <div className="grid flex-1 gap-4 p-4 sm:p-6 lg:min-h-0 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <ChatPanel messages={messages} isLoading={isLoading} onSend={(text) => void sendInstruction(text)} />
        <MonitorPanel isLoading={isLoading} lastAgentMessage={lastAgentMessage} />
      </div>
    </main>
  );
}

function Header({ isLoading }: { isLoading: boolean }) {
  return (
    <header className="flex items-center justify-between border-b border-border/60 px-4 py-3 sm:px-6">
      <div className="flex items-center gap-2.5">
        <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/10 ring-1 ring-emerald-500/30">
          <Radar className="size-4 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-sm font-semibold tracking-tight">Agentic Pathfinder</h1>
          <p className="text-xs text-muted-foreground">Campus routing agent</p>
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-full border border-border/60 px-3 py-1 text-xs text-muted-foreground">
        <span className="relative flex size-2">
          {isLoading && (
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-400 opacity-75" />
          )}
          <span className={cn("relative inline-flex size-2 rounded-full", isLoading ? "bg-amber-400" : "bg-emerald-400")} />
        </span>
        {isLoading ? "Calculating" : "Ready"}
      </div>
    </header>
  );
}

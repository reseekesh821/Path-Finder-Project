"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Bot, Loader2, MapPinned, Radar, SendHorizonal, User } from "lucide-react";
import { cn } from "cn";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";
// The backend may retry the agent up to 3 times, so allow well beyond one LLM round trip.
const REQUEST_TIMEOUT_MS = 90_000;

const BUILDINGS = ["Library", "Science Hall", "Student Union", "Engineering", "Admin Building", "Dormitory"];

const SUGGESTIONS = [
  "Fastest way from the Library to the Dormitory?",
  "How do I get from Engineering to the Admin Building?",
  "Route from Science Hall to the Student Union",
];

type Role = "user" | "agent";

type Message = {
  id: number;
  role: Role;
  text: string;
  isError?: boolean;
};

async function requestRoute(instruction: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/v1/route`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_instruction: instruction }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      throw new Error("The agent took too long to respond. Please try again.");
    }
    throw new Error(`Backend is offline. Make sure the API is running at ${API_URL}.`);
  }

  if (response.status === 429) {
    throw new Error("Rate limit reached (5 requests per minute). Please wait a moment and try again.");
  }
  if (response.status === 422) {
    throw new Error("That instruction couldn't be processed. Keep it between 1 and 500 characters.");
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(typeof body?.detail === "string" ? body.detail : `Request failed (HTTP ${response.status}).`);
  }

  const data: { calculated_route?: string } = await response.json();
  if (!data.calculated_route) {
    throw new Error("The agent returned an empty response.");
  }
  return data.calculated_route;
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const nextId = useRef(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isLoading]);

  const appendMessage = (role: Role, text: string, isError = false) => {
    setMessages((prev) => [...prev, { id: nextId.current++, role, text, isError }]);
  };

  const sendInstruction = async (instruction: string) => {
    const trimmed = instruction.trim();
    if (!trimmed || isLoading) return;

    appendMessage("user", trimmed);
    setInput("");
    setIsLoading(true);

    try {
      appendMessage("agent", await requestRoute(trimmed));
    } catch (error) {
      appendMessage("agent", error instanceof Error ? error.message : "Something went wrong.", true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void sendInstruction(input);
  };

  const lastAgentMessage = [...messages].reverse().find((m) => m.role === "agent");

  return (
    <main className="flex min-h-dvh flex-col bg-background text-foreground lg:h-dvh">
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
        <StatusPill isLoading={isLoading} />
      </header>

      <div className="grid flex-1 gap-4 p-4 sm:p-6 lg:min-h-0 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        {/* Left panel: chat */}
        <Card className="flex h-[70dvh] min-h-0 flex-col gap-0 py-0 lg:h-auto">
          <CardHeader className="border-b py-4">
            <CardTitle>Chat</CardTitle>
            <CardDescription>Ask for the fastest route between campus buildings.</CardDescription>
          </CardHeader>

          <ScrollArea className="min-h-0 flex-1">
            <div className="flex flex-col gap-4 p-4">
              {messages.length === 0 && !isLoading && (
                <EmptyState onPick={(text) => void sendInstruction(text)} />
              )}

              {messages.map((message) => (
                <ChatBubble key={message.id} message={message} />
              ))}

              {isLoading && (
                <div className="flex items-start gap-3">
                  <Avatar role="agent" />
                  <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm bg-muted px-3.5 py-2.5 text-sm text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin" />
                    Agent is calculating...
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </ScrollArea>

          <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t p-3">
            <Input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="e.g. Fastest way from the Library to the Dormitory?"
              maxLength={500}
              disabled={isLoading}
              aria-label="Routing instruction"
              className="h-10"
            />
            <Button type="submit" size="icon-lg" className="size-10" disabled={isLoading || !input.trim()} aria-label="Send">
              {isLoading ? <Loader2 className="animate-spin" /> : <SendHorizonal />}
            </Button>
          </form>
        </Card>

        {/* Right panel: monitor */}
        <Card className="flex min-h-[420px] flex-col gap-0 py-0 lg:min-h-0">
          <CardHeader className="border-b py-4">
            <CardTitle>Campus Map &amp; Agent State</CardTitle>
            <CardDescription>Live visualization coming soon.</CardDescription>
          </CardHeader>

          <CardContent className="relative flex flex-1 flex-col overflow-hidden p-0">
            <div
              aria-hidden
              className="absolute inset-0 opacity-60"
              style={{
                backgroundImage:
                  "linear-gradient(to right, rgb(255 255 255 / 0.05) 1px, transparent 1px), linear-gradient(to bottom, rgb(255 255 255 / 0.05) 1px, transparent 1px)",
                backgroundSize: "32px 32px",
                maskImage: "radial-gradient(ellipse at center, black 40%, transparent 80%)",
              }}
            />
            <div
              aria-hidden
              className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgb(16_185_129/0.12),transparent_60%)]"
            />
            <CornerBrackets />

            <div className="relative flex flex-1 flex-col items-center justify-center gap-5 p-8 text-center">
              <div className="relative flex size-24 items-center justify-center">
                <span
                  className={cn(
                    "absolute inset-0 rounded-full border border-emerald-400/30",
                    isLoading && "animate-ping"
                  )}
                />
                <span className="absolute inset-3 rounded-full border border-emerald-400/20" />
                <div className="flex size-14 items-center justify-center rounded-full bg-emerald-500/10 ring-1 ring-emerald-400/40 backdrop-blur">
                  <MapPinned className="size-6 text-emerald-400" />
                </div>
              </div>
              <div className="space-y-1">
                <p className="font-mono text-xs tracking-[0.2em] text-emerald-400/80 uppercase">
                  {isLoading ? "Tracking route" : "Monitor standby"}
                </p>
                <p className="max-w-sm text-sm text-muted-foreground">
                  Routes calculated by the agent will be visualized here.
                </p>
              </div>
              <div className="flex max-w-md flex-wrap justify-center gap-1.5">
                {BUILDINGS.map((building) => (
                  <span
                    key={building}
                    className="rounded-md border border-border/80 bg-background/60 px-2 py-1 font-mono text-[11px] text-muted-foreground backdrop-blur"
                  >
                    {building}
                  </span>
                ))}
              </div>
            </div>

            <div className="relative border-t border-border/60 bg-background/40 px-4 py-3 font-mono text-xs backdrop-blur">
              <span className="text-muted-foreground">calculated_route › </span>
              <span className={cn(lastAgentMessage?.isError ? "text-destructive" : "text-emerald-300/90")}>
                {lastAgentMessage?.text ?? "awaiting first query"}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function StatusPill({ isLoading }: { isLoading: boolean }) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-border/60 px-3 py-1 text-xs text-muted-foreground">
      <span className="relative flex size-2">
        {isLoading && <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-400 opacity-75" />}
        <span className={cn("relative inline-flex size-2 rounded-full", isLoading ? "bg-amber-400" : "bg-emerald-400")} />
      </span>
      {isLoading ? "Calculating" : "Ready"}
    </div>
  );
}

function Avatar({ role }: { role: Role }) {
  return (
    <div
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-full ring-1",
        role === "user" ? "bg-primary/10 ring-primary/20" : "bg-emerald-500/10 ring-emerald-500/30"
      )}
    >
      {role === "user" ? <User className="size-3.5" /> : <Bot className="size-3.5 text-emerald-400" />}
    </div>
  );
}

function ChatBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex items-start gap-3", isUser && "flex-row-reverse")}>
      <Avatar role={message.role} />
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
          isUser && "rounded-tr-sm bg-primary text-primary-foreground",
          !isUser && !message.isError && "rounded-tl-sm bg-muted",
          message.isError && "rounded-tl-sm border border-destructive/30 bg-destructive/10 text-destructive"
        )}
      >
        {message.text}
      </div>
    </div>
  );
}

function EmptyState({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="flex flex-col items-center gap-4 py-10 text-center">
      <div className="flex size-11 items-center justify-center rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/30">
        <Bot className="size-5 text-emerald-400" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium">Where do you need to go?</p>
        <p className="text-xs text-muted-foreground">Try one of these to get started.</p>
      </div>
      <div className="flex w-full flex-col gap-2">
        {SUGGESTIONS.map((suggestion) => (
          <Button
            key={suggestion}
            type="button"
            variant="outline"
            className="h-auto justify-start py-2 text-left whitespace-normal"
            onClick={() => onPick(suggestion)}
          >
            {suggestion}
          </Button>
        ))}
      </div>
    </div>
  );
}

function CornerBrackets() {
  const base = "absolute size-5 border-emerald-400/40";
  return (
    <div aria-hidden className="pointer-events-none absolute inset-4">
      <span className={cn(base, "top-0 left-0 border-t border-l")} />
      <span className={cn(base, "top-0 right-0 border-t border-r")} />
      <span className={cn(base, "bottom-0 left-0 border-b border-l")} />
      <span className={cn(base, "right-0 bottom-0 border-r border-b")} />
    </div>
  );
}

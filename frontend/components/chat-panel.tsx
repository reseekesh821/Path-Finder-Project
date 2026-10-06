"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Bot, Loader2, SendHorizonal, User } from "lucide-react";
import { cn } from "cn";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Message, Role } from "@/lib/types";

const SUGGESTIONS = [
  "Fastest way from the Library to the Dormitory?",
  "How do I get from Engineering to the Admin Building?",
  "Route from Science Hall to the Student Union",
];

type ChatPanelProps = {
  messages: Message[];
  isLoading: boolean;
  onSend: (text: string) => void;
};

export function ChatPanel({ messages, isLoading, onSend }: ChatPanelProps) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  // Keep the newest message in view.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isLoading]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSend(input);
    setInput("");
  };

  return (
    <Card className="flex h-[70dvh] min-h-0 flex-col gap-0 py-0 lg:h-auto">
      <CardHeader className="border-b py-4">
        <CardTitle>Chat</CardTitle>
        <CardDescription>Ask for the fastest route between campus buildings.</CardDescription>
      </CardHeader>

      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-4 p-4">
          {messages.length === 0 && !isLoading && <EmptyState onPick={onSend} />}

          {messages.map((message) => (
            <ChatBubble key={message.id} message={message} />
          ))}

          {isLoading && <LoadingBubble />}
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
        <Button
          type="submit"
          size="icon-lg"
          className="size-10"
          disabled={isLoading || !input.trim()}
          aria-label="Send"
        >
          {isLoading ? <Loader2 className="animate-spin" /> : <SendHorizonal />}
        </Button>
      </form>
    </Card>
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

function LoadingBubble() {
  return (
    <div className="flex items-start gap-3">
      <Avatar role="agent" />
      <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm bg-muted px-3.5 py-2.5 text-sm text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" />
        Agent is calculating...
      </div>
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

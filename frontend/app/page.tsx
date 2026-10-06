"use client";

import { useEffect, useRef, useState } from "react";
import { Map as MapIcon, Navigation, SquarePen } from "lucide-react";

import { CampusPicker } from "@/components/campus-picker";
import { ChatInput } from "@/components/chat-input";
import { ChatMessage, ThinkingMessage } from "@/components/chat-message";
import { Button } from "@/components/ui/button";
import { requestRoute } from "@/lib/api";
import type { Message } from "@/lib/types";

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isMapOpen, setIsMapOpen] = useState(false);
  const nextId = useRef(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Keep the newest message or the opened map in view
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isLoading, isMapOpen]);

  const appendMessage = (message: Omit<Message, "id">) => {
    setMessages((prev) => [...prev, { id: nextId.current++, ...message }]);
  };

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    appendMessage({ role: "user", text: trimmed });
    setIsLoading(true);
    const startedAt = performance.now();

    try {
      const { answer, route, steps } = await requestRoute(trimmed);
      const thoughtSeconds = Math.max(1, Math.round((performance.now() - startedAt) / 1000));
      appendMessage({ role: "agent", text: answer, route, steps, thoughtSeconds });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Something went wrong. Please try again.";
      appendMessage({ role: "agent", text: message, isError: true });
    } finally {
      setIsLoading(false);
    }
  };

  // Picking two buildings on the map sends the question for the user
  const askForRoute = (from: string, to: string) => {
    setIsMapOpen(false);
    void sendMessage(`Fastest route from ${from} to ${to}?`);
  };

  const startNewChat = () => {
    setMessages([]);
    setIsMapOpen(false);
  };

  const isEmpty = messages.length === 0 && !isLoading;

  return (
    <main className="flex h-dvh flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between px-4">
        <div className="flex items-center gap-2 font-semibold">
          <Navigation className="size-4 text-emerald-400" />
          Pathfinder
        </div>
        {!isEmpty && (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => setIsMapOpen((open) => !open)} aria-pressed={isMapOpen}>
              <MapIcon />
              Campus map
            </Button>
            <Button variant="ghost" size="sm" onClick={startNewChat} disabled={isLoading}>
              <SquarePen />
              New chat
            </Button>
          </div>
        )}
      </header>

      {isEmpty ? (
        // First screen with the greeting, the input and the campus map
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col justify-center gap-6 px-4 py-8">
            <div className="space-y-2 text-center">
              <h1 className="text-3xl font-semibold tracking-tight">Where do you want to go?</h1>
              <p className="text-muted-foreground">
                Ask in your own words or tap two buildings on the map.
              </p>
            </div>
            <ChatInput disabled={isLoading} onSend={(text) => void sendMessage(text)} />
            <CampusPicker disabled={isLoading} onPick={askForRoute} />
          </div>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto">
            <div className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-6">
              {messages.map((message) => (
                <ChatMessage key={message.id} message={message} />
              ))}
              {isLoading && <ThinkingMessage />}
              {/* The map sits at the end of the conversation so it never covers a message */}
              {isMapOpen && (
                <CampusPicker disabled={isLoading} onPick={askForRoute} onClose={() => setIsMapOpen(false)} />
              )}
              <div ref={bottomRef} />
            </div>
          </div>
          <div className="mx-auto w-full max-w-3xl shrink-0 px-4 pb-4">
            <ChatInput disabled={isLoading} onSend={(text) => void sendMessage(text)} />
          </div>
        </>
      )}
    </main>
  );
}

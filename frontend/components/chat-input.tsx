"use client";

import { FormEvent, KeyboardEvent, useState } from "react";
import { ArrowUp } from "lucide-react";

import { Button } from "@/components/ui/button";

type ChatInputProps = {
  disabled: boolean;
  onSend: (text: string) => void;
};

export function ChatInput({ disabled, onSend }: ChatInputProps) {
  const [value, setValue] = useState("");
  const canSend = !disabled && value.trim().length > 0;

  const send = () => {
    if (!canSend) return;
    onSend(value);
    setValue("");
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    send();
  };

  // Enter sends the message and Shift Enter adds a new line
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-end gap-2 rounded-3xl border border-border bg-card p-2 pl-5 shadow-lg shadow-black/20 focus-within:border-ring"
    >
      <textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="e.g. Library to Dormitory"
        maxLength={500}
        rows={1}
        aria-label="Message"
        className="field-sizing-content max-h-40 min-h-9 flex-1 resize-none bg-transparent py-1.5 outline-none placeholder:text-muted-foreground"
      />
      <Button type="submit" size="icon-lg" className="size-9 rounded-full" disabled={!canSend} aria-label="Send">
        <ArrowUp className="size-4" />
      </Button>
    </form>
  );
}

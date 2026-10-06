"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { RouteMap } from "@/components/route-map";

type CampusPickerProps = {
  disabled: boolean;
  onPick: (from: string, to: string) => void;
  onClose?: () => void;
};

// Campus map where the user taps a start and a destination to ask for a route
export function CampusPicker({ disabled, onPick, onClose }: CampusPickerProps) {
  const [start, setStart] = useState<string | null>(null);

  const handleSelect = (name: string) => {
    if (disabled) return;
    if (!start) {
      setStart(name);
    } else if (name === start) {
      setStart(null);
    } else {
      onPick(start, name);
      setStart(null);
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
        <p className="text-sm text-muted-foreground">
          {start ? (
            <>
              From <span className="font-medium text-foreground">{start}</span>, now tap where you want to go
            </>
          ) : (
            "Tap two buildings to get a route"
          )}
        </p>
        <div className="flex items-center gap-1">
          {start && (
            <button
              type="button"
              onClick={() => setStart(null)}
              className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              Clear
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close map"
              className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>
      <div className="px-2 py-3">
        <RouteMap selected={start} onSelect={handleSelect} />
      </div>
    </div>
  );
}

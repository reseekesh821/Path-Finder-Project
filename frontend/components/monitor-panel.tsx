import { MapPinned } from "lucide-react";
import { cn } from "cn";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Message } from "@/lib/types";

const BUILDINGS = ["Library", "Science Hall", "Student Union", "Engineering", "Admin Building", "Dormitory"];

const GRID_BACKGROUND = {
  backgroundImage:
    "linear-gradient(to right, rgb(255 255 255 / 0.05) 1px, transparent 1px), linear-gradient(to bottom, rgb(255 255 255 / 0.05) 1px, transparent 1px)",
  backgroundSize: "32px 32px",
  maskImage: "radial-gradient(ellipse at center, black 40%, transparent 80%)",
};

type MonitorPanelProps = {
  isLoading: boolean;
  lastAgentMessage?: Message;
};

/** Placeholder for the future campus map. Shows agent status and the latest answer. */
export function MonitorPanel({ isLoading, lastAgentMessage }: MonitorPanelProps) {
  return (
    <Card className="flex min-h-[420px] flex-col gap-0 py-0 lg:min-h-0">
      <CardHeader className="border-b py-4">
        <CardTitle>Campus Map &amp; Agent State</CardTitle>
        <CardDescription>Live visualization coming soon.</CardDescription>
      </CardHeader>

      <CardContent className="relative flex flex-1 flex-col overflow-hidden p-0">
        {/* Background: faint grid with a green glow in the middle */}
        <div aria-hidden className="absolute inset-0 opacity-60" style={GRID_BACKGROUND} />
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgb(16_185_129/0.12),transparent_60%)]"
        />
        <CornerBrackets />

        <div className="relative flex flex-1 flex-col items-center justify-center gap-5 p-8 text-center">
          <RadarIcon isActive={isLoading} />

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
          <span className={lastAgentMessage?.isError ? "text-destructive" : "text-emerald-300/90"}>
            {lastAgentMessage?.text ?? "awaiting first query"}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function RadarIcon({ isActive }: { isActive: boolean }) {
  return (
    <div className="relative flex size-24 items-center justify-center">
      <span className={cn("absolute inset-0 rounded-full border border-emerald-400/30", isActive && "animate-ping")} />
      <span className="absolute inset-3 rounded-full border border-emerald-400/20" />
      <div className="flex size-14 items-center justify-center rounded-full bg-emerald-500/10 ring-1 ring-emerald-400/40 backdrop-blur">
        <MapPinned className="size-6 text-emerald-400" />
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

import { KeyboardEvent } from "react";
import { cn } from "cn";

import { BUILDINGS, PATHS } from "@/lib/campus";
import type { Route } from "@/lib/types";

const position = Object.fromEntries(BUILDINGS.map((b) => [b.name, b]));

// Same key in both directions, because paths work both ways
const edgeKey = (a: string, b: string) => [a, b].sort().join("|");

const LABEL_OFFSET = {
  above: { dx: 0, dy: -22, anchor: "middle" },
  below: { dx: 0, dy: 30, anchor: "middle" },
  right: { dx: 16, dy: 5, anchor: "start" },
} as const;

type RouteMapProps = {
  // The route to highlight, or nothing to show the whole campus
  route?: Route | null;
  // A building the user has picked on the map
  selected?: string | null;
  // When given, buildings can be clicked
  onSelect?: (name: string) => void;
};

// Campus map that can show a route and let the user pick buildings
export function RouteMap({ route, selected, onSelect }: RouteMapProps) {
  const path = route?.path ?? [];
  const routeEdges = new Set(path.slice(1).map((name, i) => edgeKey(path[i], name)));
  const start = path[0];
  const end = path.at(-1);

  return (
    <svg
      viewBox="0 30 600 340"
      className="w-full select-none"
      role="img"
      aria-label={route ? `Map of the route from ${start} to ${end}` : "Campus map"}
    >
      {PATHS.map(([a, b, minutes]) => {
        const from = position[a];
        const to = position[b];
        const active = routeEdges.has(edgeKey(a, b));
        const midX = (from.x + to.x) / 2;
        const midY = (from.y + to.y) / 2;
        // With a route only its own minutes show, without one every path shows its minutes
        const showMinutes = active || !route;
        return (
          <g key={edgeKey(a, b)}>
            <line
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              strokeLinecap="round"
              strokeWidth={active ? 3 : 1.5}
              className={active ? "stroke-emerald-400" : "stroke-white/15"}
            />
            {showMinutes && (
              <>
                <rect
                  x={midX - 14}
                  y={midY - 9}
                  width={28}
                  height={18}
                  rx={9}
                  className={cn("fill-card", active ? "stroke-emerald-400/60" : "stroke-white/10")}
                />
                <text
                  x={midX}
                  y={midY}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className={cn("font-mono text-[10px]", active ? "fill-emerald-300" : "fill-muted-foreground")}
                >
                  {minutes}m
                </text>
              </>
            )}
          </g>
        );
      })}

      {BUILDINGS.map(({ name, x, y, label }) => {
        const onRoute = path.includes(name);
        const isPicked = name === selected;
        const hasRing = name === start || name === end || isPicked;
        const isLit = onRoute || isPicked;
        const offset = LABEL_OFFSET[label];

        const handleKeyDown = (event: KeyboardEvent<SVGGElement>) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onSelect?.(name);
          }
        };

        return (
          <g
            key={name}
            className={cn(onSelect && "group cursor-pointer outline-none")}
            onClick={onSelect ? () => onSelect(name) : undefined}
            onKeyDown={onSelect ? handleKeyDown : undefined}
            role={onSelect ? "button" : undefined}
            tabIndex={onSelect ? 0 : undefined}
            aria-label={onSelect ? name : undefined}
            aria-pressed={onSelect ? isPicked : undefined}
          >
            {/* Bigger invisible circle so the building is easy to click */}
            {onSelect && <circle cx={x} cy={y} r={24} className="fill-transparent" />}
            {hasRing && <circle cx={x} cy={y} r={14} className="fill-emerald-400/15 stroke-emerald-400/40" />}
            <circle
              cx={x}
              cy={y}
              r={hasRing ? 7 : 6}
              className={cn(
                "transition-colors",
                isLit ? "fill-emerald-400" : "fill-neutral-500",
                onSelect && "group-hover:fill-emerald-300 group-focus-visible:fill-emerald-300"
              )}
            />
            <text
              x={x + offset.dx}
              y={y + offset.dy}
              textAnchor={offset.anchor}
              className={cn(
                "text-[13px] transition-colors",
                isLit ? "fill-foreground font-medium" : "fill-muted-foreground",
                onSelect && "group-hover:fill-foreground"
              )}
            >
              {name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

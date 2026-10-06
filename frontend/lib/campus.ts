// Map layout for the campus
// The paths and minutes must match CAMPUS_EDGES in app/core/tools.py

export type Building = {
  name: string;
  x: number;
  y: number;
  // Where the name sits next to the dot, picked so it never covers a path
  label: "above" | "below" | "right";
};

export const BUILDINGS: Building[] = [
  { name: "Science Hall", x: 300, y: 70, label: "above" },
  { name: "Library", x: 110, y: 170, label: "above" },
  { name: "Engineering", x: 500, y: 150, label: "above" },
  { name: "Student Union", x: 290, y: 215, label: "right" },
  { name: "Admin Building", x: 140, y: 330, label: "below" },
  { name: "Dormitory", x: 460, y: 320, label: "below" },
];

export const PATHS: [string, string, number][] = [
  ["Library", "Science Hall", 4],
  ["Library", "Student Union", 3],
  ["Library", "Admin Building", 6],
  ["Science Hall", "Engineering", 5],
  ["Science Hall", "Student Union", 2],
  ["Student Union", "Dormitory", 7],
  ["Student Union", "Admin Building", 4],
  ["Engineering", "Dormitory", 3],
  ["Admin Building", "Dormitory", 8],
];

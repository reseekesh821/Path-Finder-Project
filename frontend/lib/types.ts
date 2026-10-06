export type Role = "user" | "agent";

export type Route = {
  path: string[];
  total_time: number;
};

export type Message = {
  id: number;
  role: Role;
  text: string;
  isError?: boolean;
  route?: Route | null;
  steps?: string[];
  thoughtSeconds?: number;
};

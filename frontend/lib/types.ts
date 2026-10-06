export type Role = "user" | "agent";

export type Message = {
  id: number;
  role: Role;
  text: string;
  isError?: boolean;
};

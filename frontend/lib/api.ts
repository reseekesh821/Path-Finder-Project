import type { Route } from "@/lib/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

// The backend can retry the agent up to 3 times, so allow plenty of time
const REQUEST_TIMEOUT_MS = 90_000;

export type AgentReply = {
  answer: string;
  route: Route | null;
  steps: string[];
};

// Send a message to the agent and return its reply, or throw a friendly error
export async function requestRoute(instruction: string): Promise<AgentReply> {
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
      throw new Error("That took too long. Please try again.");
    }
    throw new Error("I can't connect right now. Please try again in a moment.");
  }

  if (response.status === 429) {
    throw new Error("You're sending messages a little too fast. Please wait a minute and try again.");
  }
  if (response.status === 422) {
    throw new Error("Please keep your message under 500 characters.");
  }
  if (!response.ok) {
    throw new Error("Something went wrong. Please try again.");
  }

  const data: { calculated_route?: string; route?: Route | null; steps?: string[] } = await response.json();
  if (!data.calculated_route) {
    throw new Error("Something went wrong. Please try again.");
  }
  return { answer: data.calculated_route, route: data.route ?? null, steps: data.steps ?? [] };
}

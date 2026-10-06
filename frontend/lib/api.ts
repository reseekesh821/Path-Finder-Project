const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

// The backend can retry the agent up to 3 times, so allow plenty of time.
const REQUEST_TIMEOUT_MS = 90_000;

/** Send an instruction to the agent and return its answer, or throw a user-friendly error. */
export async function requestRoute(instruction: string): Promise<string> {
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
      throw new Error("The agent took too long to respond. Please try again.");
    }
    throw new Error(`Backend is offline. Make sure the API is running at ${API_URL}.`);
  }

  if (response.status === 429) {
    throw new Error("Rate limit reached (5 requests per minute). Please wait a moment and try again.");
  }
  if (response.status === 422) {
    throw new Error("That instruction couldn't be processed. Keep it between 1 and 500 characters.");
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(typeof body?.detail === "string" ? body.detail : `Request failed (HTTP ${response.status}).`);
  }

  const data: { calculated_route?: string } = await response.json();
  if (!data.calculated_route) {
    throw new Error("The agent returned an empty response.");
  }
  return data.calculated_route;
}

"""HTTP API for the campus pathfinder agent.

Request lifecycle:

    POST /api/v1/route
      -> rate limiter (reject with 429 before any LLM work is done)
      -> Pydantic validation (reject malformed bodies with 422)
      -> execute_graph (retried on transient failures)
      -> 200 JSON response, or a sanitized 500 if every retry fails
"""

import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from langgraph.errors import GraphRecursionError
from pydantic import BaseModel, ConfigDict, Field
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from tenacity import (
    before_sleep_log,
    retry,
    retry_if_not_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from app.agent.graph import pathfinder_app

logger = logging.getLogger(__name__)

FRIENDLY_ERROR = "Something went wrong while calculating your route. Please try again later."

# Max graph steps per request. A normal query takes 3 (agent -> tools -> agent);
# this leaves room for a corrected retry while stopping a model stuck in a loop.
GRAPH_RECURSION_LIMIT = 10

# Rate limiting: each request can trigger several LLM calls, so the agent is by
# far the most expensive thing this service does. Limiting per client IP caps
# how much compute a single caller can consume.
#
# Counters live in process memory: each worker process keeps its own counts,
# and they reset on restart. Run multiple workers behind a shared store (e.g.
# Redis via `storage_uri`) if the limit must be global. Behind a reverse proxy,
# `get_remote_address` sees the proxy's IP, so forwarded headers must be
# trusted (e.g. uvicorn `--proxy-headers`) for per-client limits to work.
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(title="Campus Pathfinder API")
app.state.limiter = limiter
# Turns RateLimitExceeded into a 429 response instead of letting it reach the
# catch-all 500 handler below.
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
# Browsers treat localhost and 127.0.0.1 as different origins, so allow both.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class RouteRequest(BaseModel):
    # Stripped first so whitespace-only input fails min_length instead of reaching the LLM.
    model_config = ConfigDict(str_strip_whitespace=True)

    # Bounded so a single request cannot push an arbitrarily large prompt into the LLM.
    user_instruction: str = Field(min_length=1, max_length=500)


class RouteResponse(BaseModel):
    calculated_route: str


# Retry: local LLM calls fail transiently (Ollama still loading the model, a
# dropped connection, a timeout). Exponential backoff waits 1s, then 2s, giving
# the model server time to recover instead of hitting it again immediately.
# The worst case is 3 full graph runs, so the 5/minute rate limit above caps
# load at 15 graph runs per client per minute.
#
# reraise=True surfaces the original exception after the last attempt (rather
# than tenacity's RetryError), so logs show the real root cause.
#
# GraphRecursionError is not transient: a model that looped once will very
# likely loop again, so retrying would only triple the wasted LLM calls.
@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=1, max=4),
    retry=retry_if_not_exception_type(GraphRecursionError),
    before_sleep=before_sleep_log(logger, logging.WARNING),
    reraise=True,
)
async def execute_graph(instruction: str) -> str:
    final_state = await pathfinder_app.ainvoke(
        {"messages": [("user", instruction)]},
        config={"recursion_limit": GRAPH_RECURSION_LIMIT},
    )
    return final_state["calculated_route"]


# `request: Request` is required by slowapi to resolve the client IP.
@app.post("/api/v1/route", response_model=RouteResponse)
@limiter.limit("5/minute")
async def route(request: Request, payload: RouteRequest) -> RouteResponse | JSONResponse:
    # Agent failures are converted to a 500 here rather than left to the global
    # handler: Starlette runs `Exception` handlers outside all middleware, so
    # that response would lack CORS headers and the browser would hide it,
    # making the frontend report "Backend is offline" instead of this message.
    try:
        calculated_route = await execute_graph(payload.user_instruction)
    except Exception:
        logger.exception("Agent failed for %s %s", request.method, request.url.path)
        return JSONResponse(status_code=500, content={"detail": FRIENDLY_ERROR})
    return RouteResponse(calculated_route=calculated_route)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    # Last-resort safety net for errors outside the route handler. Full details
    # go to the server log; the client gets a generic message so internal
    # errors (stack traces, model names, hostnames) are never leaked.
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": FRIENDLY_ERROR})

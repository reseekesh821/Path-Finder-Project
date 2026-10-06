"""FastAPI server that exposes the agent at POST /api/v1/route."""

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

# A normal question takes 3 steps (agent -> tools -> agent); stop runaway loops.
GRAPH_RECURSION_LIMIT = 10


# --- App setup ---------------------------------------------------------------

# Each request can trigger several LLM calls, so limit how often one IP can call.
# Counts are kept in memory, per process.
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(title="Campus Pathfinder API")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Browsers treat localhost and 127.0.0.1 as different origins, so allow both.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Request / response models -----------------------------------------------

class RouteRequest(BaseModel):
    # Strip spaces first, so blank input is rejected instead of reaching the LLM.
    model_config = ConfigDict(str_strip_whitespace=True)

    user_instruction: str = Field(min_length=1, max_length=500)


class RouteResponse(BaseModel):
    calculated_route: str


# --- Agent call --------------------------------------------------------------

# Retry up to 3 times, waiting 1s then 2s, to ride out Ollama hiccups.
# A run that hit the step limit is not retried; it would just loop again.
# reraise=True keeps the original error in the logs.
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


# --- Routes ------------------------------------------------------------------

# slowapi needs the `request` argument to find the client's IP.
@app.post("/api/v1/route", response_model=RouteResponse)
@limiter.limit("5/minute")
async def route(request: Request, payload: RouteRequest) -> RouteResponse | JSONResponse:
    # Errors are handled here, not by the global handler below: that handler's
    # response skips CORS, so the browser would hide it from the frontend.
    try:
        calculated_route = await execute_graph(payload.user_instruction)
    except Exception:
        logger.exception("Agent failed for %s %s", request.method, request.url.path)
        return JSONResponse(status_code=500, content={"detail": FRIENDLY_ERROR})

    return RouteResponse(calculated_route=calculated_route)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    # Safety net for anything else. Details go to the log, never to the client.
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": FRIENDLY_ERROR})

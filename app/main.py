"""FastAPI server for the campus pathfinder agent"""

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

from app.agent.graph import pathfinder_app, thinking_steps
from app.core.tools import RouteResult

logger = logging.getLogger(__name__)

FRIENDLY_ERROR = "Something went wrong while calculating your route. Please try again later."

# A normal question needs 3 graph steps, so 10 is enough and stops endless loops
GRAPH_RECURSION_LIMIT = 10


# App setup

# Limit how often one IP can call, because each request can run several LLM calls
# The counts live in memory for each server process
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(title="Campus Pathfinder API")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Browsers treat localhost and 127.0.0.1 as different sites, so allow both
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request and response models

class RouteRequest(BaseModel):
    # Remove extra spaces first, so blank input is rejected before it reaches the LLM
    model_config = ConfigDict(str_strip_whitespace=True)

    user_instruction: str = Field(min_length=1, max_length=500)


class RouteResponse(BaseModel):
    calculated_route: str
    # Path and minutes used to draw the map, empty when there is no route
    route: RouteResult | None = None
    # Plain English list of what the agent did, shown as its thinking
    steps: list[str] = []


# Agent call

# Retry up to 3 times with a short wait, to ride out Ollama hiccups
# Do not retry when the step limit was hit, because it would just loop again
# reraise keeps the original error in the logs
@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=1, max=4),
    retry=retry_if_not_exception_type(GraphRecursionError),
    before_sleep=before_sleep_log(logger, logging.WARNING),
    reraise=True,
)
async def execute_graph(instruction: str) -> RouteResponse:
    final_state = await pathfinder_app.ainvoke(
        {"messages": [("user", instruction)]},
        config={"recursion_limit": GRAPH_RECURSION_LIMIT},
    )
    return RouteResponse(
        calculated_route=final_state["calculated_route"],
        route=final_state.get("route"),
        steps=thinking_steps(final_state["messages"]),
    )


# Routes

# slowapi needs the request argument to find the client IP
@app.post("/api/v1/route", response_model=RouteResponse)
@limiter.limit("5/minute")
async def route(request: Request, payload: RouteRequest) -> RouteResponse | JSONResponse:
    # Handle errors here instead of in the global handler below
    # The global handler skips CORS, so the browser would hide its message
    try:
        return await execute_graph(payload.user_instruction)
    except Exception:
        logger.exception("Agent failed for %s %s", request.method, request.url.path)
        return JSONResponse(status_code=500, content={"detail": FRIENDLY_ERROR})


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    # Safety net for any other error. Details go to the log and never to the client
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": FRIENDLY_ERROR})

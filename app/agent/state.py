"""State shared by every node in the agent graph."""

from operator import add
from typing import Annotated, TypedDict

from langchain_core.messages import AnyMessage


class AgentState(TypedDict):
    """The graph's 'clipboard': each node reads it and returns updates to it."""

    # New messages are appended to the list (via `add`), never replacing it.
    messages: Annotated[list[AnyMessage], add]

    # The agent's final answer, saved when it stops calling tools.
    calculated_route: str

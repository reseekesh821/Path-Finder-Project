"""State shared by every node in the agent graph"""

from operator import add
from typing import Annotated, TypedDict

from langchain_core.messages import AnyMessage

from app.core.tools import RouteResult


class AgentState(TypedDict):
    """The graph clipboard that every node reads and updates"""

    # New messages are added to the end of the list instead of replacing it
    messages: Annotated[list[AnyMessage], add]

    # The agent's final answer, saved when it stops calling tools
    calculated_route: str

    # The route behind that answer with its path and minutes, or None
    route: RouteResult | None

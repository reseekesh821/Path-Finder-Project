from operator import add
from typing import Annotated, TypedDict

from langchain_core.messages import AnyMessage


class AgentState(TypedDict):
    """Shared state 'clipboard' for the graph.

    Every node reads from this state and returns partial updates to it;
    LangGraph merges those updates before passing the state to the next node.
    """

    # `add` reducer: updates are concatenated onto the existing list instead of replacing it.
    messages: Annotated[list[AnyMessage], add]
    # The agent's final text answer (written when it stops calling tools); overwritten on each update.
    calculated_route: str

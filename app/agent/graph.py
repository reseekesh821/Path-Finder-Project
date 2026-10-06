"""LangGraph wiring for the campus pathfinder agent.

Control flow (a ReAct loop with an invalid-building exit):

    START -> agent --(LLM requested a tool call)--> tools --(valid buildings)--> agent -> ...
                   |                                      \\--(unknown building)--> reject_invalid_building -> END
                   \\--(LLM replied with plain text)--> END

The agent node decides; the tools node executes. The loop repeats until the
LLM answers without requesting a tool, at which point the graph ends.
"""

from langchain_core.messages import AIMessage, SystemMessage
from langchain_ollama import ChatOllama
from langgraph.graph import END, StateGraph
from langgraph.prebuilt import ToolNode, tools_condition

from app.agent.state import AgentState
from app.core.tools import CAMPUS_GRAPH, calculate_route, resolve_building

tools = [calculate_route]

# Must be the exact local tag: Ollama resolves a bare "llama3.1" to
# "llama3.1:latest", which is not pulled on this machine.
#
# temperature=0 makes tool-call arguments and answers repeatable, which matters
# more than creative phrasing for a routing assistant.
llm = ChatOllama(model="llama3.1:8b", temperature=0)
# Sends the tool's JSON schema with every request, so the LLM can answer with
# a structured tool call instead of guessing a route.
llm_with_tools = llm.bind_tools(tools)

# Guardrail: the tool's docstring lists the valid buildings, but on its own the
# model will silently swap an unknown building for a valid one and return a
# plausible but wrong route. This prompt forbids substitution outright, and
# forbids answering from memory so every route and time comes from Dijkstra.
SYSTEM_PROMPT = SystemMessage(
    content=(
        "You are a strict routing assistant. You must ONLY use the valid buildings. "
        "If a user asks for a building that does not exist, explicitly tell them it is invalid. "
        "DO NOT invent or substitute buildings. "
        "Whenever the user asks for a route or travel time, call the calculate_route tool; "
        "never guess paths or travel times yourself. "
        "If the user is not asking for a route, do not call any tool: briefly explain that you find "
        "the fastest walking route between two campus buildings."
    )
)


def agent(state: AgentState) -> dict:
    """Ask the LLM for the next step given the full conversation so far."""
    # Prepended per call rather than stored in state, so it is always first and
    # is not appended again by the `add` reducer on every loop iteration.
    response = llm_with_tools.invoke([SYSTEM_PROMPT, *state["messages"]])

    # Returned as a list so the `add` reducer appends it to `messages`.
    update: dict = {"messages": [response]}

    # No tool calls means tools_condition will route to END, so this is the
    # final answer; persist it so callers can read it without parsing messages.
    if not response.tool_calls:
        update["calculated_route"] = response.content

    return update


def _invalid_buildings(state: AgentState) -> list[str]:
    """Building names in the most recent tool call that are not on the campus graph."""
    last_call = next(m for m in reversed(state["messages"]) if isinstance(m, AIMessage) and m.tool_calls)
    names = [
        call["args"][key]
        for call in last_call.tool_calls
        for key in ("start_node", "end_node")
        if isinstance(call["args"].get(key), str)
    ]
    return list(dict.fromkeys(name for name in names if resolve_building(name) is None))


def route_after_tools(state: AgentState) -> str:
    # Guardrail: once the tool has rejected a building, handing control back to
    # the LLM lets it "helpfully" invent a route for some other building (it
    # did, with fake street directions, despite the system prompt). Ending
    # deterministically is the only way to guarantee no substitution.
    return "reject_invalid_building" if _invalid_buildings(state) else "agent"


def reject_invalid_building(state: AgentState) -> dict:
    names = _invalid_buildings(state)
    invalid = " and ".join(f'"{name}"' for name in names)
    verb = "is not a valid campus building" if len(names) == 1 else "are not valid campus buildings"
    valid = ", ".join(sorted(CAMPUS_GRAPH.nodes))
    text = f"Sorry, {invalid} {verb}. Valid buildings are: {valid}."
    return {"messages": [AIMessage(content=text)], "calculated_route": text}


workflow = StateGraph(AgentState)

workflow.add_node("agent", agent)
# Runs every tool call on the latest AIMessage and appends the results as
# ToolMessages. ValueErrors (unknown building, no route) are returned to the
# LLM as tool output so it can correct itself instead of crashing the graph.
workflow.add_node("tools", ToolNode(tools, handle_tool_errors=ValueError))
workflow.add_node("reject_invalid_building", reject_invalid_building)

workflow.set_entry_point("agent")

# tools_condition inspects the last message: if it contains tool calls it
# returns "tools", otherwise END. The node must be named "tools" for this.
workflow.add_conditional_edges("agent", tools_condition)

# After a successful tool run, return to the agent so it can read the result
# and write the final answer. Unknown buildings exit via the rejection node.
workflow.add_conditional_edges("tools", route_after_tools, ["agent", "reject_invalid_building"])
workflow.add_edge("reject_invalid_building", END)

pathfinder_app = workflow.compile()

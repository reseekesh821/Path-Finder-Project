"""The LangGraph agent that answers routing questions

The agent node asks the LLM what to do. If the LLM wants a route, the tools node runs it.
When the buildings are valid, the agent writes the final answer and the graph ends.
When a building does not exist, the graph ends with a fixed reply instead.
"""

import json

from langchain_core.messages import AIMessage, SystemMessage, ToolMessage
from langchain_ollama import ChatOllama
from langgraph.graph import END, StateGraph
from langgraph.prebuilt import ToolNode, tools_condition

from app.agent.state import AgentState
from app.core.tools import CAMPUS_GRAPH, RouteResult, calculate_route, resolve_building

# Model setup

tools = [calculate_route]

# Use the exact model tag, because plain llama3.1 points to a version that is not installed
# Temperature 0 keeps tool calls and answers consistent between runs
llm = ChatOllama(model="llama3.1:8b", temperature=0)
llm_with_tools = llm.bind_tools(tools)

# Stops the model from inventing buildings or guessing routes from memory
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


# Graph nodes

def agent(state: AgentState) -> dict:
    """Ask the LLM what to do next, given the conversation so far"""
    # Added on every call instead of saved in state, so it is never duplicated
    response = llm_with_tools.invoke([SYSTEM_PROMPT, *state["messages"]])
    update: dict = {"messages": [response]}

    # No tool call means this is the final answer
    if not response.tool_calls:
        update["calculated_route"] = response.content
        update["route"] = _latest_route(state)

    return update


def reject_invalid_building(state: AgentState) -> dict:
    """Reply with a fixed message listing the valid buildings"""
    names = _invalid_buildings(state)
    invalid = " and ".join(f'"{name}"' for name in names)
    verb = "is not a valid campus building" if len(names) == 1 else "are not valid campus buildings"
    valid = ", ".join(sorted(CAMPUS_GRAPH.nodes))

    text = f"Sorry, {invalid} {verb}. Valid buildings are: {valid}."
    return {"messages": [AIMessage(content=text)], "calculated_route": text, "route": None}


# Helpers

def _latest_route(state: AgentState) -> RouteResult | None:
    """The latest successful tool result, if the trip has at least 2 buildings"""
    for message in reversed(state["messages"]):
        if isinstance(message, ToolMessage) and message.status != "error":
            route = json.loads(message.content)
            return route if len(route["path"]) > 1 else None
    return None


def _invalid_buildings(state: AgentState) -> list[str]:
    """Building names from the latest tool call that are not on the campus map"""
    last_call = next(m for m in reversed(state["messages"]) if isinstance(m, AIMessage) and m.tool_calls)
    names = [
        call["args"][key]
        for call in last_call.tool_calls
        for key in ("start_node", "end_node")
        if isinstance(call["args"].get(key), str)
    ]
    return list(dict.fromkeys(name for name in names if resolve_building(name) is None))


# Routing

def route_after_tools(state: AgentState) -> str:
    # End here if a building was invalid
    # Going back to the LLM lets it invent a route for another building, even with the system prompt
    return "reject_invalid_building" if _invalid_buildings(state) else "agent"


# Thinking steps

def thinking_steps(messages: list) -> list[str]:
    """Plain English summary of what the agent did, shown as its thinking in the UI"""
    steps: list[str] = []
    for message in messages:
        if isinstance(message, AIMessage) and message.tool_calls:
            for call in message.tool_calls:
                start, end = call["args"].get("start_node", ""), call["args"].get("end_node", "")
                unknown = [name for name in (start, end) if resolve_building(name) is None]
                if unknown:
                    steps.append(f'Checked the campus map: "{unknown[0]}" is not a campus building')
                elif resolve_building(start) != resolve_building(end):
                    steps.append(f"Looking up the fastest route from {resolve_building(start)} to {resolve_building(end)}")

        elif isinstance(message, ToolMessage) and message.status != "error":
            route = json.loads(message.content)
            if len(route["path"]) > 1:
                steps.append(f"Found {' → '.join(route['path'])} ({route['total_time']} min)")

    if steps:
        steps.append("Writing the answer")
    return steps


# Graph wiring

workflow = StateGraph(AgentState)

workflow.add_node("agent", agent)
# Tool errors like an unknown building come back as messages instead of crashing
workflow.add_node("tools", ToolNode(tools, handle_tool_errors=ValueError))
workflow.add_node("reject_invalid_building", reject_invalid_building)

workflow.set_entry_point("agent")
# tools_condition sends tool calls to the tools node and everything else to END
workflow.add_conditional_edges("agent", tools_condition)
workflow.add_conditional_edges("tools", route_after_tools, ["agent", "reject_invalid_building"])
workflow.add_edge("reject_invalid_building", END)

pathfinder_app = workflow.compile()

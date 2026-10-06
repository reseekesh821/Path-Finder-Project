"""Campus map and the shortest route tool used by the agent"""

from typing import TypedDict

import networkx as nx


class RouteResult(TypedDict):
    path: list[str]
    total_time: int


# Campus map

# Each entry is two buildings and the walking minutes between them. Paths work both ways
CAMPUS_EDGES: list[tuple[str, str, int]] = [
    ("Library", "Science Hall", 4),
    ("Library", "Student Union", 3),
    ("Library", "Admin Building", 6),
    ("Science Hall", "Engineering", 5),
    ("Science Hall", "Student Union", 2),
    ("Student Union", "Dormitory", 7),
    ("Student Union", "Admin Building", 4),
    ("Engineering", "Dormitory", 3),
    ("Admin Building", "Dormitory", 8),
]


def _build_campus_graph() -> nx.Graph:
    graph = nx.Graph()
    graph.add_weighted_edges_from(CAMPUS_EDGES, weight="weight")
    # Frozen so no caller can change the shared graph
    return nx.freeze(graph)


CAMPUS_GRAPH: nx.Graph = _build_campus_graph()

_CANONICAL_NAMES: dict[str, str] = {name.lower(): name for name in CAMPUS_GRAPH.nodes}


def resolve_building(name: str) -> str | None:
    """Return the official building name for spellings like the library, or None"""
    key = name.strip().lower().removeprefix("the ")
    return _CANONICAL_NAMES.get(key)


# Route tool

# The docstring below is what the LLM sees, so technical notes live here instead
# Time complexity is O((V + E) log V), because networkx runs Dijkstra with a binary heap
# Space is O(V)
# Results are always the same because the graph never changes
def calculate_route(start_node: str, end_node: str) -> RouteResult:
    """Calculates the shortest route between two buildings. Valid buildings are: Library, Science Hall, Student Union, Engineering, Admin Building, Dormitory. Do not use any other buildings."""
    start, end = resolve_building(start_node), resolve_building(end_node)

    missing = [raw for raw, resolved in ((start_node, start), (end_node, end)) if resolved is None]
    if missing:
        known = ", ".join(sorted(CAMPUS_GRAPH.nodes))
        raise ValueError(f"Unknown building(s): {', '.join(missing)}. Known buildings: {known}.")

    try:
        # One call returns both the total time and the path
        total_time, path = nx.single_source_dijkstra(CAMPUS_GRAPH, source=start, target=end, weight="weight")
    except nx.NetworkXNoPath as exc:
        raise ValueError(f"No route exists from {start} to {end}.") from exc

    return {"path": list(path), "total_time": int(total_time)}

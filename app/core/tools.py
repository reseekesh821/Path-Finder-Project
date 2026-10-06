"""Deterministic campus routing utilities built on networkx."""

from typing import TypedDict

import networkx as nx


class RouteResult(TypedDict):
    path: list[str]
    total_time: int


# (building_a, building_b, walking time in minutes). Paths are walkable in both
# directions, so the graph is undirected. Weights must be non-negative for
# Dijkstra's algorithm to be correct.
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
    # Frozen so callers cannot mutate the shared module-level graph.
    return nx.freeze(graph)


CAMPUS_GRAPH: nx.Graph = _build_campus_graph()

_CANONICAL_NAMES: dict[str, str] = {name.lower(): name for name in CAMPUS_GRAPH.nodes}


def resolve_building(name: str) -> str | None:
    """Map LLM/user spellings like 'the library' onto the canonical node name."""
    key = name.strip().lower()
    key = key.removeprefix("the ")
    return _CANONICAL_NAMES.get(key)


# The docstring below is sent to the LLM as the tool description, so
# implementation notes live in this comment instead.
#
# Time complexity: O((V + E) log V), where V is the number of buildings and E
# the number of paths. networkx implements Dijkstra with a binary heap: each
# vertex is popped once (O(V log V)) and each edge may push a new heap entry
# (O(E log V)). Space is O(V) for the distance/predecessor maps.
#
# Determinism: the graph is static and edge insertion order is fixed, so ties
# between equal-cost paths are broken the same way on every call.
def calculate_route(start_node: str, end_node: str) -> RouteResult:
    """Calculates the shortest route between two buildings. Valid buildings are: Library, Science Hall, Student Union, Engineering, Admin Building, Dormitory. Do not use any other buildings."""
    start, end = resolve_building(start_node), resolve_building(end_node)
    missing = [raw for raw, resolved in ((start_node, start), (end_node, end)) if resolved is None]
    if missing:
        known = ", ".join(sorted(CAMPUS_GRAPH.nodes))
        raise ValueError(f"Unknown building(s): {', '.join(missing)}. Known buildings: {known}.")

    try:
        # Single pass computes both distance and path, avoiding running
        # Dijkstra twice (once for the path, once for the length).
        total_time, path = nx.single_source_dijkstra(
            CAMPUS_GRAPH, source=start, target=end, weight="weight"
        )
    except nx.NetworkXNoPath as exc:
        raise ValueError(f"No route exists from {start} to {end}.") from exc

    return {"path": list(path), "total_time": int(total_time)}

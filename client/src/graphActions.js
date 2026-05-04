import { expand } from "./api.js"; 
import { addToGraph } from "./graph.js"; 
import { runLayout } from "./layout.js";

export async function expandAll(node) {
  const type = node.data("type");
  const nextType = type === "artist" ? "label" : "artist";

  const neighbors = node.connectedEdges()
    .connectedNodes()
    .filter(n =>
      n.id() !== node.id() &&
      n.data("type") === nextType
    );

  await Promise.all(neighbors.map(async (neighbor) => {
    const data = await expand(nextType, neighbor.data("rawId"));

    neighbor.data("expanded", true);
    addToGraph(data);
    neighbor.data("extraData", data);
  }));

  runLayout(); 

  return true;
}
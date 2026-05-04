import { cy } from "./graph.js";
import { expand } from "./api.js";
import { runLayout } from "./layout.js";
import { addToGraph } from "./graph.js";
import { openSidePanel } from "./panel.js";

export function select_neighborhood(node) {
  cy.elements().removeClass("highlighted");

  const maxDepth = 3;

  cy.elements().bfs({
    roots: node,
    directed: false,
    visit: (v, e, u, i, depth) => {
      if (depth > maxDepth) return;

      v.addClass("highlighted");
      if (e){
        e.addClass("highlighted");
        e.style("opacity", 1 - (depth-1) / (maxDepth + 1));
        e.style("width", 8 - (depth*2));
      }
    }
  });
}

export function initUI() {
  let clickTimeout = null;
  const CLICK_DELAY = 250;

  cy.on("tap", "node", (evt) => {
    const node = evt.target;

    if (clickTimeout) {
      // DOUBLE CLICK
      clearTimeout(clickTimeout);
      clickTimeout = null;

      handleDoubleClick(node);
    } else {
      // SINGLE CLICK (delayed)
      clickTimeout = setTimeout(() => {
        handleSingleClick(node);
        clickTimeout = null;
      }, CLICK_DELAY);
    }
  });
}

function handleSingleClick(node) {
  console.log("SELECT NODE");

  select_neighborhood(node);

  openSidePanel(node, node.data("extraData"));
}

async function handleDoubleClick(node) {
  console.log("EXPAND NODE");

  // already expanded → just open panel
  if (node.data("expanded")) {
    openSidePanel(node, node.data("extraData"));
    select_neighborhood(node);
    return;
  }

  node.data("expanded", true);

  const type = node.data("type");
  const rawId = node.data("rawId");

  try {
    const data = await expand(type, rawId);

    if (!data || !data.nodes) {
      console.error("Invalid response:", data);
      return;
    }

    addToGraph(data);

    node.data("extraData", data);

    openSidePanel(node, data);
    select_neighborhood(node);

  } catch (err) {
    console.error(err);
  }
}


import { cy } from "./graph.js";

let layout;

let lastParams = {
  nodeRepulsion: 8000,
  idealEdgeLength: 80,
  gravity: 1
};

export function setLayoutParams(params) {
  lastParams = { ...lastParams, ...params };
}

export function runLayout(params = {}) {
  const layout = cy.layout({
    name: "fcose",

    animate: true,
    randomize: true,

    nodeRepulsion: params.nodeRepulsion ?? 4500,
    gravity: params.gravity ?? 0.25,

    // 🔥 IMPORTANT: must pass function directly
    idealEdgeLength: params.idealEdgeLength,

    edgeElasticity: params.edgeElasticity
  });
  console.log("Layout params:", params);
  layout.run();
}

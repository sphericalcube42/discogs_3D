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

    nodeRepulsion: node => {
      const base = Number(params.nodeRepulsion) ?? 4500;
      const t = node.data("type");

      if (t === "style") return (base * 2);     // anchors
      if (t === "label") return base;
      return (base * 0.5);                     // artists
    },


    gravity: params.gravity ?? 0.25,
    
    idealEdgeLength: edge => {
      const base = Number(params.idealEdgeLength(edge)) ?? 10000;
      const w = Number(edge.data("weight")) || 1;
      const type = edge.data("type");

      // styles should be tight clusters
      if (type === "style") {
        return (base * 0.5) / Math.sqrt(w);
      }

      // structure edges looser
      return base / Math.sqrt(w);
    },


    edgeElasticity: edge => {
      const w = Number(edge.data("weight")) || 1;

      if (edge.data("type") === "style") {
        Math.min(Math.sqrt(w) * 2, 20); // stronger pull
      }

      return Math.min(w * 0.5, 15);
    },

    nodeSeparation: 200

  });
  cy.nodes().forEach(n => {
      const rep = (typeof layout.options.nodeRepulsion === "function")
        ? layout.options.nodeRepulsion(n)
        : layout.options.nodeRepulsion;

      if (!Number.isFinite(rep)) {
        console.error("BAD NODE REPULSION:", n.id(), rep);
      }
    });

    cy.edges().forEach(e => {
      const len = layout.options.idealEdgeLength(e);
      const elast = layout.options.edgeElasticity(e);

      if (!Number.isFinite(len)) {
        console.error("BAD EDGE LENGTH:", e.id(), len);
      }

      if (!Number.isFinite(elast)) {
        console.error("BAD ELASTICITY:", e.id(), elast);
      }
    });
  layout.run();
}

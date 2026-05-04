import cytoscape from "cytoscape";
import fcose from "cytoscape-fcose";
import { runLayout } from "./layout.js";
import { currentLayoutParams } from "./app.js";

cytoscape.use(fcose);

const layoutOptions = {
  name: "fcose",
  animate: true,
  fit: false,
  gravity: 0.2,
  nodeRepulsion: node => {
  const size = node.width();
  return 1000 + size * 50;
  },
  idealEdgeLength: edge => 60,
  numIter: 1000
};

export const cy = cytoscape({
  container: document.getElementById("cy"),

  elements: [],

  style: [
    {
      selector: "node",
      style: {
        label: "data(name)",
        "background-color": ele => ele.data("type") === "artist" ? "#F28705" : "#038C8C",
        "text-valign": "center",
        "text-halign": "center",
        "text-wrap": "wrap",
        "text-max-width": 60,
        color: "#fff",
        "font-size": ele => Math.min(16, 2 + (ele.data("total_release_count") || 0) * 0.1),

        width: ele => {
          const v = ele.data("total_release_count") || 0;
          return Math.min(120, 10 + Math.log(v + 1) * 10);
        },

        height: ele => {
          const v = ele.data("total_release_count") || 0;
          return Math.min(100, 10 + Math.log(v + 1) * 7);
        }
      }
    },
    {
      selector: "edge",
      style: {
        width: 'mapData(weight, 1, 50, 1, 6)',   // thicker = more releases,
        "line-color": "#012E40"
      }
    },
    {
        selector: "edge.highlighted",
        style: {
          "line-color": "#038C8C",
          width: 4
        }
      }
  ],

  layout: {
    name: "fcose"
  }
});

export function addToGraph(data) {

  data.nodes.forEach(n => {
    if (cy.getElementById(n.id).length === 0) {
      cy.add({ data: n });
    }
  });

  console.log("Incoming links:", data.links);

  data.links.forEach(l => {
    const edgeId = `${l.source}-${l.target}`;
    const weight = Number(l.weight ?? l.release_count);

    console.log("EDGE CHECK:", edgeId, typeof weight, weight);

    const edge = cy.getElementById(edgeId);

    if (edge.length === 0) {
      cy.add({
        data: {
          id: edgeId,
          source: l.source,
          target: l.target,
          weight: isFinite(weight) ? weight : 1
        }
      });
    } else {
      // 🔥 important: update existing edges too
      edge.data("weight", isFinite(weight) ? weight : 1);
    }
  });

  // 🔥 run ONCE after graph is fully updated
  scheduleLayout();
}


export function getCy() {
  return cy;
}

let layoutTimeout;
function scheduleLayout() {
  clearTimeout(layoutTimeout);
  layoutTimeout = setTimeout(() => {
    runLayout(currentLayoutParams);
  }, 300);
}
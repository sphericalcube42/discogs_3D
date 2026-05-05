import { cy } from "./graph.js";
import { expand, searchNode } from "./api.js";
import { addToGraph } from "./graph.js";
import { runLayout } from "./layout.js";
import { initUI } from "./ui.js";

async function start() {
  const artistId = 205;

  cy.add({
    data: {
      id: `artist_${artistId}`,
      rawId: artistId,
      type: "artist",
      name: "Seed Artist",
      total_release_count: 0,
    }
  });

  const data = await expand("artist", artistId);
  addToGraph(data);

  runLayout();

}

function bindSearch(){
  document.getElementById("search-btn").addEventListener("click", async () => {
    const query = document.getElementById("search-input").value;

    const type = document.getElementById("search-type").value; 
    // "artist" or "label"

    const node = await searchNode(query, type);
    if (!node) return alert("No result found");

    const nodeId = `${node.type}_${node.id}`;

    cy.elements().remove();

    cy.add({
      data: {
        id: nodeId,
        rawId: node.id,
        type: node.type,
        name: node.name,
        total_release_count: node.total_release_count,
        profile: node.profile
      }
    });

    const data = await expand(node.type, node.id);
    addToGraph(data);

    runLayout();
  });
}
export let currentLayoutParams = {};

export function initPhysicsPanel() {
  const repulsion = document.getElementById("repulsion");
  const edgeLength = document.getElementById("edgeLength");
  const gravity = document.getElementById("gravity");

  let timeout;

  function getParams() {
    const baseLength = Number(edgeLength.value);
    const rep = Number(repulsion.value);
    const grav = Number(gravity.value);

    return {
      nodeRepulsion: rep,
      gravity: grav,

      // 🔥 weight-aware edge length
      idealEdgeLength: (edge) => {
        const w = Number(edge.data("weight")) || 1;
        const scaled = Math.log(100*w + 1);

        // stronger weight → shorter edge
        return baseLength / scaled;
      },

      // 🔥 weight-aware edge strength (spring force)
      edgeElasticity: (edge) => {
        const w = Number(edge.data("weight")) || 1;

        // stronger edges = stronger pull
        return Math.min(Math.log(100*w + 1) * 2, 50);
      }
    };
  }
  function updateLayout() {
    currentLayoutParams = getParams();
    runLayout(currentLayoutParams);
  }

  [repulsion, edgeLength, gravity].forEach(input => {
    input.addEventListener("input", () => {
      clearTimeout(timeout);

      timeout = setTimeout(updateLayout, 120);
    });
  });

  // initial run AFTER everything is ready
  updateLayout();
};



function initApp() {
  start();
  initPhysicsPanel();
  bindSearch();
  initUI();
}

initApp();
  
  




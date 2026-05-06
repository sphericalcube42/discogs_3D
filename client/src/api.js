import { cy } from "./graph.js";

export async function expand(type, id) {
  
  const visibleArtists = cy.nodes('[type = "artist"]')
    .map(n => n.data("rawId"));

  const visibleLabels = cy.nodes('[type = "label"]')
    .map(n => n.data("rawId"));
  console.log("visibleArtists:", visibleArtists)
  const res = await fetch(`http://localhost:3000/expand-context/${type}/${id}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      visibleArtists,
      visibleLabels
    })
  });
  const text = await res.text();

  return JSON.parse(text);
}

export async function searchNode(query, type) {
  const res = await fetch(
    `http://localhost:3000/search?q=${encodeURIComponent(query)}&type=${type}`
  );
  return await res.json();
}

export async function resolveEntity(type, id) {
  console.log("FETCHING ENTITY:", type, id);

  const res = await fetch(`http://localhost:3000/entity/${type}/${id}`);

  console.log("RESPONSE STATUS:", res.status);

  const data = await res.json();

  console.log("RESPONSE DATA:", data);

  return data;
}
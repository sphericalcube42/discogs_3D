export async function expand(type, id) {
  const res = await fetch(`http://localhost:3000/expand/${type}/${id}`);
  return await res.json();
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
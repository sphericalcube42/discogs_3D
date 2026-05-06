// server.js
const express = require("express");
const { Pool } = require("pg");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());
const path = require("path");

app.use(express.static(path.join(__dirname, "public")));

// 🔌 PostgreSQL connection
const pool = new Pool({
  user: "lukaskruckenberg",
  host: "localhost",
  database: "lukaskruckenberg",
  password: "",
  port: 5432,
});


const labelStyleQuery = `
        SELECT *
        FROM (
          SELECT 
            ls.label_id,
            ls.style,
            ls.release_count,
            s.release_count AS total,
            ROW_NUMBER() OVER (
              PARTITION BY ls.label_id 
              ORDER BY ls.release_count DESC
            ) AS rn
          FROM label_style AS ls
        JOIN style s 
          ON s.style = ls.style
          WHERE ls.label_id = ANY($1::int[])
        ) ranked
        WHERE rn <= 3
        ORDER BY release_count DESC
        LIMIT 30;
      `;
const artistStyleQuery = `
        SELECT *
        FROM (
          SELECT 
            ast.artist_id,
            ast.style,
            ast.release_count,
            s.release_count AS total,
            ROW_NUMBER() OVER (
              PARTITION BY ast.artist_id 
              ORDER BY ast.release_count DESC
            ) AS rn
          FROM artist_style AS ast
          JOIN style s 
            ON s.style = ast.style
          WHERE ast.artist_id = ANY($1::int[])
        ) ranked
        WHERE rn <= 3
        ORDER BY release_count DESC
        LIMIT 30;
      `;

//expand endpoint
app.post("/expand/:type/:id", async (req, res) => {
  const { type, id } = req.params;

  try {
    let query;
    let nodeType;
    let styleQuery;

    if (type === "artist") {
      query = `
        SELECT 
          l.id,
          l.name,
          l.profile,
          al.release_count,
          l.total_release_count AS total
        FROM artist_label al
        JOIN label l ON l.id = al.label_id
        WHERE al.artist_id = $1
        ORDER BY al.release_count DESC
        LIMIT 10;
      `;
      
      styleQuery = labelStyleQuery; 
      nodeType = "label";
    
    } else if (type === "label") {
      query = `
        SELECT 
          a.id,
          a.name,
          a.profile,
          al.release_count,
          a.total_release_count AS total
        FROM artist_label al
        JOIN artist a ON a.id = al.artist_id
        WHERE al.label_id = $1
        ORDER BY al.release_count DESC
        LIMIT 20;
      `;

      styleQuery = artistStyleQuery;
      nodeType = "artist";
    }

    else {
      return res.status(400).json({ error: "Invalid type" });
    }

    const structureResult = await pool.query(query, [id]);
    
    const NodeIds = structureResult.rows.map(r => Number(r.id));
    const styleResult = await pool.query(styleQuery, [NodeIds]);

    return wrapExpandData(structureResult, styleResult, nodeType, type, id);
         
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  });

//context expand endpoint
//expand based on the already visible nodes
app.post("/expand-context/:type/:id", async (req, res) => {
  console.log("EXPAND");
  const { visibleArtists = [], visibleLabels = [] } = req.body;
  const { type, id } = req.params;

  try {
    let contextquery;

    const contextIds = 
      type === "artist" ? visibleArtists : visibleLabels;
    //remove clicked node
    const filteredContextIds = contextIds.filter(v => v !== Number(id));

    if (type === "label") {
      //query all artists that have a connection to clicked label and at least one other label
      //more connections get rewarded
      contextquery = 
        `
        WITH label_artists AS (
          -- artists connected to clicked label
          SELECT 
            al.artist_id AS candidate_id,
            al.release_count AS direct_weight
          FROM artist_label_top50_both al
          WHERE al.label_id = $1
        ),

        context_matches AS (

          -- artists connected to visible artists
          SELECT 
            e.dst AS candidate_id,
            e.src AS connected_to,
            e.weight
          FROM artist_artist_edges e
          WHERE e.src = ANY($2::int[])
            AND e.dst IS NOT NULL
            AND e.src IS NOT NULL
        ),
        scored AS (
          SELECT 
            la.candidate_id,
            COALESCE(SUM(cm.weight), 0) AS weight_sum,
            COUNT(DISTINCT cm.connected_to) AS connection_count,
            MAX(la.direct_weight) AS direct_weight
          FROM label_artists la
          LEFT JOIN context_matches cm
            ON cm.candidate_id = la.candidate_id
          GROUP BY la.candidate_id
        ),

        context_edges AS (
          SELECT DISTINCT ON (cm.candidate_id, cm.connected_to)
            cm.candidate_id,
            cm.connected_to,
            cm.weight
          FROM context_matches cm
          JOIN label_artists la
            ON la.candidate_id = cm.candidate_id

        )
        SELECT 
          a.id,
          a.name,
          a.profile,
          a.total_release_count AS total,
          s.direct_weight AS release_count,

          (
            connection_count * 100 +
            weight_sum * 10 +
            direct_weight
          ) AS score,

          json_agg(
            DISTINCT jsonb_build_object(
              'source', ce.connected_to,
              'target', ce.candidate_id,
              'weight', ce.weight
            )
          ) AS context_edges

        FROM scored s
        
        JOIN artist a 
          ON a.id = s.candidate_id
        
        LEFT JOIN context_edges ce
          ON ce.candidate_id = s.candidate_id

        WHERE a.id <> ALL($2::int[])

        GROUP BY
          a.id,
          a.name,
          a.profile,
          a.total_release_count,
          connection_count,
          weight_sum,
          direct_weight

        ORDER BY score DESC
        LIMIT 10;
        `;

      styleQuery = artistStyleQuery;
      nodeType = "artist";
    }

    if (type === "artist") {
      contextquery = 
        `
        WITH artist_labels AS (

          -- labels connected to clicked artist
          SELECT 
            al.label_id AS candidate_id,
            al.release_count AS direct_weight
          FROM artist_label_top50_both al
          WHERE al.artist_id = $1
        ),

        context_matches AS (
          -- labels connected to visible labels
          SELECT 
            e.dst AS candidate_id,
            e.src AS connected_to,
            e.weight
          FROM label_label_edges e
          WHERE e.src = ANY($2::int[])
            AND e.dst IS NOT NULL
            AND e.src IS NOT NULL
        ),

        scored AS (
          SELECT 
            al.candidate_id,
            COALESCE(SUM(cm.weight), 0) AS weight_sum,
            COUNT(DISTINCT cm.connected_to) AS connection_count,
            MAX(al.direct_weight) AS direct_weight
          FROM artist_labels al
          LEFT JOIN context_matches cm
            ON cm.candidate_id = al.candidate_id
          GROUP BY al.candidate_id
        ),

        context_edges AS (
          SELECT DISTINCT ON (cm.candidate_id, cm.connected_to)
            cm.candidate_id,
            cm.connected_to,
            cm.weight
          FROM context_matches cm
          JOIN artist_labels al
            ON al.candidate_id = cm.candidate_id
        )

        SELECT 
          l.id,
          l.name,
          l.profile,
          l.total_release_count AS total,
          s.direct_weight AS release_count,
          (
            connection_count * 100 +
            weight_sum * 10 +
            direct_weight
          ) AS score,
          json_agg(
            DISTINCT jsonb_build_object(
              'source', ce.connected_to,
              'target', ce.candidate_id,
              'weight', ce.weight
            )
          ) FILTER (WHERE ce.connected_to IS NOT NULL) AS context_edges

        FROM scored s
        JOIN label l
          ON l.id = s.candidate_id
        LEFT JOIN context_edges ce
          ON ce.candidate_id = s.candidate_id
        WHERE l.id <> ALL($2::int[])
        GROUP BY
          l.id,
          l.name,
          l.profile,
          l.total_release_count,
          connection_count,
          weight_sum,
          direct_weight

        ORDER BY score DESC
        LIMIT 10;
        `;

      styleQuery = labelStyleQuery;
      nodeType = "label";
    }
    
    const structureResult = await pool.query(contextquery, [id, filteredContextIds]);
    console.dir(structureResult.rows, { depth: null });
    const NodeIds = structureResult.rows.map(r => Number(r.id));
    const styleResult = await pool.query(styleQuery, [NodeIds]);

    const result = wrapExpandData(structureResult, styleResult, nodeType, type, id);
        console.log("STRUCT RESULT:", result.links);
    return res.json(result);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "context expand failed" });
  }
});

//Search Endpoint
app.get("/search", async (req, res) => {
  const { q, type } = req.query; 
  // type = "artist" | "label"

  try {
    let result;

    if (type === "artist") {
      result = await pool.query(
        `
        SELECT id, name, profile, total_release_count AS artist_total
        FROM artist
        WHERE name ILIKE $1
        ORDER BY name
        LIMIT 1;
        `,
        [`%${q}%`]
      );

      if (!result.rows[0]) return res.json(null);

      return res.json({
        id: result.rows[0].id,
        name: result.rows[0].name,
        type: "artist",
        profile: result.rows[0].profile,
        total_release_count: Number(result.rows[0].artist_total)
      });
    }

    if (type === "label") {
      result = await pool.query(
        `
        SELECT id, name, profile, total_release_count AS label_total
        FROM label
        WHERE name ILIKE $1
        ORDER BY name
        LIMIT 1;
        `,
        [`%${q}%`]
      );

      if (!result.rows[0]) return res.json(null);

      return res.json({
        id: result.rows[0].id,
        name: result.rows[0].name,
        type: "label",
        profile: result.rowss[0].profile,
        total_release_count: Number(result.row[0].label_total)
      });
    }

    res.status(400).json({ error: "Invalid type" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/entity/:type/:id", async (req, res) => {
  const { type, id } = req.params;
  try {
    let masterIds = [];
    // -----------------------
    // ARTIST → masters
    // -----------------------
    if (type === "artist") {
      const mastersRes = await pool.query(
        `SELECT m.id AS master_id
        FROM master_artist ma
        JOIN master m ON m.id = ma.master_id
        WHERE ma.artist_id = $1
        ORDER BY m.release_count DESC
        LIMIT 20
      `,
        [id]
      );
      masterIds = mastersRes.rows.map(r => r.master_id);
    }
    // -----------------------
    // LABEL → masters (via release)
    // -----------------------
    else if (type === "label") {
      const mastersRes = await pool.query(
        `
        SELECT m.id AS master_id
        FROM release_label rl
        JOIN master m ON m.main_release = rl.release_id
        WHERE rl.label_id = $1
        ORDER BY m.release_count DESC
        LIMIT 20;
          `,
        [id]
      );
      masterIds = mastersRes.rows.map(r => r.master_id);
    }
    else {
      return res.status(400).json({ error: "Invalid type" });
    }
    // -----------------------
    // Shared enrichment layer
    // -----------------------
    const [styles, genres, videos] = await Promise.all([
      pool.query(
        `
        SELECT DISTINCT *
        FROM master_style
        WHERE master_id = ANY($1)
        `,
        [masterIds]
      ),
      pool.query(
        `
        SELECT DISTINCT *
        FROM master_genre
        WHERE master_id = ANY($1)
        `,
        [masterIds]
      ),
      pool.query(
        `
        SELECT title, uri
        FROM master_video
        WHERE master_id = ANY($1)
        LIMIT 50
        `,
        [masterIds]
      )
    ]);
    // -----------------------
    // Response
    // -----------------------
    return res.json({
      id,
      type,
      masterIds,
      styles: styles.rows,
      genres: genres.rows,
      videos: videos.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

function wrapExpandData(structureResult, styleResult, nodeType, type, id){

  const nodes = new Map();
  const linkMap = new Map();

  structureResult.rows.forEach(r => {

    const nodeId = `${nodeType}_${r.id}`;

    // -------------------
    // NODE
    // -------------------
    if (!nodes.has(nodeId)) {
      nodes.set(nodeId, {
        id: nodeId,
        rawId: r.id,
        type: nodeType,
        name: r.name,
        profile: r.profile,
        release_count: Number(r.release_count),
        total_release_count: Number(r.total)
      });
    }

    // -------------------
    // STRUCTURE EDGE
    // -------------------
    const structureKey = `${type}_${id}-${nodeId}`;

    if (!linkMap.has(structureKey)) {
      linkMap.set(structureKey, {
        source: `${type}_${id}`,
        target: nodeId,
        weight: Number(r.release_count),
      });
    }
    (r.context_edges || []).forEach(e => {
      if (e.source == null || e.target == null) return;

      const sourceId = `${type}_${e.source}`;
      const targetId = `${nodeType}_${e.target}`;

      const key = `${sourceId}-${targetId}`;

      if (!linkMap.has(key)) {
        linkMap.set(key, {
          source: sourceId,
          target: targetId,
          weight: Number(e.weight),
          type: "context"
        });
      }
    });
  });

  const styleLinkMap = new Map();

  styleResult.rows.forEach(s => {

    const baseId = s.label_id ?? s.artist_id;
    const nodeId = `${nodeType}_${baseId}`;

    const styleId = `style_${s.style.toLowerCase().replace(/\s+/g, "_")}`;

    const key = `${nodeId}-${styleId}`;

    if (!styleLinkMap.has(key)) {
      styleLinkMap.set(key, {
        source: nodeId,
        target: styleId,
        style: s.style,
        weight: Number(s.release_count || 1),
        total: Number(s.total)
      });
    }
  });

  return {
    nodes: [...nodes.values()],
    links: [...linkMap.values()],
    styleLinks: [...styleLinkMap.values()]
  };
}

// ❤️ Health check
app.get("/", (req, res) => {
  res.send("API running");
});

// ▶️ Start server
app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
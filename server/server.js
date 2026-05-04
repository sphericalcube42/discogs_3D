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

//expand endpoint
app.get("/expand/:type/:id", async (req, res) => {
  const { type, id } = req.params;

  try {
    let query;
    let nodeType;
    let styleQuery;

    if (type === "artist") {
      query = `
        SELECT 
        l.id AS label_id,
        l.name,
        l.profile,
        al.release_count,
        l.total_release_count AS total,

        ls.style AS style,
        ls.release_count AS style_count

      FROM artist_label al
      JOIN label l 
        ON l.id = al.label_id

      LEFT JOIN label_style ls 
        ON ls.label_id = l.id

      WHERE al.artist_id = $1;
      ORDER BY al.release_count DESC, ls.release_count DESC;
      LIMIT 10;
      `;
      nodeType = "label";
    }

    else if (type === "label") {
      query = `
        SELECT 
          a.id AS artist_id,
          a.name,
          a.profile,
          al.release_count,
          a.total_release_count AS total,

          ast.style AS style,
          ast.release_count AS style_count

        FROM artist_label al
        JOIN artist a 
          ON a.id = al.artist_id

        LEFT JOIN artist_style ast 
          ON ast.artist_id = a.id

        WHERE al.label_id = $1;
        ORDER BY al.release_count DESC, ast.release_count DESC;
        LIMIT 20;
      `;
      nodeType = "artist";
    }

    else {
      return res.status(400).json({ error: "Invalid type" });
    }

    const result = await pool.query(query, [id]);


    // nodes + links

    result.rows.forEach(r => {

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
      links.push({
        source: `${type}_${id}`,
        target: nodeId,
        weight: Number(r.release_count)
      });

      // -------------------
      // STYLE EDGE
      // -------------------
      if (r.style) {
        const styleId = `style_${r.style.toLowerCase().replace(/\s+/g, "_")}`;

        styleEdges.set(`${nodeId}-${styleId}`, {
          source: nodeId,
          target: styleId,
          style: r.style,
          weight: Number(r.style_count || 1)
        });
      }
    });

    return res.json({
      nodes: [...nodes.values()],
      links,
      styleLinks: [...styleEdges.values()]
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
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

// api.js
app.get("/entity/:type/:id", async (req, res) => {
  const { type, id } = req.params;

  try {
    let releaseIds = [];

    // -----------------------
    // ARTIST → masters
    // -----------------------
    if (type === "artist") {
      const releaseRes = await pool.query(
        `SELECT r.id AS release_id
        FROM release_artist ra
        JOIN release r ON r.id = ra.release_id
        WHERE ra.artist_id = $1
        ORDER BY r.release_count DESC
        LIMIT 20
      `,
        [id]
      );

      releaseIds = releaseRes.rows.map(r => r.release_id);
    }

    // -----------------------
    // LABEL → masters (via release)
    // -----------------------
    else if (type === "label") {
      const releaseRes = await pool.query(
        `
        SELECT r.id AS release_id
        FROM release_label rl
        JOIN release r ON r.release = rl.release_id
        WHERE rl.label_id = $1
        ORDER BY r.release_count DESC
        LIMIT 20;
          `,
        [id]
      );

      releaseIds = releaseRes.rows.map(r => r.release_id);
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
        FROM release_style
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

  

// ❤️ Health check
app.get("/", (req, res) => {
  res.send("API running");
});

// ▶️ Start server
app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
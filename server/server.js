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

// 🎯 Expand endpoint
app.get("/expand/:type/:id", async (req, res) => {
  const { type, id } = req.params;

  try {
    let result;

    if (type === "artist") {
      result = await pool.query(
        `
        SELECT l.id, l.name, l.profile, al.release_count, l.total_release_count AS label_total
        FROM artist_label al
        JOIN label l ON l.id = al.label_id
        JOIN artist a ON a.id = al.artist_id
        WHERE al.artist_id = $1
        ORDER BY al.release_count DESC
        LIMIT 10;
        `,
        [id]
      );

      const nodes = result.rows.map((r) => ({
        id: `label_${r.id}`,
        rawId: r.id,
        type: "label",
        name: r.name,
        release_count: Number(r.release_count),
        total_release_count: Number(r.label_total),
        profile: r.profile,
      }));

      const links = result.rows.map((r) => ({
        source: `artist_${id}`,
        target: `label_${r.id}`,
        weight: Number(r.release_count),
      }));

      const labels = result.rows.map(r => ({
        id: r.id,
        name: r.name,
        release_count: Number(r.release_count),
      }));


      return res.json({
        nodes,
        links,
        labels,
      });
    }

    if (type === "label") {
      result = await pool.query(
        `
        SELECT a.id, a.name,a.profile, al.release_count, a.total_release_count AS artist_total
        FROM artist_label al
        JOIN artist a ON a.id = al.artist_id
        JOIN label l ON l.id = al.label_id
        WHERE al.label_id = $1
        ORDER BY al.release_count DESC
        LIMIT 20;
        `,
        [id]
      );

      const nodes = result.rows.map((r) => ({
        id: `artist_${r.id}`,
        rawId: r.id,
        type: "artist",
        name: r.name,
        release_count: Number(r.release_count),
        total_release_count: Number(r.artist_total),
        profile: r.profile,
      }));

      const links = result.rows.map((r) => ({
        source: `label_${id}`,
        target: `artist_${r.id}`,
        weight: Number(r.release_count),
      }));

      const artists = result.rows.map(r => ({
        id: r.id,
        name: r.name,
        release_count: Number(r.release_count)
      }));

      return res.json({
        nodes,
        links,
        artists,
      });
    }

    res.status(400).json({ error: "Invalid type" });
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

  

// ❤️ Health check
app.get("/", (req, res) => {
  res.send("API running");
});

// ▶️ Start server
app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
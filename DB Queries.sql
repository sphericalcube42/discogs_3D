DB Queries





-------------------

CREATE TABLE artist_label_edge (
  artist_id INT NOT NULL,
  label_id INT NOT NULL,
  release_count INT NOT NULL DEFAULT 1,

  PRIMARY KEY (artist_id, label_id)
);

INSERT INTO artist_label_edge (artist_id, label_id, release_count)
SELECT artist_id, label_id, release_count
FROM artist_label
ON CONFLICT (artist_id, label_id)
DO UPDATE SET release_count = EXCLUDED.release_count;

CREATE INDEX idx_artist_label_artist ON artist_label_edge(artist_id);

CREATE INDEX idx_artist_label_label ON artist_label_edge(label_id);

-------------------

CREATE TABLE label_label_projection (
  label_id INT,
  related_label_id INT,
  shared_artists INT,
  PRIMARY KEY (label_id, related_label_id)
);

INSERT INTO label_label_projection (label_id, related_label_id, shared_artists)
SELECT
  a1.label_id AS label_id,
  a2.label_id AS related_label_id,
  COUNT(DISTINCT a1.artist_id) AS shared_artists
FROM artist_label_edge a1
JOIN artist_label_edge a2
  ON a1.artist_id = a2.artist_id
 AND a1.label_id <> a2.label_id
GROUP BY a1.label_id, a2.label_id;

CREATE INDEX idx_label_proj_label ON label_label_projection(label_id);

--------------------

CREATE TABLE artist_artist_projection (
  artist_id INT,
  related_artist_id INT,
  shared_labels INT,
  PRIMARY KEY (artist_id, related_artist_id)
);

INSERT INTO artist_artist_projection (artist_id, related_artist_id, shared_labels)
SELECT
  a1.artist_id,
  a2.artist_id,
  COUNT(DISTINCT a1.label_id)
FROM artist_label_edge a1
JOIN artist_label_edge a2
  ON a1.label_id = a2.label_id
 AND a1.artist_id <> a2.artist_id
GROUP BY a1.artist_id, a2.artist_id;

CREATE INDEX idx_artist_proj_artist ON artist_artist_projection(artist_id);


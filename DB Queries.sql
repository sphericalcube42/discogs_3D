DB Queries





-------------------
Create the artist_artist and label_label table for contextual expand

#Filter artist_label for TOP 50 Labels per Artist

CREATE MATERIALIZED VIEW artist_label_top50 AS
SELECT artist_id, label_id, release_count
FROM (
  SELECT 
    artist_id,
    label_id,
    release_count,
    ROW_NUMBER() OVER (
      PARTITION BY artist_id 
      ORDER BY release_count DESC
    ) AS rn
  FROM artist_label
) t
WHERE rn <= 50;

CREATE INDEX ON artist_label_top50 (artist_id);
CREATE INDEX ON artist_label_top50 (label_id);

#Filter artist_label_top50 for 50 Artist per Label

CREATE MATERIALIZED VIEW artist_label_top50_both AS
SELECT artist_id, label_id, release_count
FROM (
  SELECT 
    artist_id,
    label_id,
    release_count,
    ROW_NUMBER() OVER (
      PARTITION BY label_id
      ORDER BY release_count DESC
    ) AS rn_label
  FROM artist_label_top50
) t
WHERE rn_label <= 50;

CREATE INDEX ON artist_label_top50_both (artist_id);
CREATE INDEX ON artist_label_top50_both (label_id);

#Create artist_artist table from artist_label_top50_both

CREATE MATERIALIZED VIEW artist_artist AS
SELECT 
  al1.artist_id AS artist_a,
  al2.artist_id AS artist_b,
  SUM(LEAST(al1.release_count, al2.release_count)) AS weight
FROM artist_label_top50_both al1
JOIN artist_label_top50_both al2 
  ON al1.label_id = al2.label_id
  AND al1.artist_id < al2.artist_id
GROUP BY al1.artist_id, al2.artist_id;

CREATE INDEX ON artist_artist (artist_a);
CREATE INDEX ON artist_artist (artist_b);

#Make it one directional

CREATE MATERIALIZED VIEW artist_artist_edges AS
SELECT artist_a AS src, artist_b AS dst, weight FROM artist_artist
UNION ALL
SELECT artist_b AS src, artist_a AS dst, weight FROM artist_artist;

CREATE INDEX ON artist_artist_edges (src);
CREATE INDEX ON artist_artist_edges (dst);


#Create label_label table from artist_label_top50_both

CREATE MATERIALIZED VIEW label_label AS
SELECT 
  al1.label_id AS label_a,
  al2.label_id AS label_b,
  SUM(LEAST(al1.release_count, al2.release_count)) AS weight
FROM artist_label_top50_both al1
JOIN artist_label_top50_both al2 
  ON al1.artist_id = al2.artist_id
  AND al1.label_id < al2.label_id
GROUP BY al1.label_id, al2.label_id;

CREATE INDEX ON label_label (label_a);
CREATE INDEX ON label_label (label_b);

#Make it one directional

CREATE MATERIALIZED VIEW label_label_edges AS
SELECT label_a AS src, label_b AS dst, weight FROM label_label
UNION ALL
SELECT label_b AS src, label_a AS dst, weight FROM label_label;

CREATE INDEX ON label_label_edges (src);
CREATE INDEX ON label_label_edges (dst);



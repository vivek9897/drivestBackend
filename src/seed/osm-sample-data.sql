-- Minimal OSM data for RouteMaster testing
-- This creates basic planet_osm_line and planet_osm_point tables with sample data for Colchester area

-- Create the tables if they don't exist (osm2pgsql would normally create these)
CREATE TABLE IF NOT EXISTS planet_osm_line (
    osm_id bigint,
    way geometry(LineString, 3857),
    highway text,
    name text,
    tags hstore
);

CREATE TABLE IF NOT EXISTS planet_osm_point (
    osm_id bigint,
    way geometry(Point, 3857),
    highway text,
    tags hstore
);

-- Create spatial indexes
CREATE INDEX IF NOT EXISTS planet_osm_line_way_idx ON planet_osm_line USING gist (way);
CREATE INDEX IF NOT EXISTS planet_osm_point_way_idx ON planet_osm_point USING gist (way);

-- Clear existing data
TRUNCATE planet_osm_line, planet_osm_point;

-- Insert sample road data for Colchester area (around lat/lon: 51.889, 0.9373)
-- These are simplified road segments with speed limits
INSERT INTO planet_osm_line (osm_id, way, highway, name, tags) VALUES
-- A12 trunk road (high speed)
(1001,
 ST_Transform(ST_GeomFromText('LINESTRING(0.9 51.88, 0.95 51.89, 0.98 51.895)', 4326), 3857),
 'trunk', 'A12', '"maxspeed"=>"70"'),

-- A120 trunk road
(1002,
 ST_Transform(ST_GeomFromText('LINESTRING(0.85 51.87, 0.92 51.88, 0.97 51.885)', 4326), 3857),
 'trunk', 'A120', '"maxspeed"=>"60"'),

-- Residential streets (lower speed)
(1003,
 ST_Transform(ST_GeomFromText('LINESTRING(0.935 51.885, 0.940 51.890)', 4326), 3857),
 'residential', 'High Street', '"maxspeed"=>"30"'),

(1004,
 ST_Transform(ST_GeomFromText('LINESTRING(0.930 51.880, 0.935 51.885)', 4326), 3857),
 'residential', 'North Hill', '"maxspeed"=>"30"'),

-- Unclassified roads
(1005,
 ST_Transform(ST_GeomFromText('LINESTRING(0.925 51.875, 0.930 51.880)', 4326), 3857),
 'unclassified', 'Crow Lane', '"maxspeed"=>"40"');

-- Insert sample traffic control points
INSERT INTO planet_osm_point (osm_id, way, highway, tags) VALUES
-- Traffic signals near route start
(2001,
 ST_Transform(ST_GeomFromText('POINT(0.937 51.889)', 4326), 3857),
 'traffic_signals', ''),

-- Stop signs
(2002,
 ST_Transform(ST_GeomFromText('POINT(0.935 51.887)', 4326), 3857),
 'stop', ''),

-- Give way signs
(2003,
 ST_Transform(ST_GeomFromText('POINT(0.933 51.885)', 4326), 3857),
 'give_way', '');

-- Insert sample zebra crossings
INSERT INTO planet_osm_point (osm_id, way, highway, tags) VALUES
(3001,
 ST_Transform(ST_GeomFromText('POINT(0.936 51.888)', 4326), 3857),
 'crossing', '"crossing"=>"zebra"'),

(3002,
 ST_Transform(ST_GeomFromText('POINT(0.934 51.886)', 4326), 3857),
 'crossing', '"crossing:markings"=>"zebra"');
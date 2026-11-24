CREATE SCHEMA IF NOT EXISTS my_games_diary;
REVOKE ALL ON SCHEMA my_games_diary FROM PUBLIC;

CREATE TABLE IF NOT EXISTS my_games_diary.games (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  search_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('wishlist','playing','played','completed')),
  progress INTEGER NOT NULL CHECK (progress BETWEEN 0 AND 100),
  favorite INTEGER NOT NULL CHECK (favorite IN (0,1)),
  platform TEXT NOT NULL DEFAULT 'PC',
  genre TEXT,
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  image_url TEXT,
  notes TEXT,
  cover BYTEA CHECK (octet_length(cover) <= 5242880),
  cover_type TEXT CHECK (cover_type IN ('image/jpeg', 'image/png', 'image/webp')),
  CHECK ((cover IS NULL) = (cover_type IS NULL)),
  CHECK (image_url IS NULL OR cover IS NULL),
  CHECK ((status = 'completed' AND progress = 100)
    OR (status = 'wishlist' AND progress = 0)
    OR (status IN ('played','playing') AND progress < 100))
);

CREATE TABLE IF NOT EXISTS my_games_diary.lists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  search_name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS my_games_diary.list_games (
  list_id TEXT NOT NULL REFERENCES my_games_diary.lists(id) ON DELETE CASCADE,
  game_id TEXT NOT NULL REFERENCES my_games_diary.games(id) ON DELETE CASCADE,
  PRIMARY KEY (list_id, game_id)
);

CREATE INDEX IF NOT EXISTS list_games_game ON my_games_diary.list_games(game_id);

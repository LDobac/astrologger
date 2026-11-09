-- Migration number: 0002 	 2026-11-09T12:00:00.000Z
CREATE TABLE view_salts (
    day   TEXT PRIMARY KEY,
    salt  TEXT NOT NULL
) WITHOUT ROWID;

CREATE TABLE view_hits (
    day      TEXT NOT NULL,
    visitor  TEXT NOT NULL,
    PRIMARY KEY (day, visitor)
) WITHOUT ROWID;

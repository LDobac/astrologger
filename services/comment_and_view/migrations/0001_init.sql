-- Migration number: 0001 	 2026-11-09T08:04:58.745Z
CREATE TABLE comments (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    parent_id   INTEGER REFERENCES comments(id),
    post_slug   TEXT    NOT NULL,
    nickname    TEXT    NOT NULL,
    pw_hash     TEXT    NOT NULL,
    pw_salt     TEXT    NOT NULL,
    email       TEXT,
    content     TEXT    NOT NULL,
    created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at  TEXT
);
CREATE INDEX idx_comments_post ON comments(post_slug, id);
CREATE INDEX idx_comments_parent ON comments(parent_id);

CREATE TABLE views (
    post_slug   TEXT    PRIMARY KEY,
    count       INTEGER NOT NULL DEFAULT 0
);

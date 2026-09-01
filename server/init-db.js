'use strict';

/**
 * init-db.js — Run once on first EC2 boot via UserData to create schema.
 * Usage: node init-db.js
 */
const pool = require('./db');

const CREATE_TABLE = `
CREATE TABLE IF NOT EXISTS diagrams (
    id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    prompt       TEXT         NOT NULL,
    type         VARCHAR(60)  NOT NULL,
    mermaid_code TEXT         NOT NULL,
    s3_svg_key   VARCHAR(500),
    created_at   TIMESTAMPTZ  DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_diagrams_created_at ON diagrams (created_at DESC);
`;

(async () => {
    try {
        await pool.query(CREATE_TABLE);
        console.log('DB schema initialised successfully.');
    } catch (err) {
        console.error('Failed to initialise schema:', err.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
})();

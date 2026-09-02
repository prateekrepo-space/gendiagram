'use strict';

require('dotenv').config();

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
    const maxRetries = 10;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`Attempt ${attempt}/${maxRetries}: Connecting to database...`);
            await pool.query(CREATE_TABLE);
            console.log('DB schema initialised successfully.');
            await pool.end();
            process.exit(0);
        } catch (err) {
            console.warn(`Attempt ${attempt} failed: ${err.message}`);
            if (attempt === maxRetries) {
                console.error('All retries exhausted. Failed to initialise schema.');
                await pool.end();
                process.exit(1);
            }
            console.log('Retrying in 5 seconds...');
            await new Promise((resolve) => setTimeout(resolve, 5000));
        }
    }
})();

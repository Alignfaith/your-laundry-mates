const { Pool, neonConfig } = require('@neondatabase/serverless');
const { readFileSync } = require('fs');
const { join } = require('path');

// Node.js 21+ has WebSocket built in
neonConfig.webSocketConstructor = globalThis.WebSocket;

const schema = readFileSync(join(__dirname, '../schema.sql'), 'utf8');

// Split on semicolons while respecting $$ dollar-quoted blocks (plpgsql function bodies)
function splitStatements(content) {
  const stmts = [];
  let stmt = '';
  let inDollarBlock = false;
  let dollarTag = '';
  let i = 0;

  while (i < content.length) {
    if (!inDollarBlock) {
      const m = content.slice(i).match(/^\$[^$]*\$/);
      if (m) {
        inDollarBlock = true;
        dollarTag = m[0];
        stmt += dollarTag;
        i += dollarTag.length;
        continue;
      }
    } else if (content.slice(i, i + dollarTag.length) === dollarTag) {
      inDollarBlock = false;
      stmt += dollarTag;
      i += dollarTag.length;
      dollarTag = '';
      continue;
    }

    if (!inDollarBlock && content[i] === ';') {
      const s = stmt.trim();
      if (s) stmts.push(s);
      stmt = '';
      i++;
      continue;
    }

    stmt += content[i++];
  }

  const last = stmt.trim();
  if (last) stmts.push(last);
  return stmts;
}

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    const statements = splitStatements(schema);
    console.log(`Running schema.sql (${statements.length} statements) against Neon…\n`);

    for (const stmt of statements) {
      await client.query(stmt);
      console.log(`  ✓ ${stmt.split('\n')[0].slice(0, 72)}`);
    }

    console.log('\nVerifying…');
    const { rows } = await client.query(`
      SELECT table_name,
             pg_size_pretty(pg_total_relation_size(quote_ident(table_name))) AS size
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'leads'
    `);

    if (rows[0]) {
      console.log(`✓ Table "${rows[0].table_name}" exists (${rows[0].size})`);
    } else {
      console.error('✗ Table "leads" not found — check for errors above');
      process.exit(1);
    }
  } finally {
    client.release();
    await pool.end();
  }
})().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});

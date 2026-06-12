require("dotenv").config({ path: "./.env"});
const { Pool } = require("pg");
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: { rejectUnauthorized: false }
});
(async () => {
  try {
    const r = await pool.query("SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema NOT IN (''pg_catalog'',''information_schema'')");
    console.log(JSON.stringify(r.rows, null, 2));
  } catch(e) {
    console.error(e.message);
  }
  pool.end();
})();

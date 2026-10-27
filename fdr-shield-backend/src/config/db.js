const { Pool } = require('pg');
require('dotenv').config();

const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl:
        process.env.NODE_ENV === 'production'
          ? { rejectUnauthorized: false }
          : false,
    }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME || 'fdr_shield_db',
      user: process.env.DB_USER || 'postgres',
      password: String(process.env.DB_PASS || ''),
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    };

const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  console.error('[DB] Unexpected error on idle PostgreSQL client:', err.message);
});

const connectDB = async () => {
  try {
    const client = await pool.connect();
    const res = await client.query('SELECT NOW() AS current_time, current_database() AS db_name');
    console.log(
      `[DB] Connected to PostgreSQL database "${res.rows[0].db_name}" at ${res.rows[0].current_time}`
    );
    client.release();
  } catch (err) {
    console.error('[DB] PostgreSQL connection failed:', err.message);
    process.exit(1);
  }
};

/**
 * Execute a parameterized SQL query
 * @param {string} text - SQL query string ($1, $2, etc.)
 * @param {Array} params - Parameter values
 */
const query = async (text, params) => {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  if (process.env.NODE_ENV === 'development' && duration > 200) {
    console.warn(`[DB SLOW QUERY] (${duration}ms): ${text}`);
  }
  return res;
};

/**
 * Acquire a client from the pool for ACID transactions (BEGIN / COMMIT / ROLLBACK)
 */
const getClient = async () => {
  return await pool.connect();
};

module.exports = {
  pool,
  connectDB,
  query,
  getClient,
};
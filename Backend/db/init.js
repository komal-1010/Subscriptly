const { Client } = require('pg');

async function initDatabase() {
  const client = new Client({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: 'postgres', // must exist
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
  });

  try {
    await client.connect();

    const res = await client.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [process.env.DB_NAME]
    );

    if (res.rowCount === 0) {
      await client.query(`CREATE DATABASE ${process.env.DB_NAME}`);
      console.log('Database created');
    } else {
      console.log('Database already exists');
    }
  } catch (err) {
    console.error('DB init error:', err.message);
  } finally {
    await client.end();
  }
}

module.exports = initDatabase;
    
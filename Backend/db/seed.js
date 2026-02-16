import pool from './index.js';

async function seed() {
  try {

    console.log('⏳ Running DB initialization...');
    // ============================
    // 2️⃣ USERS TABLE
    // ============================
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role_id INTEGER REFERENCES roles(id),
        stripe_customer_id TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // ============================
    // 1️⃣ ROLES TABLE
    // ============================
    await pool.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL
      );
    `);

    await pool.query(`
      INSERT INTO roles (name)
      VALUES ('admin'), ('user')
      ON CONFLICT (name) DO NOTHING;
    `);

    // ============================
    // 2️⃣ USERS TABLE
    // ============================
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role_id INTEGER REFERENCES roles(id),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // ============================
    // 3️⃣ PLANS TABLE
    // ============================
    await pool.query(`
      CREATE TABLE IF NOT EXISTS plans (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        price INTEGER NOT NULL,
        duration_months INTEGER NOT NULL,
        stripe_price_id TEXT,
        grace_period_days INTEGER DEFAULT 0,
        project_limit INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await pool.query(`
      INSERT INTO plans
      (name, price, duration_months, stripe_price_id, grace_period_days, project_limit)
      VALUES
        ('Basic', 10, 1, 'price_basic_id', 3, 3),
        ('Standard', 25, 3, 'price_standard_id', 5, 15),
        ('Premium', 90, 12, 'price_premium_id', 7, 100)
      ON CONFLICT (name) DO NOTHING;
    `);

    // ============================
    // 4️⃣ SUBSCRIPTIONS TABLE
    // ============================
    await pool.query(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        plan_id INTEGER REFERENCES plans(id),
        stripe_subscription_id TEXT,
        status TEXT NOT NULL,
        current_period_end TIMESTAMP,
        grace_period_end TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // ============================
    // 5️⃣ PROJECTS TABLE (for usage)
    // ============================
    await pool.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // ============================
    // 6️⃣ WEBHOOK EVENTS TABLE (Idempotency)
    // ============================
    await pool.query(`
      CREATE TABLE IF NOT EXISTS webhook_events (
        id TEXT PRIMARY KEY,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    console.log('✅ Database initialized successfully!');

  } catch (err) {
    console.error('❌ Error initializing DB:', err);
  } finally {
    await pool.end();
  }
}

seed();

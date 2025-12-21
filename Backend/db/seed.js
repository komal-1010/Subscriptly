import pool from './index.js';

async function seed() {
  try {
    // Seed roles
    await pool.query(`
      INSERT INTO roles (name)
      VALUES ('admin'), ('user')
      ON CONFLICT (name) DO NOTHING;
    `);

    // Seed plans
    await pool.query(`
      INSERT INTO plans (name, price, duration_months)
      VALUES 
        ('Basic', 10, 1),
        ('Standard', 25, 3),
        ('Premium', 90, 12)
      ON CONFLICT (name) DO NOTHING;
    `);

    console.log('Seed data inserted successfully!');
  } catch (err) {
    console.error('Error seeding data:', err);
  } finally {
    await pool.end(); // close connection
  }
}

seed();

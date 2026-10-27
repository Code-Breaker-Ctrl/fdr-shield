require('dotenv').config();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { query, pool } = require('./config/db');

async function setupDatabase() {
  try {
    console.log('🔄 Reading database.sql...');
    const sqlFilePath = path.join(__dirname, '..', 'database.sql');
    const sql = fs.readFileSync(sqlFilePath, 'utf8');

    console.log('🔄 Executing schema and seed data...');
    await query(sql);
    console.log('✅ Schema & initial seed applied successfully!');

    // Check tables
    const tableRes = await query("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;");
    console.log('📊 Tables in public schema:', tableRes.rows.map(r => r.tablename));

    // Ensure users have verified bcrypt hash for 'Admin@123'
    console.log('🔄 Generating fresh bcrypt hash for password "Admin@123"...');
    const freshHash = await bcrypt.hash('Admin@123', 10);
    const updateRes = await query('UPDATE users SET password_hash = $1', [freshHash]);
    console.log(`✅ Successfully updated ${updateRes.rowCount} users with verified hash!`);

    // Verify user count and roles
    const userRes = await query('SELECT email, role, is_active FROM users ORDER BY role;');
    console.log('👥 Seeded Users:');
    console.table(userRes.rows);

  } catch (error) {
    console.error('❌ Database setup failed:', error.message);
    if (error.detail) console.error('Detail:', error.detail);
    if (error.hint) console.error('Hint:', error.hint);
  } finally {
    await pool.end();
  }
}

setupDatabase();

const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.DATABASE_HOST || "192.168.0.33",
  port: parseInt(process.env.DATABASE_PORT || "5432", 10),
  database: process.env.DATABASE_NAME || "wedding_db",
  user: process.env.DATABASE_USER || "postgresuser",
  password: process.env.DATABASE_PASSWORD || "supersecretpassword",
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

async function initDB(retries = 10, delay = 3000) {
  for (let i = 0; i < retries; i++) {
    try {
      console.log(
        `[DB] Attempting database connection (Attempt ${i + 1}/${retries})...`,
      );
      const client = await pool.connect();

      await client.query(`
        CREATE TABLE IF NOT EXISTS wishes (
          id SERIAL PRIMARY KEY,
          image_data TEXT NOT NULL,
          color VARCHAR(32) DEFAULT '#f43f5e',
          guest_name VARCHAR(100) DEFAULT 'Guest',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Create index on created_at for fast retrieval
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_wishes_created_at ON wishes (created_at ASC);
      `);

      // Check if table is empty and seed initial welcome wishes
      const countRes = await client.query("SELECT COUNT(*) FROM wishes;");
      if (parseInt(countRes.rows[0].count, 10) === 0) {
        console.log(
          "[DB] Fresh database detected. Seeding initial welcome blessings...",
        );

        // Minimal elegant SVG data URIs for starter balloons
        // const sample1 = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect width="100%" height="100%" fill="%230f172a"/><text x="50%" y="45%" dominant-baseline="middle" text-anchor="middle" fill="%23fb7185" font-family="serif" font-size="24" font-weight="bold">Welcome to Our Wedding! ✨</text><text x="50%" y="65%" dominant-baseline="middle" text-anchor="middle" fill="%23cbd5e1" font-family="sans-serif" font-size="16">May love and joy fill this day ❤️</text></svg>`;
        // const sample2 = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect width="100%" height="100%" fill="%230f172a"/><text x="50%" y="45%" dominant-baseline="middle" text-anchor="middle" fill="%23f59e0b" font-family="serif" font-size="24" font-weight="bold">Forever & Always 💍</text><text x="50%" y="65%" dominant-baseline="middle" text-anchor="middle" fill="%23cbd5e1" font-family="sans-serif" font-size="16">Wishing you endless happiness!</text></svg>`;

        // await client.query(
        //   `INSERT INTO wishes (image_data, color, guest_name) VALUES
        //     ($1, '#f43f5e', 'Bride & Groom'),
        //     ($2, '#eab308', 'Wedding Party');`,
        //   [sample1, sample2]
        // );
        console.log("[DB] Successfully seeded 2 starter wishes.");
      }

      client.release();
      console.log("[DB] PostgreSQL connected & schema verified successfully.");
      return;
    } catch (err) {
      console.error(
        `[DB] Connection failed: ${err.message}. Retrying in ${delay / 1000}s...`,
      );
      if (i < retries - 1) {
        await new Promise((res) => setTimeout(res, delay));
      } else {
        console.error(
          "[DB] Critical: Exhausted all database connection retries.",
        );
        throw err;
      }
    }
  }
}

module.exports = {
  pool,
  initDB,
  query: (text, params) => pool.query(text, params),
};

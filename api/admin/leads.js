const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.DATABASE_URL);

function authorized(req) {
  const pw = process.env.ADMIN_PASSWORD;
  return pw && req.headers.authorization === `Bearer ${pw}`;
}

module.exports = async (req, res) => {
  if (!authorized(req)) return res.status(401).json({ error: 'Unauthorized' });
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const rows = await sql`SELECT * FROM leads ORDER BY created_at DESC LIMIT 500`;
    return res.status(200).json(rows);
  } catch (err) {
    console.error('admin leads list:', err.message);
    return res.status(500).json({ error: 'Failed to fetch leads' });
  }
};

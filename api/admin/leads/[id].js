const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.DATABASE_URL);

const VALID_STATUSES = ['NEW', 'CONTACTED', 'SCHEDULED', 'CONVERTED', 'LOST'];

function authorized(req) {
  const pw = process.env.ADMIN_PASSWORD;
  return pw && req.headers.authorization === `Bearer ${pw}`;
}

module.exports = async (req, res) => {
  if (!authorized(req)) return res.status(401).json({ error: 'Unauthorized' });
  if (req.method !== 'PATCH') return res.status(405).json({ error: 'Method not allowed' });

  const id = parseInt(req.query.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

  const { status, admin_notes } = req.body || {};

  if (status === undefined && admin_notes === undefined) {
    return res.status(400).json({ error: 'Nothing to update' });
  }
  if (status !== undefined && !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
  }

  try {
    let rows;
    if (status !== undefined && admin_notes !== undefined) {
      rows = await sql`
        UPDATE leads SET status = ${status}, admin_notes = ${admin_notes}, updated_at = NOW()
        WHERE id = ${id} RETURNING *`;
    } else if (status !== undefined) {
      rows = await sql`
        UPDATE leads SET status = ${status}, updated_at = NOW()
        WHERE id = ${id} RETURNING *`;
    } else {
      rows = await sql`
        UPDATE leads SET admin_notes = ${admin_notes}, updated_at = NOW()
        WHERE id = ${id} RETURNING *`;
    }

    if (!rows.length) return res.status(404).json({ error: 'Lead not found' });
    return res.status(200).json(rows[0]);
  } catch (err) {
    console.error('admin leads update:', err.message);
    return res.status(500).json({ error: 'Failed to update' });
  }
};

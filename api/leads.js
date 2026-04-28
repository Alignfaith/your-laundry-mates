const { neon } = require('@neondatabase/serverless');
const { Resend } = require('resend');

const sql = neon(process.env.DATABASE_URL);

const FREQ_LABELS = { WEEKLY: 'Weekly', BIWEEKLY: 'Biweekly', MONTHLY: 'Monthly', AS_NEEDED: 'As needed' };

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    name, contact, contact_type,
    dread_score, interest_level, frequency, notes,
    utm_source, utm_medium, utm_campaign, referrer,
    _honeypot,
  } = req.body || {};

  if (_honeypot) return res.status(200).json({ ok: true });

  if (!name?.trim() || !contact?.trim() || !['email', 'phone'].includes(contact_type)) {
    return res.status(400).json({ error: 'name, contact, and contact_type are required' });
  }

  try {
    const [row] = await sql`
      INSERT INTO leads
        (name, contact, contact_type, dread_score, interest_level,
         frequency, notes, utm_source, utm_medium, utm_campaign, referrer)
      VALUES (
        ${name.trim()}, ${contact.trim()}, ${contact_type},
        ${dread_score != null ? Number(dread_score) : null},
        ${interest_level || 'YES_PLEASE'},
        ${frequency || null}, ${notes?.trim() || null},
        ${utm_source || null}, ${utm_medium || null},
        ${utm_campaign || null}, ${referrer || null}
      )
      RETURNING id
    `;

    if (process.env.RESEND_API_KEY && process.env.NOTIFY_EMAIL) {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const detailRows = [
        ['Contact', `${esc(contact)} (${contact_type})`],
        frequency ? ['Frequency', FREQ_LABELS[frequency] || frequency] : null,
        dread_score != null ? ['Dread score', `${dread_score} / 5`] : null,
        notes ? ['Notes', esc(notes)] : null,
        utm_source ? ['Source', esc(utm_source)] : null,
      ].filter(Boolean);

      resend.emails.send({
        from: 'Your Laundry Mates <notifications@yourlaundrymates.com>',
        to: process.env.NOTIFY_EMAIL.split(',').map(s => s.trim()).filter(Boolean),
        subject: `New lead — ${name.trim()}`,
        html: `
          <div style="font-family:sans-serif;max-width:480px;color:#0f2847">
            <h2 style="margin:0 0 4px;font-size:20px">New lead from ${esc(name.trim())}</h2>
            <p style="color:#334664;margin:0 0 24px;font-size:14px">Submitted via your website</p>
            <table style="width:100%;border-collapse:collapse">
              ${detailRows.map(([k, v]) => `
                <tr>
                  <td style="padding:10px 12px 10px 0;border-top:1px solid #eee;font-weight:600;width:130px;vertical-align:top;font-size:14px">${k}</td>
                  <td style="padding:10px 0;border-top:1px solid #eee;font-size:14px;vertical-align:top">${v}</td>
                </tr>`).join('')}
            </table>
          </div>`,
      }).catch(err => console.error('resend notify:', err.message));
    }

    return res.status(201).json({ id: row.id });
  } catch (err) {
    console.error('leads insert:', err.message);
    return res.status(500).json({ error: 'Could not save. Please call us instead.' });
  }
};

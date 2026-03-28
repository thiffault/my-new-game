import crypto from 'crypto';

function generateToken() {
    const timestamp = Date.now().toString();
    const sig = crypto
        .createHmac('sha256', process.env.ADMIN_PASSWORD)
        .update(timestamp)
        .digest('hex');
    return Buffer.from(`${timestamp}.${sig}`).toString('base64');
}

export default function handler(req, res) {
    const origin = process.env.ALLOWED_ORIGIN || '*';
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { password } = req.body || {};

    if (!password || password !== process.env.ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'Incorrect password' });
    }

    return res.json({ token: generateToken() });
}

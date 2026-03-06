const crypto = require('crypto');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

function generateToken() {
    const timestamp = Date.now();
    const secret = process.env.ADMIN_TOKEN_SECRET || ADMIN_PASSWORD;
    const hmac = crypto.createHmac('sha256', secret).update(String(timestamp)).digest('hex');
    return `${timestamp}.${hmac}`;
}

module.exports = function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { password } = req.body || {};

    if (!password || password !== ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'Incorrect password' });
    }

    return res.json({ token: generateToken() });
};

export default function handler(req, res) {
    res.json({ method: req.method, body: req.body, env: !!process.env.ADMIN_PASSWORD });
}

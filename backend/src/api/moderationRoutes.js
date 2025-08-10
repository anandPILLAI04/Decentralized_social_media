const express = require("express");
const router = express.Router();

/**
 * POST /api/moderation/analyze
 * body: { text: "some content" }
 * returns: { ok: true, score: 0.12, flags: [] }
 */
router.post("/analyze", async (req, res) => {
  const { text } = req.body || {};
  // Placeholder: in production call Python AI service or internal model
  const score = text && text.length > 200 ? 0.9 : 0.1;
  res.json({ ok: true, score, flags: [] });
});

module.exports = router;

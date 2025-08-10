const express = require("express");
const cors = require("cors");
const moderationRoutes = require("./api/moderationRoutes");

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/moderation", moderationRoutes);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Backend listening on http://localhost:${PORT}`));

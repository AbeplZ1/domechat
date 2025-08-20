const express = require("express");
const app = express();

const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("DomeChat server is running!");
});

app.listen(PORT, () => {
  console.log(`✅ DomeChat Server running on port ${PORT}`);
});

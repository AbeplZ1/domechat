// server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
require("dotenv").config();

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// Admin code stored in .env (set ADMIN_CODE=yourSecretCode)
const ADMIN_CODE = process.env.ADMIN_CODE;

// Serve static files
app.use(express.static("public"));

// Store lobbies
let lobbies = {};

// Helper to check if admin
function isAdmin(code) {
  return code === ADMIN_CODE;
}

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Join or create DomePhone room
  socket.on("joinRoom", ({ roomId, username, maxPlayers }) => {
    if (!lobbies[roomId]) {
      lobbies[roomId] = {
        host: socket.id,
        players: [],
        maxPlayers: maxPlayers || 4,
      };
    }

    lobbies[roomId].players.push({ id: socket.id, username });

    socket.join(roomId);

    // Notify lobby of new player
    io.to(roomId).emit("lobbyUpdate", lobbies[roomId]);

    // If lobby is full, start automatically
    if (lobbies[roomId].players.length >= lobbies[roomId].maxPlayers) {
      io.to(roomId).emit("gameStart", lobbies[roomId]);
    }
  });

  // Admin-only: skip wait + force start
  socket.on("adminStartGame", ({ roomId, code }) => {
    if (isAdmin(code) && lobbies[roomId]) {
      io.to(roomId).emit("gameStart", lobbies[roomId]);
    } else {
      socket.emit("errorMessage", "Invalid admin code");
    }
  });

  // DomeChat feature: remove ads (admin toggle)
  socket.on("adminToggleAds", ({ code, enabled }) => {
    if (isAdmin(code)) {
      io.emit("adsToggled", { enabled });
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    for (let roomId in lobbies) {
      lobbies[roomId].players = lobbies[roomId].players.filter(
        (p) => p.id !== socket.id
      );
      io.to(roomId).emit("lobbyUpdate", lobbies[roomId]);
      if (lobbies[roomId].players.length === 0) delete lobbies[roomId];
    }
  });
});

server.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});

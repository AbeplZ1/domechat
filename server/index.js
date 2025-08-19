const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { jwt } = require('twilio');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

io.on('connection', (socket) => {
  console.log('User connected', socket.id);
  socket.on('signal', (data) => {
    io.to(data.to).emit('signal', { from: socket.id, signal: data.signal });
  });
  socket.on('disconnect', () => console.log('User disconnected', socket.id));
});

// TURN ICE route
app.get('/ice', (req, res) => {
  const AccessToken = jwt.AccessToken;
  const VideoGrant = AccessToken.VideoGrant;
  const token = new AccessToken(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_API_KEY_SID,
    process.env.TWILIO_API_KEY_SECRET,
    { ttl: 3600 }
  );
  token.addGrant(new VideoGrant());
  res.send({ token: token.toJwt() });
});

server.listen(process.env.PORT || 3000, () => {
  console.log('Server running');
});
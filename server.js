// ────────────────────────────────────────────────────────────
//  server.js – Chthab (full file, Redis–enabled)
// ────────────────────────────────────────────────────────────
const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');
const cors    = require('cors');
const path    = require('path');

// Redis adapter for Socket.IO (NEW)
const { createAdapter } = require('@socket.io/redis-adapter');
const { createClient }  = require('redis');

// ── App / HTTP / Socket.IO boilerplate ──────────────────────
const app = express();
app.use('/images', express.static('public/images'));

const allowedOrigins = ['https://chthab.com', 'http://localhost:3000'];
app.use(cors({ origin: allowedOrigins, methods: ['GET', 'POST'] }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: allowedOrigins, methods: ['GET', 'POST'] },
  pingTimeout: 120000,
  pingInterval: 25000,
});

const PORT = process.env.PORT || 3001;

// ── All location categories (unchanged) ─────────────────────
const locationCategories = {
  Kuwait: [
    { name: "barber",        image: "/images/kuwait/barber.png" },
    { name: "bnaider",       image: "/images/kuwait/bnaider.png" },
    { name: "duwaniya",      image: "/images/kuwait/duwaniya.png" },
    { name: "gahwa",         image: "/images/kuwait/gahwa.png" },
    { name: "gas station",   image: "/images/kuwait/gas station.png" },
    { name: "gym",           image: "/images/kuwait/gym.png" },
    { name: "hospital",      image: "/images/kuwait/hospital.png" },
    { name: "jameia",        image: "/images/kuwait/jameia.png" },
    { name: "library",       image: "/images/kuwait/library.png" },
    { name: "police station",image: "/images/kuwait/police station.png" },
    { name: "rehab",         image: "/images/kuwait/rehab.png" },
    { name: "school",        image: "/images/kuwait/school.png" },
    { name: "soccer field",  image: "/images/kuwait/soccer field.png" },
    { name: "subiya",        image: "/images/kuwait/subiya.png" },
    { name: "t7weelat",      image: "/images/kuwait/t7weelat.png" },
    { name: "theatre",       image: "/images/kuwait/theatre.png" },
  ],
  "Kuwait-Places": [
    { name: "souq mubarakiya", image: "/images/kuwait-places/souq.png" },
    { name: "marina mall",     image: "/images/kuwait-places/marina.png" },
    { name: "failaka island",  image: "/images/kuwait-places/failaka.png" },
    { name: "kuwait towers",   image: "/images/kuwait-places/towers.png" },
    { name: "360 mall",        image: "/images/kuwait-places/360.png" }
  ],
  "Soccer-Players": [
    { name: "de jong",     image: "/images/soccer-players/de jong.png" },
    { name: "higuain",     image: "/images/soccer-players/higuain.png" },
    { name: "rooney",      image: "/images/soccer-players/rooney.png" },
    { name: "lewandowski", image: "/images/soccer-players/lewandowski.png" },
    { name: "ronaldinho",  image: "/images/soccer-players/ronaldinho.png" },
    { name: "son",         image: "/images/soccer-players/son.png" },
    { name: "aguero",      image: "/images/soccer-players/aguero.png" },
    { name: "antony",      image: "/images/soccer-players/antony.png" },
    { name: "r9",          image: "/images/soccer-players/r9.png" },
    { name: "dybala",      image: "/images/soccer-players/dybala.png" },
    { name: "mbappe",      image: "/images/soccer-players/mbappe.png" },
    { name: "palmer",      image: "/images/soccer-players/palmer.png" },
    { name: "yamal",       image: "/images/soccer-players/yamal.png" },
    { name: "maradona",    image: "/images/soccer-players/maradona.png" },
    { name: "pele",        image: "/images/soccer-players/pele.png" },
    { name: "neymar",      image: "/images/soccer-players/neymar.png" },
    { name: "modric",      image: "/images/soccer-players/modric.png" },
    { name: "ronaldo",     image: "/images/soccer-players/ronaldo.png" },
    { name: "messi",       image: "/images/soccer-players/messi.png" },
    { name: "neymar",      image: "/images/soccer-players/neymar.png" },
    { name: "mbappe",      image: "/images/soccer-players/mbappe.png" },
    { name: "modric",      image: "/images/soccer-players/modric.png" },
    { name: "salem",       image: "/images/soccer-players/salem.png" }
  ]
};

// ── In-memory state (same as before) ─────────────────────────
const rooms           = {};
const usedLocations   = {};
const roomHosts       = {};
const roomCategories  = {};

// ────────────────────────────────────────────────────────────
//  Main bootstrap – waits for Redis before starting server
// ────────────────────────────────────────────────────────────
(async () => {
  // 1. Connect to Redis and plug into Socket.IO
  const pubClient = createClient({ url: process.env.REDIS_URL });
  const subClient = pubClient.duplicate();
  await pubClient.connect();
  await subClient.connect();
  io.adapter(createAdapter(pubClient, subClient));
  console.log('🚦  Redis adapter attached');

  // 2. Socket.IO event handlers (all original logic)
  io.on('connection', (socket) => {
    console.log(`🟢  User connected: ${socket.id} (${socket.handshake.address})`);

    let lastActivity = Date.now();
    socket.onAny(() => lastActivity = Date.now());
    const inactivityInterval = setInterval(() => {
      if (Date.now() - lastActivity > 20 * 60 * 1000) {
        console.log(`⚠️  Socket ${socket.id} timed out`);
        socket.disconnect(true);
      }
    }, 5000);

    // ── joinRoom ────────────────────────────────────────────
    socket.on('joinRoom', ({ roomCode, username }) => {
      if (!rooms[roomCode]) rooms[roomCode] = [];      // create if first player
      if (!roomHosts[roomCode]) roomHosts[roomCode] = socket.id;

      if (rooms[roomCode].length >= 8) {
        socket.emit('errorMessage', 'Room is full.');
        return;
      }
      const exists = rooms[roomCode].some(p => p.id === socket.id);
      if (!exists) rooms[roomCode].push({ id: socket.id, username, ready:false, returned:false });

      socket.join(roomCode);
      io.to(roomCode).emit('roomData', {
        players: rooms[roomCode],
        hostId : roomHosts[roomCode],
        category: roomCategories[roomCode] || 'Kuwait'
      });
      io.to(roomCode).emit('newHost', roomHosts[roomCode]);
    });

    // ── ready ───────────────────────────────────────────────
    socket.on('ready', ({ roomCode, playerId }) => {
      const player = rooms[roomCode]?.find(p => p.id === playerId);
      if (player) player.ready = true;
      io.to(roomCode).emit('roomData', {
        players: rooms[roomCode],
        hostId : roomHosts[roomCode],
        category: roomCategories[roomCode] || 'Kuwait'
      });
    });

    // ── updateCategory ──────────────────────────────────────
    socket.on('updateCategory', ({ roomCode, category }) => {
      if (rooms[roomCode]) {
        roomCategories[roomCode] = category;
        io.to(roomCode).emit('roomData', {
          players: rooms[roomCode],
          hostId : roomHosts[roomCode],
          category
        });
      }
    });

    // ── startGame ───────────────────────────────────────────
    socket.on('startGame', ({ roomCode, category }) => {
      const room = rooms[roomCode];
      if (!room || room.length < 2) {
        socket.emit('errorMessage', 'At least 2 players are required to start the game.');
        return;
      }

      room.forEach(p => p.returned = false);
      if (category) roomCategories[roomCode] = category;
      else if (!roomCategories[roomCode]) roomCategories[roomCode] = 'Kuwait';

      const selectedCategory = roomCategories[roomCode];
      const chosenCategory   = locationCategories[selectedCategory];
      if (!Array.isArray(chosenCategory) || chosenCategory.length === 0) {
        console.error(`❌ Invalid/empty category: ${selectedCategory}`);
        return;
      }

      if (!usedLocations[roomCode]) usedLocations[roomCode] = [];
      let unused = chosenCategory.filter(loc =>
        !usedLocations[roomCode].some(u => u.name === loc.name)
      );
      if (unused.length === 0) {
        usedLocations[roomCode] = [];
        unused = [...chosenCategory];
      }

      const spyIndex       = Math.floor(Math.random() * room.length);
      const randomLocation = unused[Math.floor(Math.random() * unused.length)];
      usedLocations[roomCode].push(randomLocation);

      room.forEach((player, idx) => {
        const isSpy = idx === spyIndex;
        io.to(player.id).emit('gameStarted', {
          role    : isSpy ? 'Spy' : randomLocation.name,
          location: randomLocation.name,
          image   : randomLocation.image,
          category: selectedCategory,
          hostId  : roomHosts[roomCode],
        });
      });

      console.log(`🎮  Game started (room ${roomCode})  Spy: ${room[spyIndex].username}`);
    });

    // ── returnToLobbyVote ───────────────────────────────────
    socket.on('returnToLobbyVote', (roomCode) => {
      const room = rooms[roomCode];
      if (!room) return;
      const player = room.find(p => p.id === socket.id);
      if (player) player.returned = true;
      io.to(roomCode).emit('roomData', {
        players: rooms[roomCode],
        hostId : roomHosts[roomCode],
        category: roomCategories[roomCode] || 'Kuwait'
      });
    });

    // ── leaveRoom ───────────────────────────────────────────
    socket.on('leaveRoom', ({ roomCode }) => {
      const room = rooms[roomCode];
      if (!room) return;
      const idx = room.findIndex(p => p.id === socket.id);
      if (idx !== -1) {
        const wasHost = roomHosts[roomCode] === socket.id;
        room.splice(idx, 1);

        if (room.length === 0) {
          delete rooms[roomCode];
          delete usedLocations[roomCode];
          delete roomHosts[roomCode];
          delete roomCategories[roomCode];
          return;
        }
        if (wasHost) {
          roomHosts[roomCode] = room[0].id;
          io.to(roomCode).emit('newHost', roomHosts[roomCode]);
        }
        io.to(roomCode).emit('roomData', {
          players: rooms[roomCode],
          hostId : roomHosts[roomCode],
          category: roomCategories[roomCode] || 'Kuwait'
        });
      }
    });

    // ── disconnect ──────────────────────────────────────────
    socket.on('disconnect', () => {
      clearInterval(inactivityInterval);
      for (const code in rooms) {
        const wasHost = roomHosts[code] === socket.id;
        rooms[code] = rooms[code].filter(p => p.id !== socket.id);
        if (rooms[code].length === 0) {
          delete rooms[code];
          delete usedLocations[code];
          delete roomHosts[code];
          delete roomCategories[code];
          continue;
        }
        if (wasHost) {
          roomHosts[code] = rooms[code][0].id;
          io.to(code).emit('newHost', roomHosts[code]);
        }
        io.to(code).emit('roomData', {
          players: rooms[code],
          hostId : roomHosts[code],
          category: roomCategories[code] || 'Kuwait'
        });
      }
    });
  });

  // 3. Start listening (only after Redis connected)
  server.listen(PORT, () => console.log(`🚀  Server running on port ${PORT}`));
})();

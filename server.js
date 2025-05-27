const express  = require('express');
const http     = require('http');
const { Server } = require('socket.io');
const cors     = require('cors');

const app = express();

/* ---------- static assets ---------- */
app.use('/images', express.static('public/images'));

/* ---------- CORS ---------- */
const allowedOrigins = ['https://chthab.com', 'http://localhost:3000'];
app.use(cors({ origin: allowedOrigins, methods: ['GET', 'POST'] }));

/* ---------- socket.io ---------- */
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: allowedOrigins, methods: ['GET', 'POST'] },
  pingTimeout: 120_000,  // 2 min
  pingInterval: 25_000,
});

const PORT = process.env.PORT || 3001;

/* ---------- game data ---------- */
const locationCategories = {
  Kuwait: [
    { name: "barber",          image: "/images/kuwait/barber.png" },
    { name: "bnaider",         image: "/images/kuwait/bnaider.png" },
    { name: "duwaniya",        image: "/images/kuwait/duwaniya.png" },
    { name: "gahwa",           image: "/images/kuwait/gahwa.png" },
    { name: "gas station",     image: "/images/kuwait/gas station.png" },
    { name: "gym",             image: "/images/kuwait/gym.png" },
    { name: "hospital",        image: "/images/kuwait/hospital.png" },
    { name: "jameia",          image: "/images/kuwait/jameia.png" },
    { name: "library",         image: "/images/kuwait/library.png" },
    { name: "police station",  image: "/images/kuwait/police station.png" },
    { name: "rehab",           image: "/images/kuwait/rehab.png" },
    { name: "school",          image: "/images/kuwait/school.png" },
    { name: "soccer field",    image: "/images/kuwait/soccer field.png" },
    { name: "subiya",          image: "/images/kuwait/subiya.png" },
    { name: "t7weelat",        image: "/images/kuwait/t7weelat.png" },
    { name: "theatre",         image: "/images/kuwait/theatre.png" },
  ],
  "Kuwait-Places": [
    { name: "souq mubarakiya", image: "/images/kuwait-places/souq.png"   },
    { name: "marina mall",     image: "/images/kuwait-places/marina.png" },
    { name: "failaka island",  image: "/images/kuwait-places/failaka.png"},
    { name: "kuwait towers",   image: "/images/kuwait-places/towers.png" },
    { name: "360 mall",        image: "/images/kuwait-places/360.png"    },
  ],
  "Soccer-Players": [
    { name: "ronaldo", image: "/images/soccer-players/ronaldo.png" },
    { name: "messi",   image: "/images/soccer-players/messi.png"   },
    { name: "neymar",  image: "/images/soccer-players/neymar.png"  },
    { name: "mbappe",  image: "/images/soccer-players/mbappe.png"  },
    { name: "modric",  image: "/images/soccer-players/modric.png"  },
  ],
};

/* ---------- in-memory room state ---------- */
const rooms           = {};   // roomCode -> [{id,username,ready,returned}]
const usedLocations   = {};   // roomCode -> [{name,image}]
const roomHosts       = {};   // roomCode -> socket.id
const roomCategories  = {};   // roomCode -> 'Kuwait' | …

const sendRoomData = (roomCode) => {
  io.to(roomCode).emit('roomData', {
    players:   rooms[roomCode],
    hostId:    roomHosts[roomCode],
    category:  roomCategories[roomCode] || 'Kuwait',
  });
};

/* ---------- socket handlers ---------- */
io.on('connection', (socket) => {
  console.log(`🟢  ${socket.id} connected`);

  /* idle-timeout (20 min of silence) */
  let lastActivity = Date.now();
  socket.onAny(() => (lastActivity = Date.now()));
  const inactivityTimer = setInterval(() => {
    if (Date.now() - lastActivity > 1_200_000) { // 20 min
      console.log(`⚠️  ${socket.id} timed-out`);
      socket.disconnect(true);
    }
  }, 5_000);

  /* ---- join room ---- */
  socket.on('joinRoom', ({ roomCode, username }) => {
    if (!roomCode || !username) return;

    if (!rooms[roomCode]) rooms[roomCode] = [];

    /* drop any *old* entry with the same username (fixes quick refresh duplicates) */
    rooms[roomCode] = rooms[roomCode].filter(
      (p) => p.username.toLowerCase() !== username.toLowerCase()
    );

    if (rooms[roomCode].length >= 8) {
      socket.emit('errorMessage', 'Room is full.');
      return;
    }

    rooms[roomCode].push({
      id: socket.id, username, ready: false, returned: false,
    });
    socket.join(roomCode);

    if (!roomHosts[roomCode])      roomHosts[roomCode]     = socket.id;
    if (!roomCategories[roomCode]) roomCategories[roomCode] = 'Kuwait';

    sendRoomData(roomCode);
    io.to(roomCode).emit('newHost', roomHosts[roomCode]);
  });

  /* ---- player ready ---- */
  socket.on('ready', ({ roomCode, playerId }) => {
    const player = rooms[roomCode]?.find((p) => p.id === playerId);
    if (player) player.ready = true;
    sendRoomData(roomCode);
  });

  /* ---- start game ---- */
  socket.on('startGame', ({ roomCode, category }) => {
    const room = rooms[roomCode];
    if (!room || room.length < 2) {
      socket.emit('errorMessage', 'At least 2 players are required.');
      return;
    }

    /* reset flags for a *fresh* round */
    room.forEach((p) => {
      p.ready    = false;
      p.returned = false;
    });

    if (category)            roomCategories[roomCode] = category;
    const chosenCategoryKey = roomCategories[roomCode];
    const chosenCategory    = locationCategories[chosenCategoryKey];
    if (!chosenCategory?.length) {
      socket.emit('errorMessage', 'Invalid category.');
      return;
    }

    if (!usedLocations[roomCode]) usedLocations[roomCode] = [];

    let pool = chosenCategory.filter(
      (loc) => !usedLocations[roomCode].some((u) => u.name === loc.name)
    );
    if (pool.length === 0) {               // exhausted → reset
      usedLocations[roomCode] = [];
      pool = [...chosenCategory];
    }

    const spyIdx   = Math.floor(Math.random() * room.length);
    const location = pool[Math.floor(Math.random() * pool.length)];
    usedLocations[roomCode].push(location);

    room.forEach((player, idx) => {
      const isSpy = idx === spyIdx;
      io.to(player.id).emit('gameStarted', {
        role:     isSpy ? 'Spy' : location.name,
        location: location.name,
        image:    location.image,
        category: chosenCategoryKey,
        hostId:   roomHosts[roomCode],
      });
    });

    console.log(`🎮  ${roomCode} | spy: ${room[spyIdx].username} | ${location.name}`);
  });

  /* ---- vote to return to lobby ---- */
  socket.on('returnToLobbyVote', (roomCode) => {
    const room = rooms[roomCode];
    if (!room) return;

    const player = room.find((p) => p.id === socket.id);
    if (player) player.returned = true;

    /* everyone voted → clear ready flags for next round */
    if (room.every((p) => p.returned)) {
      room.forEach((p) => (p.ready = false));
    }

    sendRoomData(roomCode);
  });

  /* ---- leave room (explicit) ---- */
  socket.on('leaveRoom', ({ roomCode }) => {
    const room = rooms[roomCode];
    if (!room) return;

    const idx     = room.findIndex((p) => p.id === socket.id);
    const wasHost = roomHosts[roomCode] === socket.id;

    if (idx !== -1) room.splice(idx, 1);

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
    sendRoomData(roomCode);
  });

  /* ---- disconnect ---- */
  socket.on('disconnect', () => {
    clearInterval(inactivityTimer);

    for (const code in rooms) {
      const wasHost = roomHosts[code] === socket.id;
      rooms[code] = rooms[code].filter((p) => p.id !== socket.id);

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
      sendRoomData(code);
    }
  });
});

server.listen(PORT, () => {
  console.log(`🚀  Server listening on ${PORT}`);
});

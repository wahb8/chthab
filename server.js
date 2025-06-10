const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();

app.use('/images', express.static('public/images'));

const allowedOrigins = ['https://chthab.com', 'http://localhost:3000'];
app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST'],
}));

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
  },
  pingTimeout: 120000,
  pingInterval: 25000,
});

const PORT = process.env.PORT || 3001;

const locationCategories = {
  Kuwait: [
    { name: "barber", image: "/images/kuwait/barber.png" },
    { name: "bnaider", image: "/images/kuwait/bnaider.png" },
    { name: "duwaniya", image: "/images/kuwait/duwaniya.png" },
    { name: "gahwa", image: "/images/kuwait/gahwa.png" },
    { name: "gas station", image: "/images/kuwait/gas station.png" },
    { name: "gym", image: "/images/kuwait/gym.png" },
    { name: "hospital", image: "/images/kuwait/hospital.png" },
    { name: "jameia", image: "/images/kuwait/jameia.png" },
    { name: "library", image: "/images/kuwait/library.png" },
    { name: "police station", image: "/images/kuwait/police station.png" },
    { name: "rehab", image: "/images/kuwait/rehab.png" },
    { name: "school", image: "/images/kuwait/school.png" },
    { name: "soccer field", image: "/images/kuwait/soccer field.png" },
    { name: "subiya", image: "/images/kuwait/subiya.png" },
    { name: "t7weelat", image: "/images/kuwait/t7weelat.png" },
    { name: "theatre", image: "/images/kuwait/theatre.png" },
  ],
  "Kuwait-Places": [
    { name: "souq mubarakiya", image: "/images/kuwait-places/souq.png" },
    { name: "marina mall", image: "/images/kuwait-places/marina.png" },
    { name: "failaka island", image: "/images/kuwait-places/failaka.png" },
    { name: "kuwait towers", image: "/images/kuwait-places/towers.png" },
    { name: "360 mall", image: "/images/kuwait-places/360.png" }
  ],
  "Soccer-Players": [
    { name: "de jong", image: "/images/soccer-players/de jong.png" },
    { name: "higuain", image: "/images/soccer-players/higuain.png" },
    { name: "rooney", image: "/images/soccer-players/rooney.png" },
    { name: "lewandowski", image: "/images/soccer-players/lewandowski.png" },
    { name: "ronaldinho", image: "/images/soccer-players/ronaldinho.png" },
    { name: "son", image: "/images/soccer-players/son.png" },
    { name: "aguero", image: "/images/soccer-players/aguero.png" },
    { name: "antony", image: "/images/soccer-players/antony.png" },
    { name: "r9", image: "/images/soccer-players/r9.png" },
    { name: "dybala", image: "/images/soccer-players/dybala.png" },
    { name: "mbappe", image: "/images/soccer-players/mbappe.png" },
    { name: "palmer", image: "/images/soccer-players/palmer.png" },
    { name: "yamal", image: "/images/soccer-players/yamal.png" },
    { name: "maradona", image: "/images/soccer-players/maradona.png" },
    { name: "pele", image: "/images/soccer-players/pele.png" },
    { name: "neymar", image: "/images/soccer-players/neymar.png" },
    { name: "modric", image: "/images/soccer-players/modric.png" },
    { name: "ronaldo", image: "/images/soccer-players/ronaldo.png" },
    { name: "messi", image: "/images/soccer-players/messi.png" },
    { name: "neymar", image: "/images/soccer-players/neymar.png" },
    { name: "mbappe", image: "/images/soccer-players/mbappe.png" },
    { name: "modric", image: "/images/soccer-players/modric.png" },
    { name: "salem", image: "/images/soccer-players/salem.png" }

  ]
};

const rooms = {};
const usedLocations = {};
const roomHosts = {};
const roomCategories = {};

io.on('connection', (socket) => {
  console.log(`🟢 User connected: ${socket.id} from ${socket.handshake.address}`);

  let lastActivity = Date.now();
  socket.onAny(() => lastActivity = Date.now());
  const inactivityInterval = setInterval(() => {
    if (Date.now() - lastActivity > 20 * 60 * 1000) {
      console.log(`⚠️ Socket ${socket.id} timed out due to inactivity`);
      socket.disconnect(true);
    }
  }, 5000);

  socket.on('joinRoom', ({ roomCode, username }) => {
    if (!rooms[roomCode]) rooms[roomCode] = [];
    if (!roomHosts[roomCode]) roomHosts[roomCode] = socket.id;
    if (rooms[roomCode].length >= 8) {
      socket.emit('errorMessage', 'Room is full.');
      return;
    }
    const playerExists = rooms[roomCode].some(p => p.id === socket.id);
    if (!playerExists) rooms[roomCode].push({ id: socket.id, username, ready: false, returned: false });
    socket.join(roomCode);
    io.to(roomCode).emit('roomData', {
      players: rooms[roomCode],
      hostId: roomHosts[roomCode],
      category: roomCategories[roomCode] || 'Kuwait'
    });
    io.to(roomCode).emit('newHost', roomHosts[roomCode]);
  });

  socket.on('ready', ({ roomCode, playerId }) => {
    const player = rooms[roomCode]?.find(p => p.id === playerId);
    if (player) player.ready = true;
    io.to(roomCode).emit('roomData', {
      players: rooms[roomCode],
      hostId: roomHosts[roomCode],
      category: roomCategories[roomCode] || 'Kuwait'
    });
  });

  socket.on('updateCategory', ({ roomCode, category }) => {
    if (rooms[roomCode]) {
      roomCategories[roomCode] = category;
      io.to(roomCode).emit('roomData', {
        players: rooms[roomCode],
        hostId: roomHosts[roomCode],
        category: category,
      });
    }
  });

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
    const chosenCategory = locationCategories[selectedCategory];
    if (!chosenCategory || !Array.isArray(chosenCategory) || chosenCategory.length === 0) {
      console.error(`❌ Invalid or empty category: ${selectedCategory}`);
      return;
    }
    if (!usedLocations[roomCode]) usedLocations[roomCode] = [];
    let unusedLocations = chosenCategory.filter(loc =>
      !usedLocations[roomCode].some(used => used.name === loc.name)
    );
    if (unusedLocations.length === 0) {
      usedLocations[roomCode] = [];
      unusedLocations = [...chosenCategory];
    }
    const spyIndex = Math.floor(Math.random() * room.length);
    const randomLocation = unusedLocations[Math.floor(Math.random() * unusedLocations.length)];
    usedLocations[roomCode].push(randomLocation);
    const locationName = randomLocation.name;
    const image = randomLocation.image;
    room.forEach((player, index) => {
      const isSpy = index === spyIndex;
      const role = isSpy ? 'Spy' : locationName;
      io.to(player.id).emit('gameStarted', {
        role,
        location: locationName,
        image,
        category: selectedCategory,
        hostId: roomHosts[roomCode],
      });
    });
    console.log(`🎮 Game started in room ${roomCode}`);
    console.log(`🕵️ Spy: ${room[spyIndex].username}`);
    console.log(`📍 Location: ${locationName} (Category: ${selectedCategory})`);
  });

  socket.on('returnToLobbyVote', (roomCode) => {
    const room = rooms[roomCode];
    if (!room) return;
    const player = room.find(p => p.id === socket.id);
    if (player) player.returned = true;
    io.to(roomCode).emit('roomData', {
      players: rooms[roomCode],
      hostId: roomHosts[roomCode],
      category: roomCategories[roomCode] || 'Kuwait'
    });
  });

  socket.on('leaveRoom', ({ roomCode }) => {
    const room = rooms[roomCode];
    if (!room) return;
    const index = room.findIndex(p => p.id === socket.id);
    if (index !== -1) {
      const wasHost = roomHosts[roomCode] === socket.id;
      room.splice(index, 1);
      if (room.length === 0) {
        delete rooms[roomCode];
        delete usedLocations[roomCode];
        delete roomHosts[roomCode];
        delete roomCategories[roomCode];
        return;
      }
      if (wasHost) {
        const newHost = room[0];
        roomHosts[roomCode] = newHost.id;
        io.to(roomCode).emit('newHost', newHost.id);
      }
      io.to(roomCode).emit('roomData', {
        players: rooms[roomCode],
        hostId: roomHosts[roomCode],
        category: roomCategories[roomCode] || 'Kuwait'
      });
    }
  });

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
        const newHost = rooms[code][0];
        roomHosts[code] = newHost.id;
        io.to(code).emit('newHost', newHost.id);
      }
      io.to(code).emit('roomData', {
        players: rooms[code],
        hostId: roomHosts[code],
        category: roomCategories[code] || 'Kuwait'
      });
    }
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});

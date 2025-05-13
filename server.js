const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const path = require('path');

// ✅ Serve static images like /images/kuwait/bnaider.png
app.use('/images', express.static('public/images'));

const server = http.createServer(app);

// Allow CORS for requests from the frontend
app.use(cors({ origin: 'http://localhost:3000' }));

const io = new Server(server, {
  cors: {
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
});

const PORT = 3001;

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
  ]
};

const rooms = {};
const usedLocations = {};
const roomHosts = {};

io.on('connection', (socket) => {
  console.log(`🟢 User connected: ${socket.id}`);

  socket.on('joinRoom', ({ roomCode, username, isHost }) => {
    console.log(`➡️ joinRoom: ${username} joining ${roomCode} (Host: ${isHost})`);

    if (!rooms[roomCode]) {
      rooms[roomCode] = [];
    }
    
    if (!roomHosts[roomCode]) {
      roomHosts[roomCode] = socket.id;
    }
    
    else {
      if (!rooms[roomCode]) {
        console.log(`❌ Room ${roomCode} does not exist.`);
        socket.emit('errorMessage', 'Room does not exist.');
        return;
      }
      if (rooms[roomCode].length >= 8) {
        console.log(`❌ Room ${roomCode} is full.`);
        socket.emit('errorMessage', 'Room is full.');
        return;
      }
    }

    const playerExists = rooms[roomCode].some((p) => p.id === socket.id);
    if (!playerExists) {
      const newPlayer = {
        id: socket.id,
        username,
        ready: false,
        returned: false,
      };
      rooms[roomCode].push(newPlayer);
      console.log(`✅ Added player ${username} to room ${roomCode}`);
    }

    console.log(`📋 Current players in ${roomCode}:`, rooms[roomCode].map(p => p.username));
    socket.join(roomCode);
    io.to(roomCode).emit('roomData', {
      players: rooms[roomCode],
      hostId: roomHosts[roomCode]
    });
    

    io.to(roomCode).emit('newHost', roomHosts[roomCode]); // ✅ Always tell room who the host is

  });

  socket.on('ready', ({ roomCode, playerId }) => {
    const player = rooms[roomCode]?.find((p) => p.id === playerId);
    if (player) {
      player.ready = true;
      console.log(`✅ ${player.username} is ready in ${roomCode}`);
    }

    io.to(roomCode).emit('roomData', {
      players: rooms[roomCode],
      hostId: roomHosts[roomCode]
    });
    
  });

  socket.on('startGame', ({ roomCode, category }) => {
    const room = rooms[roomCode];
    if (!room || room.length < 2) {
      console.log(`❌ Not enough players to start the game in room ${roomCode}`);
      socket.emit('errorMessage', 'At least 2 players are required to start the game.');
      return;
    }

    room.forEach(p => p.returned = false);

    const chosenCategory = locationCategories[category] || locationCategories['Kuwait'];
    if (!chosenCategory || !Array.isArray(chosenCategory) || chosenCategory.length === 0) {
      console.error(`❌ Invalid or empty category: ${category}`);
      return;
    }

    if (!usedLocations[roomCode]) usedLocations[roomCode] = [];

    const unusedLocations = chosenCategory.filter(loc =>
      !usedLocations[roomCode].some(used => used.name === loc.name)
    );

    if (unusedLocations.length === 0) {
      usedLocations[roomCode] = [];
      unusedLocations.push(...chosenCategory);
    }

    const spyIndex = Math.floor(Math.random() * room.length);
    const randomLocation = unusedLocations[Math.floor(Math.random() * unusedLocations.length)];

    usedLocations[roomCode].push(randomLocation);

    const locationName = randomLocation.name;
    const image = randomLocation.image;

    room.forEach((player, index) => {
      const isSpy = index === spyIndex;
      const role = isSpy ? 'Spy' : locationName;
      const imageToSend = randomLocation.image;

      io.to(player.id).emit('gameStarted', {
        role,
        location: locationName,
        image: imageToSend,
        hostId: roomHosts[roomCode] // ✅ send current host ID
      });
    });

    console.log(`🎮 Game started in room ${roomCode}`);
    console.log(`🕵️ Spy is ${room[spyIndex].username}`);
    console.log(`📍 Location is: ${locationName} (Category: ${category})`);
  });

  socket.on('returnToLobbyVote', (roomCode) => {
    const room = rooms[roomCode];
    if (!room) return;

    const player = room.find((p) => p.id === socket.id);
    if (player) {
      player.returned = true;
      console.log(`🔁 ${player.username} voted to return to lobby in ${roomCode}`);
    }

    io.to(roomCode).emit('roomData', {
      players: rooms[roomCode],
      hostId: roomHosts[roomCode]
    });
    
  });

  socket.on('leaveRoom', ({ roomCode }) => {
    const room = rooms[roomCode];
    if (!room) return;

    const leavingIndex = room.findIndex(p => p.id === socket.id);
    if (leavingIndex !== -1) {
      const wasHost = roomHosts[roomCode] === socket.id;
      const [leavingPlayer] = room.splice(leavingIndex, 1);
      console.log(`🚪 ${leavingPlayer.username} left room ${roomCode}`);

      if (room.length === 0) {
        delete rooms[roomCode];
        delete usedLocations[roomCode];
        delete roomHosts[roomCode];
        console.log(`🗑️ Room ${roomCode} deleted (empty)`);
        return;
      }

      if (wasHost) {
        const newHost = room[0];
        roomHosts[roomCode] = newHost.id;
        console.log(`👑 New host for ${roomCode}: ${newHost.username}`);
        io.to(roomCode).emit('newHost', newHost.id);
      }

      io.to(roomCode).emit('roomData', {
        players: rooms[roomCode],
        hostId: roomHosts[roomCode]
      });
      
    }
  });

  socket.on('disconnect', () => {
    console.log(`🔴 User disconnected: ${socket.id}`);
    for (const roomCode in rooms) {
      const wasHost = roomHosts[roomCode] === socket.id;

      rooms[roomCode] = rooms[roomCode].filter((p) => p.id !== socket.id);

      if (rooms[roomCode].length === 0) {
        delete rooms[roomCode];
        delete usedLocations[roomCode];
        delete roomHosts[roomCode];
        console.log(`🗑️ Room ${roomCode} deleted (empty)`);
        continue;
      }

      if (wasHost) {
        const newHost = rooms[roomCode][0];
        roomHosts[roomCode] = newHost.id;
        console.log(`👑 New host for ${roomCode}: ${newHost.username}`);
        io.to(roomCode).emit('newHost', newHost.id);
      }

      io.to(roomCode).emit('roomData', {
        players: rooms[roomCode],
        hostId: roomHosts[roomCode]
      });
      
    }
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});

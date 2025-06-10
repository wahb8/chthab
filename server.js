const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();

app.use('/images', express.static('public/images'));

const allowedOrigins = [
  'https://chthab.com',
  'http://localhost:3000',
  'http://localhost:3001'
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) === -1) {
      return callback(new Error('CORS not allowed'), false);
    }
    return callback(null, true);
  },
  methods: ['GET', 'POST'],
  credentials: true
}));

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['websocket', 'polling']
});

const PORT = process.env.PORT || 3001;

// Game categories and locations
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
    { name: "salem", image: "/images/soccer-players/salem.png" }
  ]
};

// Constants
const ROOM_CODE_REGEX = /^[A-Z0-9]{6}$/;
const MAX_PLAYERS = 8;
const RECONNECT_GRACE_PERIOD = 5000;
const ROOM_CLEANUP_INTERVAL = 300000; // 5 minutes

// Room state management
const rooms = {};
const usedLocations = {};
const roomHosts = {};
const roomCategories = {};
const disconnectedPlayers = new Map(); // Track recently disconnected players

// Utility functions
function validateRoomCode(roomCode) {
  return typeof roomCode === 'string' && ROOM_CODE_REGEX.test(roomCode);
}

function validateUsername(username) {
  return typeof username === 'string' && username.length >= 1 && username.length <= 20;
}

function cleanupRoom(roomCode) {
  delete rooms[roomCode];
  delete usedLocations[roomCode];
  delete roomHosts[roomCode];
  delete roomCategories[roomCode];
}

// Periodic cleanup of empty rooms
setInterval(() => {
  for (const roomCode in rooms) {
    if (rooms[roomCode].length === 0) {
      console.log(`🧹 Cleaning up empty room: ${roomCode}`);
      cleanupRoom(roomCode);
    }
  }
}, ROOM_CLEANUP_INTERVAL);

io.on('connection', (socket) => {
  console.log(`🟢 User connected: ${socket.id} from ${socket.handshake.address}`);

  let lastActivity = Date.now();
  let currentRoom = null;

  socket.onAny(() => lastActivity = Date.now());

  // Handle room joining
  socket.on('joinRoom', ({ roomCode, username }) => {
    try {
      console.log(`Attempting to join room: ${roomCode} with username: ${username}`);
      
      // Validate input
      if (!roomCode || !username) {
        console.log('Missing roomCode or username');
        socket.emit('errorMessage', 'Room code and username are required');
        return;
      }

      if (!validateRoomCode(roomCode)) {
        console.log(`Invalid room code format: ${roomCode}`);
        socket.emit('errorMessage', 'Invalid room code format');
        return;
      }
      
      if (!validateUsername(username)) {
        console.log(`Invalid username format: ${username}`);
        socket.emit('errorMessage', 'Username must be between 1 and 20 characters');
        return;
      }

      // Check if player was recently disconnected
      const disconnectedData = disconnectedPlayers.get(socket.id);
      if (disconnectedData && disconnectedData.roomCode === roomCode) {
        console.log(`Reconnecting previously disconnected player: ${username}`);
        disconnectedPlayers.delete(socket.id);
      }

      // Initialize room if it doesn't exist
      if (!rooms[roomCode]) {
        console.log(`Creating new room: ${roomCode}`);
        rooms[roomCode] = [];
        roomHosts[roomCode] = socket.id;
        roomCategories[roomCode] = 'Kuwait';
      }

      // Check room capacity
      if (rooms[roomCode].length >= MAX_PLAYERS) {
        console.log(`Room ${roomCode} is full`);
        socket.emit('errorMessage', 'Room is full');
        return;
      }

      // Leave current room if in one
      if (currentRoom) {
        console.log(`Leaving current room ${currentRoom} to join ${roomCode}`);
        socket.leave(currentRoom);
        rooms[currentRoom] = rooms[currentRoom].filter(p => p.id !== socket.id);
        if (rooms[currentRoom].length === 0) {
          cleanupRoom(currentRoom);
        }
      }

      // Join new room
      currentRoom = roomCode;
      socket.join(roomCode);

      // Add player to room if not already present
      const playerExists = rooms[roomCode].some(p => p.id === socket.id);
      if (!playerExists) {
        rooms[roomCode].push({
          id: socket.id,
          username,
          ready: false,
          returned: false,
          joinedAt: Date.now()
        });
      }

      console.log(`Successfully joined room ${roomCode}. Current players: ${rooms[roomCode].length}`);

      // Emit room data
      io.to(roomCode).emit('roomData', {
        players: rooms[roomCode],
        hostId: roomHosts[roomCode],
        category: roomCategories[roomCode]
      });

      console.log(`User ${username} joined room ${roomCode}`);
    } catch (error) {
      console.error('Error in joinRoom:', error);
      let errorMessage = 'Failed to join room';
      
      // Provide more specific error messages based on the error type
      if (error.name === 'ValidationError') {
        errorMessage = error.message;
      } else if (error.code === 'ECONNREFUSED') {
        errorMessage = 'Connection to server failed';
      }
      
      socket.emit('errorMessage', errorMessage);
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    try {
      if (currentRoom) {
        // Store player data temporarily
        const playerData = rooms[currentRoom].find(p => p.id === socket.id);
        if (playerData) {
          disconnectedPlayers.set(socket.id, {
            ...playerData,
            roomCode: currentRoom,
            disconnectedAt: Date.now()
          });

          // Remove player after grace period if not reconnected
          setTimeout(() => {
            if (disconnectedPlayers.has(socket.id)) {
              disconnectedPlayers.delete(socket.id);
              
              // Only clean up if the room still exists
              if (rooms[currentRoom]) {
                const wasHost = roomHosts[currentRoom] === socket.id;
                rooms[currentRoom] = rooms[currentRoom].filter(p => p.id !== socket.id);

                if (rooms[currentRoom].length === 0) {
                  cleanupRoom(currentRoom);
                } else if (wasHost) {
                  roomHosts[currentRoom] = rooms[currentRoom][0].id;
                  io.to(currentRoom).emit('newHost', roomHosts[currentRoom]);
                }

                io.to(currentRoom).emit('roomData', {
                  players: rooms[currentRoom],
                  hostId: roomHosts[currentRoom],
                  category: roomCategories[currentRoom]
                });
              }
            }
          }, RECONNECT_GRACE_PERIOD);
        }
      }
    } catch (error) {
      console.error('Error in disconnect handler:', error);
    }
  });

  // Handle ready state
  socket.on('ready', ({ roomCode, playerId }) => {
    try {
      if (!rooms[roomCode]) return;
      
      const player = rooms[roomCode].find(p => p.id === playerId);
      if (player) {
        player.ready = true;
        io.to(roomCode).emit('roomData', {
          players: rooms[roomCode],
          hostId: roomHosts[roomCode],
          category: roomCategories[roomCode]
        });
      }
    } catch (error) {
      console.error('Error in ready handler:', error);
    }
  });

  // Handle room state sync requests
  socket.on('syncRoom', ({ roomCode }) => {
    try {
      if (rooms[roomCode]) {
        socket.emit('roomData', {
          players: rooms[roomCode],
          hostId: roomHosts[roomCode],
          category: roomCategories[roomCode]
        });
      }
    } catch (error) {
      console.error('Error in syncRoom handler:', error);
    }
  });

  // Add these handlers inside the io.on('connection', (socket) => { ... }) block
  socket.on('updateCategory', ({ roomCode, category }) => {
    try {
      if (rooms[roomCode]) {
        roomCategories[roomCode] = category;
        io.to(roomCode).emit('roomData', {
          players: rooms[roomCode],
          hostId: roomHosts[roomCode],
          category: category,
        });
      }
    } catch (error) {
      console.error('Error in updateCategory handler:', error);
    }
  });

  socket.on('startGame', ({ roomCode, category }) => {
    try {
      const room = rooms[roomCode];
      if (!room || room.length < 2) {
        socket.emit('errorMessage', 'At least 2 players are required to start the game.');
        return;
      }

      room.forEach(p => p.returned = false);
      
      if (category) {
        roomCategories[roomCode] = category;
      } else if (!roomCategories[roomCode]) {
        roomCategories[roomCode] = 'Kuwait';
      }

      const selectedCategory = roomCategories[roomCode];
      const chosenCategory = locationCategories[selectedCategory];

      if (!chosenCategory || !Array.isArray(chosenCategory) || chosenCategory.length === 0) {
        console.error(`❌ Invalid or empty category: ${selectedCategory}`);
        socket.emit('errorMessage', 'Invalid game category');
        return;
      }

      if (!usedLocations[roomCode]) {
        usedLocations[roomCode] = [];
      }

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
    } catch (error) {
      console.error('Error in startGame handler:', error);
      socket.emit('errorMessage', 'Failed to start game');
    }
  });

  socket.on('returnToLobbyVote', (roomCode) => {
    try {
      const room = rooms[roomCode];
      if (!room) return;
      
      const player = room.find(p => p.id === socket.id);
      if (player) {
        player.returned = true;
        io.to(roomCode).emit('roomData', {
          players: rooms[roomCode],
          hostId: roomHosts[roomCode],
          category: roomCategories[roomCode]
        });
      }
    } catch (error) {
      console.error('Error in returnToLobbyVote handler:', error);
    }
  });

  // Add leaveRoom handler
  socket.on('leaveRoom', ({ roomCode }) => {
    try {
      const room = rooms[roomCode];
      if (!room) return;

      socket.leave(roomCode);
      const index = room.findIndex(p => p.id === socket.id);
      
      if (index !== -1) {
        const wasHost = roomHosts[roomCode] === socket.id;
        room.splice(index, 1);
        
        if (room.length === 0) {
          cleanupRoom(roomCode);
          return;
        }
        
        if (wasHost) {
          roomHosts[roomCode] = room[0].id;
          io.to(roomCode).emit('newHost', roomHosts[roomCode]);
        }
        
        io.to(roomCode).emit('roomData', {
          players: room,
          hostId: roomHosts[roomCode],
          category: roomCategories[roomCode]
        });
      }

      if (currentRoom === roomCode) {
        currentRoom = null;
      }
    } catch (error) {
      console.error('Error in leaveRoom handler:', error);
    }
  });

  // Inactivity check
  const inactivityInterval = setInterval(() => {
    const inactiveTime = Date.now() - lastActivity;
    if (inactiveTime > 15 * 60 * 1000) { // 15 minutes
      socket.emit('inactivityWarning', 'You have been inactive for 15 minutes');
    }
    if (inactiveTime > 20 * 60 * 1000) { // 20 minutes
      console.log(`⚠️ Socket ${socket.id} timed out due to inactivity`);
      socket.disconnect(true);
    }
  }, 60000); // Check every minute

  socket.on('disconnect', () => {
    clearInterval(inactivityInterval);
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});

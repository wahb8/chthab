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

const allowedOrigins = [
  'https://chthab.com',
  'https://www.chthab.com',
  'http://localhost:3000' // Keep for local development
];

app.use(cors({
  origin: function(origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { 
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  },
  pingTimeout: 120000,
  pingInterval: 25000,
  connectTimeout: 45000,
  maxHttpBufferSize: 1e8,
  transports: ['websocket', 'polling'],
  allowEIO3: true
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
  ],
  "Kuwaiti-Shows": [
  { name: "اقبال يوم أقبلت", image: "/images/Kuwaiti-Shows/اقبال يوم أقبلت.png" },
  { name: "الحيالة", image: "/images/Kuwaiti-Shows/الحيالة.png" },
  { name: "العافور", image: "/images/Kuwaiti-Shows/العافور.png" },
  { name: "امنا رويحة الجنة", image: "/images/Kuwaiti-Shows/امنا رويحة الجنة.png" },
  { name: "خالتي قماشة", image: "/images/Kuwaiti-Shows/خالتي قماشة.png" },
  { name: "درب الزلق", image: "/images/Kuwaiti-Shows/درب الزلق.png" },
  { name: "دفعة القاهرة", image: "/images/Kuwaiti-Shows/دفعة القاهره.png" },
  { name: "زوارة خميس", image: "/images/Kuwaiti-Shows/زوارة خميس.png" },
  { name: "ساق البامبو", image: "/images/Kuwaiti-Shows/ساق البامبو.png" },
  { name: "ساهر الليل", image: "/images/Kuwaiti-Shows/ساهر الليل.png" },
  { name: "فضه قلبها ابيض", image: "/images/Kuwaiti-Shows/فضة قلبها ابيض.png" },
  { name: "مدرسة النخبة", image: "/images/Kuwaiti-Shows/مدرسة النخبة.png" }
  ],
  "Saudi-Celebrities": [
  { name: "عبدالرحمن الشهري", image: "/images/Saudi-Celebrities/عبدالرحمن الشهري.png" },
  { name: "أبو ربيعه", image: "/images/Saudi-Celebrities/أبو ربيعه.png" }, 
  { name: "أحمد الشقيري", image: "/images/Saudi-Celebrities/أحمد الشقيري.png" },
  { name: "عبدالعزيز الدوسري", image: "/images/Saudi-Celebrities/عبدالعزيز الدوسري.png" },
  { name: "التمساح", image: "/images/Saudi-Celebrities/التمساح.png" },
  { name: "بدر صالح", image: "/images/Saudi-Celebrities/بدر صالح.png" },
  { name: "بندرتيا", image: "/images/Saudi-Celebrities/بندرتيا.png" }, 
  { name: "دحومي999", image: "/images/Saudi-Celebrities/دحومي999.png" },
  { name: "فهد التمساح", image: "/images/Saudi-Celebrities/فهد التمساح.png" },
  { name: "فهد سال", image: "/images/Saudi-Celebrities/فهد سال.png" },
  { name: "حسون البارقي", image: "/images/Saudi-Celebrities/حسون البارقي.png" }, 
  { name: "خلف زون", image: "/images/Saudi-Celebrities/خلف زون.png" },
  { name: "مجرم قيمز", image: "/images/Saudi-Celebrities/مجرم قيمز.png" }, 
  { name: "مشيع", image: "/images/Saudi-Celebrities/مشيع.png" },
  { name: "مستر شنب", image: "/images/Saudi-Celebrities/مستر شنب.png" },
  { name: "ناصر القصبي", image: "/images/Saudi-Celebrities/ناصر القصبي.png" },
  { name: "يزيد الراجحي", image: "/images/Saudi-Celebrities/يزيد الراجحي.png" }
 ],
 "Fatayer": [
  { name: "بيتزا", image: "/images/Fatayer/بيتزا.png" },
  { name: "جبن", image: "/images/Fatayer/جبن.png" },
  { name: "حلوم", image: "/images/Fatayer/حلوم.png" },
  { name: "زعتر", image: "/images/Fatayer/زعتر.png" },
  { name: "فلافل", image: "/images/Fatayer/فلافل.png" },
  { name: "قيمر وعسل", image: "/images/Fatayer/قيمر وعسل.png" },
  { name: "لبنه", image: "/images/Fatayer/لبنه.png" },
  { name: "لحم", image: "/images/Fatayer/لحم.png" },
  { name: "نقانق", image: "/images/Fatayer/نقانق.png" },
  { name: "نوتيلا", image: "/images/Fatayer/نوتيلا.png" }
]



};

// ── In-memory state (same as before) ─────────────────────────
const rooms           = {};
const usedLocations   = {};
const roomHosts       = {};
const roomCategories  = {};
const roomTimestamps  = {};  // Track when rooms were last active

// ────────────────────────────────────────────────────────────
//  Main bootstrap – waits for Redis before starting server
// ────────────────────────────────────────────────────────────
(async () => {
  try {
    // 1. Connect to Redis and plug into Socket.IO
    const pubClient = createClient({ 
      url: process.env.REDIS_URL,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            console.log('❌ Redis connection failed after 10 retries');
            return new Error('Redis connection failed');
          }
          return Math.min(retries * 100, 3000);
        }
      }
    });
    const subClient = pubClient.duplicate();
    
    try {
      await pubClient.connect();
      await subClient.connect();
      io.adapter(createAdapter(pubClient, subClient));
      console.log('🚦  Redis adapter attached');
    } catch (redisError) {
      console.log('⚠️  Redis connection failed, running without Redis adapter');
      console.log('ℹ️  Make sure REDIS_URL environment variable is set correctly');
    }

    // 2. Socket.IO event handlers (all original logic)
    io.on('connection', (socket) => {
      console.log(`🟢  User connected: ${socket.id} (${socket.handshake.address})`);

      // ── joinRoom ────────────────────────────────────────────
      socket.on('joinRoom', ({ roomCode, username }) => {
        // Validate room code format
        if (!roomCode || typeof roomCode !== 'string' || roomCode.length !== 6) {
          socket.emit('errorMessage', 'Invalid room code format.');
          return;
        }

        if (!rooms[roomCode]) {
          rooms[roomCode] = [];      // create if first player
          roomHosts[roomCode] = socket.id;  // Only set host if creating new room
        }

        if (rooms[roomCode].length >= 8) {
          socket.emit('errorMessage', 'Room is full.');
          return;
        }

        const exists = rooms[roomCode].some(p => p.id === socket.id);
        if (!exists) rooms[roomCode].push({ id: socket.id, username, ready:false, returned:false });

        socket.join(roomCode);
        roomCategories[roomCode] = roomCategories[roomCode] || 'Kuwait';
        io.to(roomCode).emit('roomData', {
          players: rooms[roomCode],
          hostId : roomHosts[roomCode],
          category: roomCategories[roomCode]
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

        // Reset all players' ready state when starting a new game
        room.forEach(p => {
          p.ready = false;
          p.returned = false;
        });

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
        if (player) {
          player.returned = true;
          // Reset all players' ready state
          room.forEach(p => p.ready = false);
        }
        io.to(roomCode).emit('roomData', {
          players: rooms[roomCode],
          hostId : roomHosts[roomCode],
          category: roomCategories[roomCode] || 'Kuwait'
        });
      });

      // ── leaveRoom ───────────────────────────────────────────
      socket.on('leaveRoom', ({ roomCode }) => {
        const room = rooms[roomCode];
        if (!room) {
          socket.emit('errorMessage', 'Room not found.');
          return;
        }

        const idx = room.findIndex(p => p.id === socket.id);
        if (idx === -1) {
          socket.emit('errorMessage', 'You are not in this room.');
          return;
        }

        const wasHost = roomHosts[roomCode] === socket.id;
        room.splice(idx, 1);

        // Notify other players that someone left
        io.to(roomCode).emit('playerLeft', {
          playerId: socket.id,
          remainingPlayers: room.length
        });

        if (room.length === 0) {
          delete rooms[roomCode];
          delete usedLocations[roomCode];
          delete roomHosts[roomCode];
          delete roomCategories[roomCode];
          delete roomTimestamps[roomCode];
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
      });

      // ── kickPlayer ───────────────────────────────────────────
      socket.on('kickPlayer', ({ roomCode, playerId }) => {
        const room = rooms[roomCode];
        if (!room) return;

        // Verify the kicker is the host
        if (roomHosts[roomCode] !== socket.id) {
          socket.emit('errorMessage', 'Only the host can kick players.');
          return;
        }

        // Don't allow kicking yourself
        if (playerId === socket.id) {
          socket.emit('errorMessage', 'You cannot kick yourself.');
          return;
        }

        const playerIndex = room.findIndex(p => p.id === playerId);
        if (playerIndex !== -1) {
          const kickedPlayer = room[playerIndex];
          room.splice(playerIndex, 1);
          
          // Notify the kicked player
          io.to(playerId).emit('kicked');
          
          // Update room for remaining players
          io.to(roomCode).emit('roomData', {
            players: rooms[roomCode],
            hostId : roomHosts[roomCode],
            category: roomCategories[roomCode] || 'Kuwait'
          });
        }
      });

      // ── disconnect ──────────────────────────────────────────
      socket.on('disconnect', () => {
        for (const code in rooms) {
          const room = rooms[code];
          const wasHost = roomHosts[code] === socket.id;
          const playerIndex = room.findIndex(p => p.id === socket.id);
          
          if (playerIndex !== -1) {
            // Notify other players that someone disconnected
            io.to(code).emit('playerLeft', {
              playerId: socket.id,
              remainingPlayers: room.length - 1
            });

            rooms[code] = room.filter(p => p.id !== socket.id);
            
            if (rooms[code].length === 0) {
              delete rooms[code];
              delete usedLocations[code];
              delete roomHosts[code];
              delete roomCategories[code];
              delete roomTimestamps[code];
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
        }
      });
    });

    // 3. Start listening (only after Redis connected)
    server.listen(PORT, () => console.log(`🚀  Server running on port ${PORT}`));
  } catch (error) {
    console.error('❌  Error during server startup:', error);
  }
})();

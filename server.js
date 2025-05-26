// GamePage.js
import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import socket from './socket';
import './GamePage.css';

// All possible location categories (should match server)
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
    { name: "theatre", image: "/images/kuwait/theatre.png" }
  ],
  "Kuwait-Places": [
    { name: "souq mubarakiya", image: "/images/kuwait-places/souq.png" },
    { name: "marina mall", image: "/images/kuwait-places/marina.png" },
    { name: "failaka island", image: "/images/kuwait-places/failaka.png" },
    { name: "kuwait towers", image: "/images/kuwait-places/towers.png" },
    { name: "360 mall", image: "/images/kuwait-places/360.png" }
  ],
  "Soccer-Players": [
    { name: "ronaldo", image: "/images/soccer-players/ronaldo.png" },
    { name: "messi", image: "/images/soccer-players/messi.png" },
    { name: "neymar", image: "/images/soccer-players/neymar.png" },
    { name: "mbappe", image: "/images/soccer-players/mbappe.png" },
    { name: "modric", image: "/images/soccer-players/modric.png" }
  ]
};

function GamePage() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const {
    role,
    location: gameLocation,
    image,
    roomCode,
    username = 'anonymous',
    category: initCategory
  } = state || {};

  const isArabic = true;
  const [voted, setVoted] = useState(false);
  const [pendingVote, setPendingVote] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(initCategory || 'Kuwait');

  // Update category if server sends one later
  useEffect(() => {
    const handleRoomData = ({ players, category }) => {
      if (category && category !== selectedCategory) {
        setSelectedCategory(category);
      }
      if (players.length === 1) {
        navigate(`/lobby?roomCode=${roomCode}&username=${username}`);
        return;
      }
      const votes = players.filter(p => p.returned).length;
      if (votes === players.length) {
        navigate(`/lobby?roomCode=${roomCode}&username=${username}`);
      }
    };
    socket.on('roomData', handleRoomData);
    return () => socket.off('roomData', handleRoomData);
  }, [navigate, roomCode, username, selectedCategory]);

  // Buffer vote flush on reconnect
  useEffect(() => {
    const flush = () => {
      if (pendingVote && socket.connected) {
        socket.emit('returnToLobbyVote', roomCode);
        setPendingVote(false);
        setVoted(true);
      }
    };
    socket.on('connect', flush);
    return () => socket.off('connect', flush);
  }, [pendingVote, roomCode]);

  // Reconnect logic
  useEffect(() => {
    const onFocus = () => { if (!socket.connected) socket.connect(); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);
  useEffect(() => {
    const onDisconnect = () => socket.connect();
    socket.on('disconnect', onDisconnect);
    return () => socket.off('disconnect', onDisconnect);
  }, []);

  const handleVote = () => {
    if (voted) return;
    if (!socket.connected) {
      setPendingVote(true);
      socket.connect();
    } else {
      socket.emit('returnToLobbyVote', roomCode);
      setVoted(true);
    }
  };

  // Grid styling
  const gridStyle = { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(120px, 1fr))', gap: '16px', margin: '20px' };
  const itemStyle = { textAlign: 'center' };
  const imgStyle = { width: '120px', height: '120px', objectFit: 'cover', borderRadius: '8px' };

  return (
    <div className="game-container">
      <h1>{isArabic ? '!اللعبة بدت' : 'Game Started!'}</h1>

      {role === 'Spy' ? (
        <p>{isArabic ? 'الدور:' : 'Role:'} {isArabic ? 'الجذاب' : 'Spy'}</p>
      ) : (
        <p>{isArabic ? 'المكان:' : 'Location:'} {gameLocation}</p>
      )}

      {role !== 'Spy' && image && (
        <div className="image-wrapper">
          <img src={`https://chthab.onrender.com${image}`} alt="location" className="location-image" />
        </div>
      )}

      {/* Back to Lobby Button */}
      <div className="button-wrapper">
        <button className={`return-button ${voted ? 'voted' : ''}`} onClick={handleVote}>
          {voted
            ? (isArabic ? '... ناطرين الباجي' : 'Waiting for others...')
            : (isArabic ? 'رجوع للغرفة' : 'Back to Lobby')}
        </button>
      </div>

      {/* Always show location grid below everything */}
      <div style={gridStyle}>
        {locationCategories[selectedCategory].map(loc => (
          <div key={loc.name} style={itemStyle}>
            <img src={`https://chthab.onrender.com${loc.image}`} alt={loc.name} style={imgStyle} />
            <p>{loc.name}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default GamePage;

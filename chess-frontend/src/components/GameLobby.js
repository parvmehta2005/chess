import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from './Navbar';
import './GameLobby.css';

const GameLobby = () => {
  const [user, setUser] = useState(null);
  const [activeGames, setActiveGames] = useState([]);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem('user'));
    if (!storedUser) {
      navigate('/login');
      return;
    }
    setUser(storedUser);
    fetchActiveGames();
  }, [navigate]);

  const fetchActiveGames = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/games/active', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch active games');
      const data = await response.json();
      setActiveGames(data);
    } catch (err) {
      setError('Failed to load active games');
    }
  };

  const handleCreateGame = async (mode) => {
    try {
      const response = await fetch('http://localhost:5000/api/games', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ mode })
      });

      if (!response.ok) throw new Error('Failed to create game');
      const game = await response.json();
      navigate(`/game/${game._id}`);
    } catch (err) {
      setError('Failed to create game');
    }
  };

  const handleJoinGame = async (gameId) => {
    try {
      const response = await fetch(`http://localhost:5000/api/games/${gameId}/join`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) throw new Error('Failed to join game');
      navigate(`/game/${gameId}`);
    } catch (err) {
      setError('Failed to join game');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <div className="lobby-container">
      <Navbar username={user?.username} onLogout={handleLogout} />
      
      <div className="lobby-header">
        <h1 className="lobby-title">Welcome to Chess Game</h1>
        <p className="lobby-subtitle">Choose a game mode to start playing</p>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="game-modes">
        <div className="game-mode-card" onClick={() => handleCreateGame('local')}>
          <h3>
            <span className="icon">👥</span>
            Local Game
          </h3>
          <p>Play against a friend on the same device. Perfect for learning and practice.</p>
        </div>

        <div className="game-mode-card" onClick={() => handleCreateGame('online')}>
          <h3>
            <span className="icon">🌐</span>
            Online Game
          </h3>
          <p>Challenge players from around the world in real-time matches.</p>
        </div>

        <div className="game-mode-card" onClick={() => handleCreateGame('computer')}>
          <h3>
            <span className="icon">🤖</span>
            Computer Game
          </h3>
          <p>Test your skills against our AI opponent powered by Stockfish.</p>
        </div>
      </div>

      <div className="active-games">
        <h2>
          <span className="icon">🎮</span>
          Active Games
        </h2>
        <div className="game-list">
          {activeGames.map(game => (
            <div key={game._id} className="game-item">
              <div className="game-info">
                <span className="game-mode">
                  {game.mode === 'local' ? 'Local Game' : 
                   game.mode === 'online' ? 'Online Game' : 'Computer Game'}
                </span>
                <span className="game-status">
                  {game.status === 'waiting' ? 'Waiting for opponent' :
                   game.status === 'active' ? 'Game in progress' :
                   game.status === 'completed' ? 'Game completed' : game.status}
                </span>
              </div>
              <button
                className="join-button"
                onClick={() => handleJoinGame(game._id)}
                disabled={game.status !== 'waiting'}
              >
                Join Game
              </button>
            </div>
          ))}
          {activeGames.length === 0 && (
            <p className="no-games">No active games found. Create a new game to start playing!</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default GameLobby; 
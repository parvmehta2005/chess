import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './GameLobby.css';

const GameLobby = () => {
  const navigate = useNavigate();
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedMode, setSelectedMode] = useState(null);

  useEffect(() => {
    fetchGames();
  }, []);

  const fetchGames = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('http://localhost:5000/api/games', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setGames(response.data.games);
    } catch (err) {
      setError('Failed to fetch games');
      console.error('Error fetching games:', err);
    } finally {
      setLoading(false);
    }
  };

  const createGame = async (mode) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        'http://localhost:5000/api/games',
        { gameMode: mode },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.success) {
        navigate(`/game/${response.data.game.id}`);
      }
    } catch (err) {
      setError('Failed to create game');
      console.error('Error creating game:', err);
    }
  };

  const joinGame = async (gameId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `http://localhost:5000/api/games/${gameId}/join`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.success) {
        navigate(`/game/${gameId}`);
      }
    } catch (err) {
      setError('Failed to join game');
      console.error('Error joining game:', err);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="lobby-container">
        <div className="loading">Loading available games...</div>
      </div>
    );
  }

  return (
    <div className="lobby-container">
      <div className="lobby-header">
        <h1>Chess Game Lobby</h1>
        <button className="logout-button" onClick={handleLogout}>
          Logout
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="game-modes">
        <h2>Start a New Game</h2>
        <div className="mode-buttons">
          <button
            className={`mode-button ${selectedMode === 'local' ? 'selected' : ''}`}
            onClick={() => setSelectedMode('local')}
          >
            Local Game
          </button>
          <button
            className={`mode-button ${selectedMode === 'online' ? 'selected' : ''}`}
            onClick={() => setSelectedMode('online')}
          >
            Online Game
          </button>
          <button
            className={`mode-button ${selectedMode === 'computer' ? 'selected' : ''}`}
            onClick={() => setSelectedMode('computer')}
          >
            Play vs Computer
          </button>
        </div>

        {selectedMode && (
          <button
            className="create-game-button"
            onClick={() => createGame(selectedMode)}
          >
            Create {selectedMode === 'local' ? 'Local' : 
                   selectedMode === 'computer' ? 'Computer' : 'Online'} Game
          </button>
        )}
      </div>

      <div className="available-games">
        <h2>Available Games</h2>
        {games.length === 0 ? (
          <p className="no-games">No games available</p>
        ) : (
          <div className="games-list">
            {games.map(game => (
              <div key={game.id} className="game-item">
                <div className="game-info">
                  <span className="game-mode">
                    {game.gameMode === 'local' ? 'Local' :
                     game.gameMode === 'computer' ? 'Computer' : 'Online'} Game
                  </span>
                  <span className="game-time">
                    Created: {new Date(game.createdAt).toLocaleString()}
                  </span>
                </div>
                <button
                  className="join-button"
                  onClick={() => joinGame(game.id)}
                >
                  Join Game
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default GameLobby;
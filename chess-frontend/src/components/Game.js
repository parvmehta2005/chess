// Game.js (highlighting logic updated)

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import io from 'socket.io-client';
import ChessPiece from './ChessPiece';
import Navbar from './Navbar';
import './Game.css';

const Game = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [game, setGame] = useState(null);
  const [selectedPiece, setSelectedPiece] = useState(null);
  const [possibleMoves, setPossibleMoves] = useState([]);
  const [error, setError] = useState('');
  const [socket, setSocket] = useState(null);
  const [lastMove, setLastMove] = useState(null);
  const [playerColor, setPlayerColor] = useState(null);
  const [userId, setUserId] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user'));
    if (!token || !user) {
      navigate('/login');
      return;
    }
    setUserId(user.id);
    setUser(user);

    const newSocket = io('http://localhost:5000', {
      auth: { token },
      transports: ['websocket'],
      query: { userId: user.id, gameId: id }
    });

    newSocket.on('connect', () => {
      newSocket.emit('join-game', { gameId: id, playerId: user.id });
    });
    newSocket.on('connect_error', () => setError('Failed to connect to game server'));
    newSocket.on('game-state', ({ game: gameState }) => setGame(gameState));
    newSocket.on('game-updated', ({ game: updatedGame, lastMoveInfo }) => {
      setGame(updatedGame);
      if (lastMoveInfo) {
        setLastMove({ from: lastMoveInfo.from, to: lastMoveInfo.to, captured: lastMoveInfo.captured });
      }
    });
    newSocket.on('error', ({ message }) => setError(message));
    setSocket(newSocket);
    fetchGame();

    return () => newSocket.disconnect();
  }, [id, navigate]);

  const fetchGame = async () => {
    try {
      const token = localStorage.getItem('token');
      const user = JSON.parse(localStorage.getItem('user'));
      const res = await axios.get(`http://localhost:5000/api/games/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setGame(res.data.game);
      if (res.data.game.players.white === user.id) setPlayerColor('white');
      else if (res.data.game.players.black === user.id) setPlayerColor('black');
    } catch {
      setError('Failed to fetch game');
    }
  };

  const handleSquareClick = async (row, col) => {
    if (!game || game.status !== 'active') return;
    const piece = game.board[row][col];
    const isWhitePiece = piece && piece.toUpperCase && piece.toUpperCase() === piece;
    const isWhiteTurn = !game.turn;
    const isLocalMode = game.gameMode === 'local';
    const canMove = isLocalMode || (isWhitePiece === isWhiteTurn && ((isWhitePiece && playerColor === 'white') || (!isWhitePiece && playerColor === 'black')));

    if (!isLocalMode && isWhiteTurn !== (playerColor === 'white')) {
      setSelectedPiece(null);
      setPossibleMoves([]);
      setError(`It's ${isWhiteTurn ? 'White' : 'Black'}'s turn`);
      setTimeout(() => setError(''), 2000);
      return;
    }

    if (selectedPiece) {
      const [fromRow, fromCol] = [selectedPiece.row, selectedPiece.col];
      try {
        const token = localStorage.getItem('token');
        const user = JSON.parse(localStorage.getItem('user'));
        const res = await axios.post(`http://localhost:5000/api/games/${id}/move`, {
          from: [fromRow, fromCol], to: [row, col], playerId: user.id
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (res.data.success) {
          setSelectedPiece(null);
          setPossibleMoves([]);
          setError('');
        }
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to make move');
        setSelectedPiece(null);
        setPossibleMoves([]);
      }
    } else if (piece && canMove) {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.post(`http://localhost:5000/api/games/${id}/possible-moves`, {
          from: [row, col]
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (res.data.moves?.length > 0) {
          setSelectedPiece({ row, col });
          setPossibleMoves(res.data.moves);
          setError('');
        }
      } catch {
        setError('Failed to get possible moves');
      }
    } else {
      setSelectedPiece(null);
      setPossibleMoves([]);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  if (!game) return <div className="game-container">Loading game...</div>;

  return (
    <div className="game-container">
      <Navbar username={user?.username} onLogout={handleLogout} />
      <div className="game-content">
        <div className="chess-board-container">
          <div className="chess-board">
            {game.board.map((row, rowIndex) => (
              row.map((piece, colIndex) => {
                const isWhite = (rowIndex + colIndex) % 2 === 0;
                const isSelected = selectedPiece?.row === rowIndex && selectedPiece?.col === colIndex;
                const move = possibleMoves.find(move => move.row === rowIndex && move.col === colIndex);

                const classList = ['square', isWhite ? 'white' : 'black'];
                if (isSelected) classList.push('selected');
                if (move) classList.push(move.isCapture ? 'possible-capture' : 'possible-move');

                return (
                  <div
                    key={`${rowIndex}-${colIndex}`}
                    className={classList.join(' ')}
                    onClick={() => handleSquareClick(rowIndex, colIndex)}
                  >
                    {piece && <ChessPiece piece={piece} />}
                  </div>
                );
              })
            ))}
          </div>
        </div>
        <div className="game-info">
          <div className="info-card">
            <h3>Game Status</h3>
            <div className={`turn-indicator ${game.turn ? 'active' : ''}`}>
              <span className="piece">{game.turn ? '♟' : '♙'}</span>
              <span className="text">{game.turn ? 'Your turn' : "Opponent's turn"}</span>
            </div>
            {error && <div className="error-message">{error}</div>}
          </div>
          <div className="game-controls">
            <button className="control-button secondary" onClick={handleLogout}>Resign</button>
            <button className="control-button">Offer Draw</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Game;

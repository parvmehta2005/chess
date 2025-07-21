const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const ChessLogic = require('./chessLogic');
const authRoutes = require('./routes/auth');
const auth = require('./middleware/auth');

// Load environment variables
dotenv.config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/chess';
const chessLogic = new ChessLogic();

// Connect to MongoDB
mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Middleware
app.use(cors());
app.use(express.json());

// Root route
app.get('/', (req, res) => {
  res.json({ message: 'Chess Game API is running' });
});

// Routes
app.use('/api/auth', authRoutes);

// In-memory storage
const games = new Map();
const activePlayers = new Map(); // Track active players to prevent concurrent moves
const playerSockets = new Map(); // Track socket IDs to player IDs and game IDs
const gameConnections = new Map(); // Track active connections per game

// Initial board state
const initialBoard = [
  ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'],
  ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
  ['', '', '', '', '', '', '', ''],
  ['', '', '', '', '', '', '', ''],
  ['', '', '', '', '', '', '', ''],
  ['', '', '', '', '', '', '', ''],
  ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
  ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r']
];

const createGameState = () => ({
  id: uuidv4(),
  board: initialBoard.map(row => [...row]),
  turn: false, // false = white, true = black
  players: { white: null, black: null },
  gameMode: 'local',
  status: 'waiting',
  hasMoved: {
    whiteKing: false, blackKing: false,
    whiteRookLeft: false, whiteRookRight: false,
    blackRookLeft: false, blackRookRight: false
  },
  moveHistory: [],
  createdAt: new Date(),
  lastMove: null,
  inCheck: false,
  checkPlayer: null
});

// Utility function to validate input
const validateCoordinates = (coords) => {
  if (!Array.isArray(coords) || coords.length !== 2) return false;
  const [row, col] = coords;
  return typeof row === 'number' && typeof col === 'number' && 
         row >= 0 && row < 8 && col >= 0 && col < 8;
};

const validateMoveRequest = (req) => {
  const { from, to, playerId } = req.body;
  
  if (!from || !to || !playerId) {
    return { valid: false, error: 'Missing required fields: from, to, playerId' };
  }
  
  if (!validateCoordinates(from) || !validateCoordinates(to)) {
    return { valid: false, error: 'Invalid coordinates' };
  }
  
  if (typeof playerId !== 'string' || playerId.trim() === '') {
    return { valid: false, error: 'Invalid playerId' };
  }
  
  return { valid: true };
};

// Apply move to game state (handles special moves)
const applyMoveToGame = (game, from, to) => {
  const [fromRow, fromCol] = from;
  const [toRow, toCol] = to;
  const piece = game.board[fromRow][fromCol];
  
  // Store move info for history
  const moveInfo = {
    from, to, piece,
    timestamp: new Date(),
    player: !game.turn ? 'white' : 'black',
    captured: game.board[toRow][toCol] || null
  };
  
  // Handle en passant capture
  if (piece.toUpperCase() === 'P' && game.board[toRow][toCol] === '' && fromCol !== toCol) {
    // En passant capture
    game.board[fromRow][toCol] = ''; // Remove captured pawn
    moveInfo.enPassant = true;
  }
  
  // Apply the move using chess logic
  chessLogic.applyMoveToBoard(game.board, game.hasMoved, from, to);
  
  // Update game state
  game.turn = !game.turn;
  game.moveHistory.push(moveInfo);
  game.lastMove = { from, to, piece };
  
  // Check game status
  const gameStatus = chessLogic.checkGameStatus(game.board, game.turn, game.hasMoved);
  
  // Update check status
  game.inCheck = gameStatus === 'check';
  game.checkPlayer = game.inCheck ? (game.turn ? 'black' : 'white') : null;
  
  if (gameStatus !== 'active' && gameStatus !== 'check') {
    game.status = gameStatus;
  }
  
  return moveInfo;
};

// Handle player disconnection
const handlePlayerDisconnect = (socketId) => {
  const playerInfo = playerSockets.get(socketId);
  if (!playerInfo) return;
  
  const { playerId, gameId } = playerInfo;
  const game = games.get(gameId);
  
  if (!game) {
    playerSockets.delete(socketId);
    return;
  }
  
  // Remove connection tracking
  const connections = gameConnections.get(gameId) || new Set();
  connections.delete(socketId);
  gameConnections.set(gameId, connections);
  
  // Clean up player socket mapping
  playerSockets.delete(socketId);
  
  // Handle different game modes and states
  if (game.gameMode === 'local') {
    // For local games, remove the game immediately since it's single-player
    games.delete(gameId);
    gameConnections.delete(gameId);
    console.log(`Removed local game ${gameId} after player disconnect`);
  } else if (game.gameMode === 'online') {
    // For online games, check if any players are still connected
    const hasActiveConnections = connections.size > 0;
    
    if (!hasActiveConnections) {
      // No one is connected, remove the game
      games.delete(gameId);
      gameConnections.delete(gameId);
      console.log(`Removed online game ${gameId} - no active connections`);
    } else if (game.status === 'waiting') {
      // If game is still waiting and a player disconnects, reset it
      if (game.players.white === playerId) {
        game.players.white = null;
      } else if (game.players.black === playerId) {
        game.players.black = null;
      }
      
      // If no players left, remove the game
      if (!game.players.white && !game.players.black) {
        games.delete(gameId);
        gameConnections.delete(gameId);
        console.log(`Removed waiting game ${gameId} - no players left`);
      } else {
        // Notify remaining players
        io.to(gameId).emit('player-disconnected', { 
          disconnectedPlayer: playerId,
          game 
        });
      }
    } else if (game.status === 'active') {
      // Game is active, mark as paused or abandoned
      game.status = 'paused';
      game.disconnectedPlayer = playerId;
      game.disconnectedAt = new Date();
      
      // Notify remaining players
      io.to(gameId).emit('player-disconnected', { 
        disconnectedPlayer: playerId,
        game,
        message: `Player ${playerId === game.players.white ? 'White' : 'Black'} disconnected. Game paused.`
      });
    }
  }
  
  // Clean up any active player entries
  for (const [key, value] of activePlayers.entries()) {
    if (key.includes(playerId) || key.includes(socketId)) {
      activePlayers.delete(key);
    }
  }
  
  console.log(`Player ${playerId} disconnected from game ${gameId}`);
};

// Clean up old games (run periodically)
const cleanupOldGames = () => {
  const now = new Date();
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours
  const pausedGameMaxAge = 30 * 60 * 1000; // 30 minutes for paused games
  
  for (const [gameId, game] of games.entries()) {
    let shouldDelete = false;
    
    if (game.status === 'paused' && game.disconnectedAt) {
      // Remove paused games after 30 minutes
      shouldDelete = now - game.disconnectedAt > pausedGameMaxAge;
    } else {
      // Remove old games after 24 hours
      shouldDelete = now - game.createdAt > maxAge;
    }
    
    if (shouldDelete) {
      games.delete(gameId);
      gameConnections.delete(gameId);
      console.log(`Cleaned up old game: ${gameId} (status: ${game.status})`);
    }
  }
};

// Run cleanup every 10 minutes
setInterval(cleanupOldGames, 10 * 60 * 1000);

// Routes
app.post('/api/games', auth, (req, res) => {
  try {
    const { gameMode = 'local' } = req.body;
    const playerId = req.user._id.toString();
    
    const gameState = createGameState();
    gameState.gameMode = gameMode;
    gameState.players.white = playerId;
    
    if (gameMode === 'local' || gameMode === 'computer') {
      gameState.players.black = gameMode === 'computer' ? 'computer' : playerId;
      gameState.status = 'active';
    }
    
    games.set(gameState.id, gameState);
    res.json({ success: true, game: gameState });
  } catch (error) {
    console.error('Error creating game:', error);
    res.status(500).json({ error: 'Failed to create game' });
  }
});

app.get('/api/games/:gameId', (req, res) => {
  try {
    const game = games.get(req.params.gameId);
    if (!game) return res.status(404).json({ error: 'Game not found' });
    res.json({ game });
  } catch (error) {
    console.error('Error fetching game:', error);
    res.status(500).json({ error: 'Failed to fetch game' });
  }
});

app.post('/api/games/:gameId/join', auth, (req, res) => {
  try {
    const { gameId } = req.params;
    const playerId = req.user._id.toString();
    
    const game = games.get(gameId);
    
    if (!game) return res.status(404).json({ error: 'Game not found' });
    if (game.status !== 'waiting') return res.status(400).json({ error: 'Game not available' });
    if (game.players.white === playerId) return res.status(400).json({ error: 'Cannot join your own game' });
    
    game.players.black = playerId;
    game.status = 'active';
    games.set(gameId, game);
    
    io.to(gameId).emit('player-joined', { game, newPlayer: 'black' });
    
    res.json({ success: true, game, playerColor: 'black' });
  } catch (error) {
    console.error('Error joining game:', error);
    res.status(500).json({ error: 'Failed to join game' });
  }
});

app.post('/api/games/:gameId/move', auth, (req, res) => {
  try {
    const { gameId } = req.params;
    const validation = validateMoveRequest(req);
    
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }
    
    const { from, to } = req.body;
    const playerId = req.user._id.toString();
    const game = games.get(gameId);
    
    if (!game) return res.status(404).json({ error: 'Game not found' });
    if (game.status !== 'active') return res.status(400).json({ error: 'Game is not active' });
    
    // Check for concurrent moves
    const playerKey = `${gameId}-${playerId}`;
    if (activePlayers.has(playerKey)) {
      return res.status(429).json({ error: 'Move in progress, please wait' });
    }
    
    activePlayers.set(playerKey, true);
    
    try {
      // Validate turn
      const isWhiteTurn = !game.turn;
      const isPlayerWhite = game.players.white === playerId;
      const isPlayerBlack = game.players.black === playerId;
      
      if ((isWhiteTurn && !isPlayerWhite) || (!isWhiteTurn && !isPlayerBlack)) {
        return res.status(400).json({ error: 'Not your turn' });
      }
      
      // Validate move using chess logic
      if (!chessLogic.validateMove(game, from, to)) {
        return res.status(400).json({ error: 'Invalid move' });
      }
      
      // Apply move
      const moveInfo = applyMoveToGame(game, from, to);
      games.set(gameId, game);
      
      // Emit to all players in the room
      io.to(gameId).emit('game-updated', { 
        game, 
        lastMoveInfo: moveInfo,
        message: game.inCheck ? `${game.checkPlayer} is in check!` : null
      });
      
      res.json({ 
        success: true, 
        game, 
        moveInfo,
        message: game.inCheck ? `${game.checkPlayer} is in check!` : null
      });
      
    } finally {
      activePlayers.delete(playerKey);
    }
    
  } catch (error) {
    console.error('Error making move:', error);
    res.status(500).json({ error: 'Failed to make move' });
  }
});

app.post('/api/games/:gameId/possible-moves', auth, (req, res) => {
  try {
    const { gameId } = req.params;
    const { from } = req.body;
    const game = games.get(gameId);
    
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    if (!validateCoordinates(from)) {
      return res.status(400).json({ error: 'Invalid coordinates' });
    }
    
    const [fromRow, fromCol] = from;
    const piece = game.board[fromRow][fromCol];
    
    if (!piece) {
      return res.status(400).json({ error: 'No piece at specified position' });
    }
    
    const moves = chessLogic.getValidMoves(
      game.board,
      piece,
      fromRow,
      fromCol,
      game.hasMoved,
      game.lastMove
    );
    
    res.json({ moves });
  } catch (error) {
    console.error('Error getting possible moves:', error);
    res.status(500).json({ error: 'Failed to get possible moves' });
  }
});

app.get('/api/games', (req, res) => {
  try {
    const availableGames = Array.from(games.values())
      .filter(game => game.status === 'waiting')
      .map(game => ({
        id: game.id,
        gameMode: game.gameMode,
        createdAt: game.createdAt,
        playersCount: Object.values(game.players).filter(p => p && p !== 'computer').length
      }));
    
    res.json({ games: availableGames });
  } catch (error) {
    console.error('Error fetching games:', error);
    res.status(500).json({ error: 'Failed to fetch games' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Chess server is running',
    activeGames: games.size,
    uptime: process.uptime()
  });
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Extract user info from socket handshake
  const userId = socket.handshake.query.userId;
  const gameId = socket.handshake.query.gameId;

  if (!userId) {
    console.error('No userId provided in socket connection');
    socket.disconnect();
    return;
  }

  socket.on('join-game', (data) => {
    try {
      const { gameId: joinGameId, playerId } = data;
      
      if (typeof joinGameId !== 'string' || !games.has(joinGameId)) {
        socket.emit('error', { message: 'Invalid game ID' });
        return;
      }
      
      if (!playerId || playerId !== userId) {
        socket.emit('error', { message: 'Invalid player ID' });
        return;
      }
      
      const game = games.get(joinGameId);
      
      // Verify player is part of the game
      if (game.players.white !== playerId && game.players.black !== playerId) {
        socket.emit('error', { message: 'You are not a player in this game' });
        return;
      }
      
      socket.join(joinGameId);
      
      // Track this connection
      playerSockets.set(socket.id, { playerId, gameId: joinGameId });
      
      const connections = gameConnections.get(joinGameId) || new Set();
      connections.add(socket.id);
      gameConnections.set(joinGameId, connections);
      
      console.log(`User ${socket.id} (${playerId}) joined game ${joinGameId}`);
      
      // Send current game state
      socket.emit('game-state', { game });
      
      // If this is a paused game and the disconnected player reconnected
      if (game.status === 'paused' && game.disconnectedPlayer === playerId) {
        game.status = 'active';
        delete game.disconnectedPlayer;
        delete game.disconnectedAt;
        
        io.to(joinGameId).emit('player-reconnected', { 
          reconnectedPlayer: playerId,
          game,
          message: `Player ${playerId === game.players.white ? 'White' : 'Black'} reconnected. Game resumed.`
        });
      }
      
    } catch (error) {
      console.error('Error in join-game:', error);
      socket.emit('error', { message: 'Failed to join game' });
    }
  });

  socket.on('make-move', (data) => {
    try {
      const { gameId, from, to, playerId } = data;
      
      // Validate input data
      if (!gameId || !from || !to || !playerId) {
        socket.emit('error', { message: 'Missing required move data' });
        return;
      }
      
      if (!validateCoordinates(from) || !validateCoordinates(to)) {
        socket.emit('error', { message: 'Invalid coordinates' });
        return;
      }
      
      const game = games.get(gameId);
      
      if (!game) {
        socket.emit('error', { message: 'Game not found' });
        return;
      }
      
      if (game.status !== 'active') {
        socket.emit('error', { message: 'Game is not active' });
        return;
      }
      
      // Check for concurrent moves
      const playerKey = `${gameId}-${playerId}`;
      if (activePlayers.has(playerKey)) {
        socket.emit('error', { message: 'Move in progress, please wait' });
        return;
      }
      
      activePlayers.set(playerKey, true);
      
      try {
        // Use existing move validation logic
        const isWhiteTurn = !game.turn;
        const isPlayerWhite = game.players.white === playerId;
        const isPlayerBlack = game.players.black === playerId;
        
        if ((isWhiteTurn && !isPlayerWhite) || (!isWhiteTurn && !isPlayerBlack)) {
          socket.emit('error', { message: 'Not your turn' });
          return;
        }
        
        if (!chessLogic.validateMove(game, from, to)) {
          socket.emit('error', { message: 'Invalid move' });
          return;
        }

        // Apply move
        const moveInfo = applyMoveToGame(game, from, to);
        games.set(gameId, game);
        
        // Emit to all players in the room
        io.to(gameId).emit('game-updated', { 
          game, 
          lastMoveInfo: moveInfo,
          message: game.inCheck ? `${game.checkPlayer} is in check!` : null
        });
        
        // Handle game end notifications
        if (game.status === 'checkmate') {
          const winner = game.turn ? 'White' : 'Black';
          io.to(gameId).emit('game-ended', { 
            type: 'checkmate', 
            winner,
            message: `Checkmate! ${winner} wins!`
          });
        } else if (game.status === 'stalemate') {
          io.to(gameId).emit('game-ended', { 
            type: 'stalemate',
            message: 'Stalemate! The game is a draw.'
          });
        }
        
      } finally {
        activePlayers.delete(playerKey);
      }
      
    } catch (error) {
      console.error('Socket move error:', error);
      socket.emit('error', { message: 'Failed to process move' });
    }
  });

  socket.on('request-game-state', (gameId) => {
    if (typeof gameId !== 'string' || !games.has(gameId)) {
      socket.emit('error', { message: 'Invalid game ID' });
      return;
    }
    
    const game = games.get(gameId);
    socket.emit('game-state', { game });
  });

  socket.on('leave-game', (gameId) => {
    if (typeof gameId === 'string') {
      socket.leave(gameId);
      console.log(`User ${socket.id} left game ${gameId}`);
      
      // Handle the leave as a disconnect
      handlePlayerDisconnect(socket.id);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    handlePlayerDisconnect(socket.id);
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Express error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Handle process termination gracefully
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Chess server running on http://localhost:${PORT}`);
  console.log(`📊 API endpoints available at http://localhost:${PORT}/api`);
  console.log(`🎮 WebSocket server ready for real-time gameplay`);
});

module.exports = app;
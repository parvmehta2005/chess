import React, { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

class Stockfish {
  constructor() {
    this.worker = new Worker('/stockfish.js');
    this.onMessage = null;
    this.worker.onmessage = (e) => {
      if (this.onMessage) {
        this.onMessage(e.data);
      }
    };
  }

  sendCommand(command) {
    this.worker.postMessage(command);
  }

  setOnMessage(callback) {
    this.onMessage = callback;
  }

  setSkillLevel(level) {
    this.sendCommand(`setoption name Skill Level value ${level}`);
  }

  setPosition(fen) {
    this.sendCommand(`position fen ${fen}`);
  }

  go(depth = 20) {
    this.sendCommand(`go depth ${depth}`);
  }

  stop() {
    this.sendCommand('stop');
  }

  quit() {
    this.sendCommand('quit');
  }
}

const ComputerPlayer = ({ gameId, onMove }) => {
  const stockfishRef = useRef(null);
  const socketRef = useRef(null);

  useEffect(() => {
    // Initialize Stockfish
    stockfishRef.current = new Stockfish();
    stockfishRef.current.setOnMessage((message) => {
      if (message.startsWith('bestmove')) {
        const move = message.split(' ')[1];
        if (move && move !== '(none)') {
          // Convert Stockfish move format (e.g., 'e2e4') to our format
          const from = [
            8 - parseInt(move[1]),
            move.charCodeAt(0) - 'a'.charCodeAt(0)
          ];
          const to = [
            8 - parseInt(move[3]),
            move.charCodeAt(2) - 'a'.charCodeAt(0)
          ];
          
          // Make the move through the socket
          if (socketRef.current) {
            socketRef.current.emit('make-move', {
              gameId,
              from,
              to,
              playerId: 'computer'
            });
          }
        }
      }
    });

    // Set skill level (1-20)
    stockfishRef.current.setSkillLevel(10);

    // Initialize socket connection
    socketRef.current = io('http://localhost:5000');
    socketRef.current.emit('join-game', { gameId, playerId: 'computer' });

    // Listen for game updates
    socketRef.current.on('game-updated', (data) => {
      if (data.game && data.game.turn) { // If it's computer's turn
        // Convert board to FEN
        const fen = convertBoardToFEN(data.game.board);
        stockfishRef.current.setPosition(fen);
        stockfishRef.current.go();
      }
    });

    return () => {
      if (stockfishRef.current) {
        stockfishRef.current.quit();
      }
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [gameId]);

  // Helper function to convert board to FEN
  const convertBoardToFEN = (board) => {
    let fen = '';
    let emptyCount = 0;

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        if (piece === '') {
          emptyCount++;
        } else {
          if (emptyCount > 0) {
            fen += emptyCount;
            emptyCount = 0;
          }
          fen += piece;
        }
      }
      if (emptyCount > 0) {
        fen += emptyCount;
        emptyCount = 0;
      }
      if (row < 7) fen += '/';
    }

    // Add other FEN components (turn, castling rights, etc.)
    fen += ' b KQkq - 0 1'; // Simplified FEN for now

    return fen;
  };

  return null; // This component doesn't render anything
};

export default ComputerPlayer; 
import React from 'react';
import './ChessPiece.css';

const pieceImages = {
  'K': '/chess_pieces/white-king.png',
  'Q': '/chess_pieces/white-queen.png',
  'R': '/chess_pieces/white-rook.png',
  'B': '/chess_pieces/white-bishop.png',
  'N': '/chess_pieces/white-knight.png',
  'P': '/chess_pieces/white-pawn.png',
  'k': '/chess_pieces/black-king.png',
  'q': '/chess_pieces/black-queen.png',
  'r': '/chess_pieces/black-rook.png',
  'b': '/chess_pieces/black-bishop.png',
  'n': '/chess_pieces/black-knight.png',
  'p': '/chess_pieces/black-pawn.png'
};


const ChessPiece = ({ piece }) => {
  if (!piece) return null;
  
  return (
    <img 
      src={pieceImages[piece]} 
      alt={piece} 
      className={`chess-piece ${piece === piece.toUpperCase() ? 'white' : 'black'}`}
    />
  );
};

export default ChessPiece; 
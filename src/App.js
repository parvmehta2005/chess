import React, { useState } from 'react';
import './App.css';

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

const pieceImages = {
  'R': '/chess_pieces/white_rook.svg',
  'N': '/chess_pieces/white_knight.svg',
  'B': '/chess_pieces/white_bishop.svg',
  'Q': '/chess_pieces/white_queen.svg',
  'K': '/chess_pieces/white_king.svg',
  'P': '/chess_pieces/white_pawn.svg',
  'r': '/chess_pieces/black_rook.svg',
  'n': '/chess_pieces/black_knight.svg',
  'b': '/chess_pieces/black_bishop.svg',
  'q': '/chess_pieces/black_queen.svg',
  'k': '/chess_pieces/black_king.svg',
  'p': '/chess_pieces/black_pawn.svg'
};

const Chessboard = () => {
  const [board, setBoard] = useState(initialBoard);
  const [selected, setSelected] = useState(null);
  const [validMoves, setValidMoves] = useState([]);
  const [turn,setTurn] = useState(false);
  const [hasMoved, setHasMoved] = useState({
    whiteKing: false,
    blackKing: false,
    whiteRookLeft: false,
    whiteRookRight: false,
    blackRookLeft: false,
    blackRookRight: false
  });
  

  const handleClick = (rowIndex, colIndex) => {
    if (selected) {
      const [fromRow, fromCol] = selected;
      
      if(isSameSide(board,fromRow,fromCol,rowIndex,colIndex)){
        setSelected([rowIndex, colIndex]);
        setValidMoves(getValidMoves(board, board[rowIndex][colIndex], rowIndex, colIndex));
        return;
      }
      if (isValidMove([rowIndex, colIndex])) {
        const [fromRow, fromCol] = selected;
        const [toRow, toCol] = [rowIndex, colIndex];
        const piece = board[fromRow][fromCol];

        const newBoard = board.map((row) => [...row]);
        newBoard[toRow][toCol] = newBoard[fromRow][fromCol];
        newBoard[fromRow][fromCol] = '';
        const val = checkForCheckOrMate(newBoard);

        if(!(val==="black" && turn) && !(val==="white" && !turn)){
          if (piece === 'K') {
            setHasMoved({ ...hasMoved, whiteKing: true });
          } else if (piece === 'k') {
            setHasMoved({ ...hasMoved, blackKing: true });
          } else if (piece === 'r' && fromCol === 0 && fromRow === 7) {
            setHasMoved({ ...hasMoved, blackRookLeft: true });
          } else if (piece === 'r' && fromCol === 7 && fromRow === 7) {
            setHasMoved({ ...hasMoved, blackRookRight: true });
          } else if (piece === 'R' && fromCol === 0 && fromRow === 0) {
            setHasMoved({ ...hasMoved, whiteRookLeft: true });
          } else if (piece === 'R' && fromCol === 7 && fromRow === 0) {
            setHasMoved({ ...hasMoved, whiteRookRight: true });
          }
          
          if (piece === 'K' && fromRow === 0 && fromCol === 4) {
            if (toRow === 0 && toCol === 2) {
              // Queen-side castling for white
              newBoard[0][0] = ''; // Move the rook
              newBoard[0][3] = 'R';
            } else if (toRow === 0 && toCol === 6) {
              // King-side castling for white
              newBoard[0][7] = ''; // Move the rook
              newBoard[0][5] = 'R';
            }
          } else if (piece === 'k' && fromRow === 7 && fromCol === 4) {
            if (toRow === 7 && toCol === 2) {
              // Queen-side castling for black
              newBoard[7][0] = ''; // Move the rook
              newBoard[7][3] = 'r';
            } else if (toRow === 7 && toCol === 6) {
              // King-side castling for black
              newBoard[7][7] = ''; // Move the rook
              newBoard[7][5] = 'r';
            }
          }
          
          setTurn((prevTurn) => !prevTurn);
          setBoard(newBoard);
        }
      }
      setSelected(null);
      setValidMoves([]);
    }
    else{
      const piece = board[rowIndex][colIndex];
      if (piece && ((piece===piece.toLowerCase()) === turn)) {
        setSelected([rowIndex, colIndex]);
        setValidMoves(getValidMoves(board, piece, rowIndex, colIndex));
      }
    }
  };

  const isValidMove = (position) => {
    return validMoves.some(([row, col]) => row === position[0] && col === position[1]);
  };

  const getValidMoves = (board, piece, row, col) => {
    switch (piece.toUpperCase()) {
      case 'P':
        return getPawnMoves(board, piece, row, col);
      case 'R':
        return getRookMoves(board, row, col);
      case 'N':
        return getKnightMoves(board, row, col);
      case 'B':
        return getBishopMoves(board, row, col);
      case 'Q':
        return [...getRookMoves(board, row, col), ...getBishopMoves(board, row, col)];
      case 'K':
        return getKingMoves(board, row, col);
      default:
        return [];
    }
  };

  const getSquareClassName = (rowIndex, colIndex) => {
    const isValid = isValidMove([rowIndex, colIndex]);
    const pieceAtPosition = board[rowIndex][colIndex];
    
    if (selected){
      const isOpponentPiece = pieceAtPosition && isSameSide(board, selected[0], selected[1], rowIndex, colIndex) === false;

      if (isValid && isOpponentPiece) return 'square red';
      if (isValid) return 'square yellow';
    }

    return `square ${(rowIndex + colIndex) % 2 === 0 ? 'white' : 'black'}`;
  };

  const checkForCheckOrMate = (board) => {
    const whiteKingPosition = findKingPosition(board, 'K');
    const blackKingPosition = findKingPosition(board, 'k');

    const whiteInCheck = isKingInCheck(board, whiteKingPosition, 'K');
    const blackInCheck = isKingInCheck(board, blackKingPosition, 'k');

    if (whiteInCheck) {
      return "white";
    } else if (blackInCheck) {
      return "black";
    } else {
      return "";
    }
  };
    
  const findKingPosition = (board, king) => {
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        if (board[row][col] === king) {
          return [row, col];
        }
      }
    }
  };

  const isKingInCheck = (board, kingPosition, king) => {
    const [kingRow, kingCol] = kingPosition;
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        
        if((piece===piece.toLowerCase()) !== (king===king.toLowerCase())){
          if (piece && piece !== "K" && piece !== "k" && canMoveTo(board, piece, [row, col], [kingRow, kingCol])) {
            console.log(piece);
            return true;
          }
        }
      }
    }
    return false;
  };

  const isKingAdjacent = (board, row, col, opponentKing) => {
    const adjacentOffsets = [
      [1, 0], [1, 1], [1, -1], [0, 1],
      [0, -1], [-1, 0], [-1, 1], [-1, -1]
    ];
    const [opponentKingRow, opponentKingCol] = findKingPosition(board, opponentKing);
    
    return adjacentOffsets.some(([rOffset, cOffset]) => {
      const adjRow = row + rOffset;
      const adjCol = col + cOffset;
      return adjRow === opponentKingRow && adjCol === opponentKingCol;
    });
  };
  
  const getKingMoves = (board, row, col) => {
    const kingOffsets = [
      [1, 0], [1, 1], [1, -1], [0, 1],
      [0, -1], [-1, 0], [-1, 1], [-1, -1]
    ];
    const moves = [];
    const piece = board[row][col];
    const opponentKing = piece === 'K' ? 'k' : 'K'; // Get the opponent's king
    
    kingOffsets.forEach(([rOffset, cOffset]) => {
      const newRow = row + rOffset;
      const newCol = col + cOffset;
      
      if (
        isOnBoard(newRow, newCol) &&
        !isSameSide(board, row, col, newRow, newCol) &&
        !isKingAdjacent(board, newRow, newCol, opponentKing) // Prevent moving adjacent to the opposing king
      ) {
        moves.push([newRow, newCol]);
      }
    });  

    if (board[row][col] === 'K' && !hasMoved.whiteKing) {
      if (!hasMoved.whiteRookLeft && board[0][0] === 'R' && board[0][1] === '' && board[0][2] === '' && board[0][3] === '') {
        console.log("vj");
        if (!isKingInCheck(board, [0, 4], 'K') && !isKingInCheck(board, [0, 3], 'K') && !isKingInCheck(board, [0, 2], 'K')) {
          moves.push([0, 2]);
        }
      }
      if (!hasMoved.whiteRookRight && board[0][7] === 'R' && board[0][5] === '' && board[0][6] === '') {
        if (!isKingInCheck(board, [0, 4], 'K') && !isKingInCheck(board, [0, 5], 'K') && !isKingInCheck(board, [0, 6], 'K')) {
          moves.push([0, 6]); // King-side castling
        }
      }
    } else if (board[row][col] === 'k' && !hasMoved.blackKing) {
      // Check black castling conditions
      if (!hasMoved.blackRookLeft && board[7][0] === 'r' && board[7][1] === '' && board[7][2] === '' && board[7][3] === '') {
        if (!isKingInCheck(board, [7, 4], 'k') && !isKingInCheck(board, [7, 3], 'k') && !isKingInCheck(board, [7, 2], 'k')) {
          moves.push([7, 2]); // Queen-side castling
        }
      }
      if (!hasMoved.blackRookRight && board[7][7] === 'r' && board[7][5] === '' && board[7][6] === '') {
        console.log("ki");
        if (!isKingInCheck(board, [7, 4], 'k') && !isKingInCheck(board, [7, 5], 'k') && !isKingInCheck(board, [7, 6], 'k')) {
          moves.push([7, 6]); // King-side castling
        }
      }
    }
    return moves;
  };

  const canMoveTo = (board, piece, from, to) => {
    const validMoves = getValidMoves(board, piece, from[0], from[1]);
    return validMoves.some(([row, col]) => row === to[0] && col === to[1]);
  };

  return (
    <div className="chessboard">
      {board.map((row, rowIndex) => (
        <div key={rowIndex} className="row">
          {row.map((piece, colIndex) => (
            <div
              key={colIndex}
              className={getSquareClassName(rowIndex, colIndex)}
              onClick={() => handleClick(rowIndex, colIndex)}
            >
              {piece && <img src={pieceImages[piece]} alt={piece} className="piece" />}
            </div>
          ))}
        </div>
      ))}
      <h1>{turn ? 'Black turn' : 'White Turn'}</h1>
      <h1>{checkForCheckOrMate(board) ? "Check!" : ""}</h1>
    </div>
  );
};

const getPawnMoves = (board, piece, row, col) => {
  const moves = [];
  const direction = piece === 'p' ? -1 : 1;
  const startRow = piece === 'p' ? 6 : 1;

  if (board[row + direction][col] === '') {
    moves.push([row + direction, col]);
    if (row === startRow && board[row + 2 * direction][col] === '') {
      moves.push([row + 2 * direction, col]);
    }
  }

  if (col > 0 && isOpponentPiece(board, piece, row + direction, col - 1)) {
    moves.push([row + direction, col - 1]);
  }
  if (col < 7 && isOpponentPiece(board, piece, row + direction, col + 1)) {
    moves.push([row + direction, col + 1]);
  }

  return moves;
};

const getRookMoves = (board, row, col) => {
  return getLinearMoves(board, row, col, [[1, 0], [-1, 0], [0, 1], [0, -1]]);
};

const getBishopMoves = (board, row, col) => {
  return getLinearMoves(board, row, col, [[1, 1], [-1, -1], [1, -1], [-1, 1]]);
};

const getKnightMoves = (board, row, col) => {
  const knightOffsets = [
    [2, 1], [2, -1], [-2, 1], [-2, -1],
    [1, 2], [1, -2], [-1, 2], [-1, -2]
  ];
  const moves = [];
  knightOffsets.forEach(([rOffset, cOffset]) => {
    const newRow = row + rOffset;
    const newCol = col + cOffset;
    if (isOnBoard(newRow, newCol) && !isSameSide(board, row, col, newRow, newCol)) {
      moves.push([newRow, newCol]);
    }
  });
  return moves;
};

const getLinearMoves = (board, row, col, directions) => {
  const moves = [];
  directions.forEach(([rOffset, cOffset]) => {
    let newRow = row + rOffset;
    let newCol = col + cOffset;
    while (isOnBoard(newRow, newCol) && !board[newRow][newCol]) {
      moves.push([newRow, newCol]);
      newRow += rOffset;
      newCol += cOffset;
    }
    if (isOnBoard(newRow, newCol) && isOpponentPiece(board, board[row][col], newRow, newCol)) {
      moves.push([newRow, newCol]);
    }
  });
  return moves;
};

const isOnBoard = (row, col) => row >= 0 && row < 8 && col >= 0 && col < 8;

const isSameSide = (board, row1, col1, row2, col2) => {
  const piece1 = board[row1][col1];
  const piece2 = board[row2][col2];
  if (!piece1 || !piece2) return false;
  return (piece1 === piece1.toUpperCase() && piece2 === piece2.toUpperCase()) ||
         (piece1 === piece1.toLowerCase() && piece2 === piece2.toLowerCase());
};

const isOpponentPiece = (board, piece, row, col) => {
  const target = board[row][col];
  if (!target) return false;
  return (piece === piece.toUpperCase() && target === target.toLowerCase()) ||
         (piece === piece.toLowerCase() && target === target.toUpperCase());
};

function App() {
  return (
    <div className="App">
      <h1>Chess Game</h1>
      <Chessboard />
    </div>
  );
}

export default App;
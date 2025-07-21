class ChessLogic {
  constructor() {
    this.initialBoard = [
      ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'],
      ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
      ['', '', '', '', '', '', '', ''],
      ['', '', '', '', '', '', '', ''],
      ['', '', '', '', '', '', '', ''],
      ['', '', '', '', '', '', '', ''],
      ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
      ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r']
    ];
  }

  // Validate if a move is legal (including check validation)
  validateMove(gameState, from, to) {
    try {
      const [fromRow, fromCol] = from;
      const [toRow, toCol] = to;
      
      // Validate coordinates
      if (!this.isOnBoard(fromRow, fromCol) || !this.isOnBoard(toRow, toCol)) {
        return false;
      }
      
      const piece = gameState.board[fromRow][fromCol];
      
      if (!piece) return false;
      
      // Check if it's the correct player's turn
      const isWhitePiece = piece === piece.toUpperCase();
      const isWhiteTurn = !gameState.turn;
      
      if (isWhitePiece !== isWhiteTurn) return false;
      
      // Check if move is valid for the piece type
      const validMoves = this.getValidMoves(gameState.board, piece, fromRow, fromCol, gameState.hasMoved, gameState.lastMove);
      const isMoveValid = validMoves.some(([row, col]) => row === toRow && col === toCol);
      
      if (!isMoveValid) return false;
      
      // Create a copy of the board to test if move leaves king in check
      const testBoard = this.copyBoard(gameState.board);
      const testHasMoved = { ...gameState.hasMoved };
      
      // Apply the move to test board
      this.applyMoveToBoard(testBoard, testHasMoved, from, to);
      
      // Check if this move leaves the player's king in check
      const currentPlayerKing = isWhiteTurn ? 'K' : 'k';
      const kingPosition = this.findKingPosition(testBoard, currentPlayerKing);
      
      if (!kingPosition || this.isKingInCheck(testBoard, kingPosition, currentPlayerKing)) {
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error validating move:', error);
      return false;
    }
  }

  // Apply move to board (handles special moves)
  applyMoveToBoard(board, hasMoved, from, to) {
    const [fromRow, fromCol] = from;
    const [toRow, toCol] = to;
    const piece = board[fromRow][fromCol];
    
    // Handle castling
    if (piece.toUpperCase() === 'K' && Math.abs(toCol - fromCol) === 2) {
      // King is castling
      board[toRow][toCol] = piece;
      board[fromRow][fromCol] = '';
      
      // Move the rook
      if (toCol === 6) { // King-side castling
        const rook = board[fromRow][7];
        board[fromRow][5] = rook;
        board[fromRow][7] = '';
      } else if (toCol === 2) { // Queen-side castling
        const rook = board[fromRow][0];
        board[fromRow][3] = rook;
        board[fromRow][0] = '';
      }
    } else {
      // Normal move
      board[toRow][toCol] = piece;
      board[fromRow][fromCol] = '';
    }
    
    // Handle pawn promotion
    if (piece.toUpperCase() === 'P') {
      if ((piece === 'P' && toRow === 0) || (piece === 'p' && toRow === 7)) {
        // Auto-promote to queen (can be expanded to allow choice)
        board[toRow][toCol] = piece === 'P' ? 'Q' : 'q';
      }
    }
    
    // Update hasMoved flags
    if (piece === 'K') hasMoved.whiteKing = true;
    if (piece === 'k') hasMoved.blackKing = true;
    if (piece === 'R' && fromRow === 0 && fromCol === 0) hasMoved.whiteRookLeft = true;
    if (piece === 'R' && fromRow === 0 && fromCol === 7) hasMoved.whiteRookRight = true;
    if (piece === 'r' && fromRow === 7 && fromCol === 0) hasMoved.blackRookLeft = true;
    if (piece === 'r' && fromRow === 7 && fromCol === 7) hasMoved.blackRookRight = true;
  }

  // Get all valid moves for a piece
  getValidMoves(board, piece, row, col, hasMoved = {}, lastMove = null) {
    switch (piece.toUpperCase()) {
      case 'P':
        return this.getPawnMoves(board, piece, row, col, lastMove);
      case 'R':
        return this.getRookMoves(board, row, col);
      case 'N':
        return this.getKnightMoves(board, row, col);
      case 'B':
        return this.getBishopMoves(board, row, col);
      case 'Q':
        return [...this.getRookMoves(board, row, col), ...this.getBishopMoves(board, row, col)];
      case 'K':
        return this.getKingMoves(board, row, col, hasMoved);
      default:
        return [];
    }
  }

  getPawnMoves(board, piece, row, col, lastMove = null) {
    const moves = [];
    const direction = piece === 'p' ? -1 : 1;
    const startRow = piece === 'p' ? 6 : 1;

    // Forward move
    if (row + direction >= 0 && row + direction < 8 && board[row + direction][col] === '') {
      moves.push([row + direction, col]);
      
      // Double move from starting position
      if (row === startRow && board[row + 2 * direction][col] === '') {
        moves.push([row + 2 * direction, col]);
      }
    }

    // Diagonal captures
    if (col > 0 && this.isOpponentPiece(board, piece, row + direction, col - 1)) {
      moves.push([row + direction, col - 1]);
    }
    if (col < 7 && this.isOpponentPiece(board, piece, row + direction, col + 1)) {
      moves.push([row + direction, col + 1]);
    }

    // En passant
    if (lastMove && lastMove.piece && lastMove.piece.toUpperCase() === 'P') {
      const [lastFromRow, lastFromCol] = lastMove.from;
      const [lastToRow, lastToCol] = lastMove.to;
      
      // Check if last move was a double pawn move
      if (Math.abs(lastToRow - lastFromRow) === 2 && lastToRow === row && Math.abs(lastToCol - col) === 1) {
        moves.push([row + direction, lastToCol]);
      }
    }

    return moves;
  }

  getRookMoves(board, row, col) {
    return this.getLinearMoves(board, row, col, [[1, 0], [-1, 0], [0, 1], [0, -1]]);
  }

  getBishopMoves(board, row, col) {
    return this.getLinearMoves(board, row, col, [[1, 1], [-1, -1], [1, -1], [-1, 1]]);
  }

  getKnightMoves(board, row, col) {
    const knightOffsets = [
      [2, 1], [2, -1], [-2, 1], [-2, -1],
      [1, 2], [1, -2], [-1, 2], [-1, -2]
    ];
    const moves = [];
    
    knightOffsets.forEach(([rOffset, cOffset]) => {
      const newRow = row + rOffset;
      const newCol = col + cOffset;
      if (this.isOnBoard(newRow, newCol) && !this.isSameSide(board, row, col, newRow, newCol)) {
        moves.push([newRow, newCol]);
      }
    });
    
    return moves;
  }

  getKingMoves(board, row, col, hasMoved = {}) {
    const kingOffsets = [
      [1, 0], [1, 1], [1, -1], [0, 1],
      [0, -1], [-1, 0], [-1, 1], [-1, -1]
    ];
    const moves = [];
    const piece = board[row][col];
    
    kingOffsets.forEach(([rOffset, cOffset]) => {
      const newRow = row + rOffset;
      const newCol = col + cOffset;
      
      if (this.isOnBoard(newRow, newCol) && !this.isSameSide(board, row, col, newRow, newCol)) {
        moves.push([newRow, newCol]);
      }
    });

    // Castling logic
    if (piece === 'K' && !hasMoved.whiteKing && row === 7) {
      // King-side castling
      if (!hasMoved.whiteRookRight && 
          board[7][5] === '' && board[7][6] === '' &&
          !this.isSquareUnderAttack(board, [7, 4], 'K') &&
          !this.isSquareUnderAttack(board, [7, 5], 'K') &&
          !this.isSquareUnderAttack(board, [7, 6], 'K')) {
        moves.push([7, 6]);
      }
      
      // Queen-side castling
      if (!hasMoved.whiteRookLeft && 
          board[7][1] === '' && board[7][2] === '' && board[7][3] === '' &&
          !this.isSquareUnderAttack(board, [7, 4], 'K') &&
          !this.isSquareUnderAttack(board, [7, 3], 'K') &&
          !this.isSquareUnderAttack(board, [7, 2], 'K')) {
        moves.push([7, 2]);
      }
    } else if (piece === 'k' && !hasMoved.blackKing && row === 0) {
      // King-side castling
      if (!hasMoved.blackRookRight && 
          board[0][5] === '' && board[0][6] === '' &&
          !this.isSquareUnderAttack(board, [0, 4], 'k') &&
          !this.isSquareUnderAttack(board, [0, 5], 'k') &&
          !this.isSquareUnderAttack(board, [0, 6], 'k')) {
        moves.push([0, 6]);
      }
      
      // Queen-side castling
      if (!hasMoved.blackRookLeft && 
          board[0][1] === '' && board[0][2] === '' && board[0][3] === '' &&
          !this.isSquareUnderAttack(board, [0, 4], 'k') &&
          !this.isSquareUnderAttack(board, [0, 3], 'k') &&
          !this.isSquareUnderAttack(board, [0, 2], 'k')) {
        moves.push([0, 2]);
      }
    }

    return moves;
  }

  getLinearMoves(board, row, col, directions) {
    const moves = [];
    
    directions.forEach(([rOffset, cOffset]) => {
      let newRow = row + rOffset;
      let newCol = col + cOffset;
      
      while (this.isOnBoard(newRow, newCol) && !board[newRow][newCol]) {
        moves.push([newRow, newCol]);
        newRow += rOffset;
        newCol += cOffset;
      }
      
      if (this.isOnBoard(newRow, newCol) && this.isOpponentPiece(board, board[row][col], newRow, newCol)) {
        moves.push([newRow, newCol]);
      }
    });
    
    return moves;
  }

  // Check if a square is under attack by the opponent
  isSquareUnderAttack(board, square, friendlyKing) {
    const [row, col] = square;
    
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c];
        if (piece && this.isOpponentPiece(board, friendlyKing, r, c)) {
          // Get moves for this opponent piece (excluding castling to avoid recursion)
          const moves = piece.toUpperCase() === 'K' 
            ? this.getKingMoves(board, r, c, {}) 
            : this.getValidMoves(board, piece, r, c, {});
          
          if (moves.some(([moveRow, moveCol]) => moveRow === row && moveCol === col)) {
            return true;
          }
        }
      }
    }
    return false;
  }

  // Utility functions
  isOnBoard(row, col) {
    return row >= 0 && row < 8 && col >= 0 && col < 8;
  }

  isSameSide(board, row1, col1, row2, col2) {
    const piece1 = board[row1][col1];
    const piece2 = board[row2][col2];
    if (!piece1 || !piece2) return false;
    return (piece1 === piece1.toUpperCase() && piece2 === piece2.toUpperCase()) ||
           (piece1 === piece1.toLowerCase() && piece2 === piece2.toLowerCase());
  }

  isOpponentPiece(board, piece, row, col) {
    const target = board[row][col];
    if (!target) return false;
    return (piece === piece.toUpperCase() && target === target.toLowerCase()) ||
           (piece === piece.toLowerCase() && target === target.toUpperCase());
  }

  findKingPosition(board, king) {
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        if (board[row][col] === king) {
          return [row, col];
        }
      }
    }
    return null;
  }

  // Check if king is in check
  isKingInCheck(board, kingPosition, king) {
    const [kingRow, kingCol] = kingPosition;
    
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        
        // Check if this piece is an opponent piece
        if (piece && this.isOpponentPiece(board, king, row, col)) {
          // Get valid moves for this opponent piece
          const validMoves = this.getValidMoves(board, piece, row, col, {});
          if (validMoves.some(([r, c]) => r === kingRow && c === kingCol)) {
            return true;
          }
        }
      }
    }
    return false;
  }

  // Check for checkmate, stalemate, or check
  checkGameStatus(board, turn, hasMoved) {
    const currentPlayerKing = turn ? 'k' : 'K';
    const kingPosition = this.findKingPosition(board, currentPlayerKing);
    
    if (!kingPosition) {
      return 'error'; // This shouldn't happen in a valid game
    }
    
    const inCheck = this.isKingInCheck(board, kingPosition, currentPlayerKing);
    
    // Check if current player has any legal moves
    const hasLegalMoves = this.hasAnyLegalMoves(board, turn, hasMoved);
    
    if (!hasLegalMoves) {
      return inCheck ? 'checkmate' : 'stalemate';
    }
    
    return inCheck ? 'check' : 'active';
  }

  hasAnyLegalMoves(board, turn, hasMoved) {
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        if (piece && ((piece === piece.toLowerCase()) === turn)) {
          const moves = this.getValidMoves(board, piece, row, col, hasMoved);
          
          // Check if any of these moves are legal (don't leave king in check)
          for (const [toRow, toCol] of moves) {
            const testBoard = this.copyBoard(board);
            const testHasMoved = { ...hasMoved };
            
            this.applyMoveToBoard(testBoard, testHasMoved, [row, col], [toRow, toCol]);
            
            const kingPos = this.findKingPosition(testBoard, turn ? 'k' : 'K');
            if (kingPos && !this.isKingInCheck(testBoard, kingPos, turn ? 'k' : 'K')) {
              return true;
            }
          }
        }
      }
    }
    return false;
  }

  // Helper function to copy board
  copyBoard(board) {
    return board.map(row => [...row]);
  }
}

module.exports = ChessLogic;
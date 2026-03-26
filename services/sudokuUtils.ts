import { BoardState, CellData, Difficulty } from '../types';

// Constants
const BLANK = 0;

export const createEmptyBoard = (): BoardState => {
  return Array.from({ length: 9 }, (_, row) =>
    Array.from({ length: 9 }, (_, col) => ({
      row,
      col,
      value: BLANK,
      isFixed: false,
      notes: [],
      isError: false,
    }))
  );
};

// Check if placing num at board[row][col] is valid (Standard rules)
export const isValidMove = (board: number[][], row: number, col: number, num: number): boolean => {
  // Check row
  for (let x = 0; x < 9; x++) {
    if (board[row][x] === num && x !== col) return false;
  }
  // Check col
  for (let x = 0; x < 9; x++) {
    if (board[x][col] === num && x !== row) return false;
  }
  // Check 3x3 box
  const startRow = Math.floor(row / 3) * 3;
  const startCol = Math.floor(col / 3) * 3;
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      if (board[startRow + i][startCol + j] === num && (startRow + i !== row || startCol + j !== col)) {
        return false;
      }
    }
  }
  return true;
};

// Solves the board using backtracking (modifies board in-place)
const solveSudoku = (board: number[][]): boolean => {
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      if (board[row][col] === BLANK) {
        // Try numbers 1-9
        const nums = [1, 2, 3, 4, 5, 6, 7, 8, 9].sort(() => Math.random() - 0.5);
        for (const num of nums) {
          if (isValidMove(board, row, col, num)) {
            board[row][col] = num;
            if (solveSudoku(board)) return true;
            board[row][col] = BLANK;
          }
        }
        return false;
      }
    }
  }
  return true;
};

// Generates a new valid Sudoku puzzle
export const generateSudoku = (difficulty: Difficulty): { board: BoardState; solution: number[][] } => {
  // 1. Create a full solved board
  const rawBoard: number[][] = Array.from({ length: 9 }, () => Array(9).fill(0));
  solveSudoku(rawBoard);
  
  // Clone for solution
  const solution = rawBoard.map(row => [...row]);

  // 2. Remove numbers based on difficulty
  const attempts = difficulty === 'Easy' ? 30 
                 : difficulty === 'Medium' ? 45 
                 : difficulty === 'Hard' ? 55 
                 : 65; // Expert

  const puzzleBoard = rawBoard.map(row => [...row]);
  let count = attempts;

  while (count > 0) {
    const row = Math.floor(Math.random() * 9);
    const col = Math.floor(Math.random() * 9);
    if (puzzleBoard[row][col] !== BLANK) {
      puzzleBoard[row][col] = BLANK;
      count--;
    }
  }

  // 3. Convert to BoardState
  const boardState = puzzleBoard.map((rowArr, rIndex) =>
    rowArr.map((val, cIndex) => ({
      row: rIndex,
      col: cIndex,
      value: val,
      isFixed: val !== BLANK,
      notes: [],
      isError: false,
    }))
  );

  return { board: boardState, solution };
};

export const checkWin = (board: BoardState): boolean => {
  // Check if all filled and valid
  const rawBoard = board.map(row => row.map(cell => cell.value));
  
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (rawBoard[r][c] === BLANK) return false;
      if (!isValidMove(rawBoard, r, c, rawBoard[r][c])) return false;
    }
  }
  return true;
};

// Serialize board for AI
export const boardToString = (board: BoardState): string => {
  return board.map(row => row.map(c => c.value === 0 ? '.' : c.value).join('')).join('\n');
};

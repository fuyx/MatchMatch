type Board = number[][];
interface BoardDelta {
  row: number;
  col: number;
}
type IProposalData = BoardDelta;
interface IState {
  board: Board; // 1 -> SIZE
  shownBoard: Board; // -1 for hidden places; 0 for player 0; 1 for player 1
  clickedBoard: Board; // -1 for never clicked; 0 for only player 0 clicked;
                       // 1 for only player 1 clicked; 2 for both of them clicked
  delta1: BoardDelta;
  delta2: BoardDelta;
  status: number;
}

import gameService = gamingPlatform.gameService;
import alphaBetaService = gamingPlatform.alphaBetaService;
import translate = gamingPlatform.translate;
import resizeGameAreaService = gamingPlatform.resizeGameAreaService;
import log = gamingPlatform.log;
import dragAndDropService = gamingPlatform.dragAndDropService;

module gameLogic {
  export let rows = 4;
  export let cols = 4;
  export let size = 8;
  export let status = 0;

  /** Returns the initial TicTacToe board, which is a ROWSxCOLS matrix containing ''. */
  export function getInitialBoards(rows: number, cols:number): [Board, Board, Board] {
    rows = rows;
    cols = cols;
    size = rows * cols / 2
    log.info("getInitialBoards", rows, cols, size);
    let board: Board = [];
    let shownBoard: Board = [];
    let clickedBoard: Board = [];
    let counts: number[] = [];
    for (let i = 0; i < size; i++) {
        counts[i] = 0;
    }
    for (let i = 0; i < rows; i++) {
      board[i] = [];
      shownBoard[i] = [];
      clickedBoard[i] = [];
      for (let j = 0; j < cols; j++) {
        let n = Math.floor(Math.random() * size);
        while (counts[n] >= 2) {
          n = Math.floor(Math.random() * size);
        }
        counts[n]++;
        board[i][j] = n;
        shownBoard[i][j] = -1;
        clickedBoard[i][j] = -1;
      }
    }
    return [board, shownBoard, clickedBoard];
  }

  export function getInitialState(rows:number,cols:number): IState {
    let initBoards = getInitialBoards(rows,cols);
    return {board: initBoards[0], shownBoard: initBoards[1], clickedBoard: initBoards[2], 
      delta1: null, delta2: null, status: 0};
  }

  /**
   * 
   */
  function hasEmptyGrid(board: Board): boolean {
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        if (board[i][j] === -1) {
          // If there is an empty cell then we do not have a tie.
          return true;
        }
      }
    }
    // No empty cells, so we have a tie!
    return false;
  }

  /**
   * 
   */
  export function computeScores(board: Board, shownBoard: Board): [number, number] {
    // scan the board and compute the socre
    let score0 : number = 0;
    let score1 : number = 0;
    let player1Counts: number[] = [];
    let player2Counts: number[] = [];
    for (let i = 0; i < size; i++) {
      player1Counts[i] = 0;
      player2Counts[i] = 0;
    }
    for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
            if (shownBoard[i][j] == 0) {
                player1Counts[board[i][j]]++;
            } else if (shownBoard[i][j] == 1) {
                player2Counts[board[i][j]]++;
            }
        }
    }
    for (let i = 0; i < size; i++) {
      if(player1Counts[i] == 2) {
        score0++;
      }
      if(player2Counts[i] == 2) {
        score1++;
      }
    }
    return [score0, score1];
  }

  export function chooseSize(rows: number, cols: number, turnIndex: number): IMove {
    rows = rows;
    cols = cols;
    let state = getInitialState(rows,cols);
    let move: IMove = {
      endMatchScores: null,
      turnIndex: turnIndex,
      state: state
    };
    log.info("chooseSize", move);
    return move;
  }

  /**
   * Returns the move that should be performed when player
   * with index turnIndexBeforeMove makes a move in cell row X col.
   */
  export function createMove(
      stateBeforeMove: IState, row: number, col: number, turnIndexBeforeMove: number): IMove {
    rows = stateBeforeMove.board.length;
    cols = stateBeforeMove.board[0].length;
    let shownBoard: Board = stateBeforeMove.shownBoard;
    if (shownBoard[row][col] !== -1) {
      throw new Error("One can only make a move in an empty position!");
    }
    if (!hasEmptyGrid(shownBoard)) {
      throw new Error("Can only make a move if the game is not over!");
    }
    let shownBoardAfterMove = angular.copy(shownBoard);

    shownBoardAfterMove[row][col] = turnIndexBeforeMove;
    // update clickedBoard
    if (stateBeforeMove.clickedBoard[row][col] == -1) {
      stateBeforeMove.clickedBoard[row][col] = turnIndexBeforeMove;
    } else if (stateBeforeMove.clickedBoard[row][col] != turnIndexBeforeMove) {
      stateBeforeMove.clickedBoard[row][col] = 2;
    }

    let scores = computeScores(stateBeforeMove.board, shownBoardAfterMove);
    let endMatchScores: number[];
    let turnIndex: number;
    if (!hasEmptyGrid(shownBoardAfterMove)) {
      // Game over.
      turnIndex = -1;
      if (scores[0] > scores[1]) {
        endMatchScores = [1, 0];
      } else if (scores[0] < scores[1]) {
        endMatchScores = [0, 1];
      } else {
        endMatchScores = [0, 0];
      }
    } else {
      // Game continues. Now it's the opponent's turn (the turn switches from 0 to 1 and 1 to 0).
      turnIndex = 1 - turnIndexBeforeMove;
      endMatchScores = null;
    }
    let delta: BoardDelta = {row: row, col: col};

    let state: IState = {delta1: delta, delta2: null, shownBoard: shownBoardAfterMove, 
      board: stateBeforeMove.board, clickedBoard: stateBeforeMove.clickedBoard, status:1};
    if (stateBeforeMove.delta1 != null && stateBeforeMove.delta2 == null) {
      state = {delta1: stateBeforeMove.delta1, delta2: delta, shownBoard: shownBoardAfterMove, 
        board: stateBeforeMove.board, clickedBoard: stateBeforeMove.clickedBoard, status:1};
    }
    
    log.info("gameLogic.createMove", state);

    return {
      endMatchScores: endMatchScores,
      turnIndex: turnIndex,
      state: state
    };
  }

  export function checkMatch(state: IState): boolean {
    let ret = true;
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        let found = false;
        if (state.shownBoard[i][j] == -1) {
          continue;
        }
        let player = state.shownBoard[i][j];
        let target = state.board[i][j];

        for (let ii = 0; ii < rows; ii++) {
          for (let jj = 0; jj < cols; jj++) {
            if ((ii == i && jj == j) || (state.shownBoard[ii][jj] != player)) {
              continue;
            } 
            if (state.board[ii][jj] == target) {
              found = true;
            }
          }
        }
        if (!found) {
          state.shownBoard[i][j] = -1;
          ret = false;
        }
      }
    }
    return ret;
  }

  export function getPlayerHistoryMove(stateBeforeMove: IState, turnIndexBeforeMove: number): boolean[][] {
    let historyMove : boolean[][] = [];
    let clickedBoard = stateBeforeMove.clickedBoard;
    for (let i = 0; i < rows; i++) {
      historyMove[i] = [];
      for (let j = 0; j < cols; j++) {
        if (clickedBoard[i][j] == 2 || clickedBoard[i][j] == turnIndexBeforeMove) {
          historyMove[i][j] = true;
        } else {
          historyMove[i][j] = false;
        }
      }
    }
    return historyMove;
  }
  
  export function createInitialMove(rows:number, cols:number): IMove {
    return {endMatchScores: null, turnIndex: 0, 
        state: getInitialState(rows,cols)};  
  }

  export function forSimpleTestHtml() {
    var move = gameLogic.createMove(null, 0, 0, 0);
    log.log("move=", move);
  }
}

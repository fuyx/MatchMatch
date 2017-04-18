module aiService {
  export const DIFFICULTY = 0.5;
  /** Returns the move that the computer player should do for the given state in move. */
  export function findComputerMove(move: IMove): IMove {
    if (Math.random() > DIFFICULTY || move.state === null) { // random choose 2
      log.info("Random choose 2 grid.")
      let i1 = Math.floor(Math.random() * gameLogic.ROWS);
      let j1 = Math.floor(Math.random() * gameLogic.COLS);
      while(move.state !== null && move.state.shownBoard[i1][j1] !== -1) {
        i1 = Math.floor(Math.random() * gameLogic.ROWS);
        j1 = Math.floor(Math.random() * gameLogic.COLS);
      }
      let possibleMove = gameLogic.createMove(move.state, i1, j1, move.turnIndex);
      let i2 = Math.floor(Math.random() * gameLogic.ROWS);
      let j2 = Math.floor(Math.random() * gameLogic.COLS);
      while(move.state !== null && (move.state.shownBoard[i2][j2] !== -1 || (i1 === i2 && j1 === j2))) {
        i2 = Math.floor(Math.random() * gameLogic.ROWS);
        j2 = Math.floor(Math.random() * gameLogic.COLS);
      }
      log.info(i1,j1,i2,j2)
      possibleMove = gameLogic.createMove(possibleMove.state, i2, j2,  move.turnIndex);
      return possibleMove;
    } else {
      log.info("Find a match.")
      for (let i = 0; i < gameLogic.ROWS; i++) {
        for (let j = 0; j < gameLogic.COLS; j++) {
          if (move.state.shownBoard[i][j] === -1) {
            let target = move.state.board[i][j];
            let possibleMove = gameLogic.createMove(move.state, i, j, move.turnIndex);
            for (let i2 = 0; i2 < gameLogic.ROWS; i2++) {
              for (let j2 = 0; j2 < gameLogic.COLS; j2++) {
                if (move.state.shownBoard[i2][j2] === -1 && !(i2 === i && j2 === j) &&
                move.state.board[i2][j2] === target) {
                  log.info(i, j, i2, j2)
                  possibleMove = gameLogic.createMove(possibleMove.state, i2, j2,  move.turnIndex);
                  return possibleMove;
                }
              }
            }
          }
        }
      }
      log.info("!!!");
    }
  }
}
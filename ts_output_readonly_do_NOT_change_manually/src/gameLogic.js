var gameService = gamingPlatform.gameService;
var alphaBetaService = gamingPlatform.alphaBetaService;
var translate = gamingPlatform.translate;
var resizeGameAreaService = gamingPlatform.resizeGameAreaService;
var log = gamingPlatform.log;
var dragAndDropService = gamingPlatform.dragAndDropService;
var gameLogic;
(function (gameLogic) {
    gameLogic.rows = 4;
    gameLogic.cols = 4;
    gameLogic.size = 8;
    gameLogic.status = 0;
    /** Returns the initial TicTacToe board, which is a ROWSxCOLS matrix containing ''. */
    function getInitialBoards(rows, cols) {
        rows = rows;
        cols = cols;
        gameLogic.size = rows * cols / 2;
        log.info("getInitialBoards", rows, cols, gameLogic.size);
        var board = [];
        var shownBoard = [];
        var clickedBoard = [];
        var counts = [];
        for (var i = 0; i < gameLogic.size; i++) {
            counts[i] = 0;
        }
        for (var i = 0; i < rows; i++) {
            board[i] = [];
            shownBoard[i] = [];
            clickedBoard[i] = [];
            for (var j = 0; j < cols; j++) {
                var n = Math.floor(Math.random() * gameLogic.size);
                while (counts[n] >= 2) {
                    n = Math.floor(Math.random() * gameLogic.size);
                }
                counts[n]++;
                board[i][j] = n;
                shownBoard[i][j] = -1;
                clickedBoard[i][j] = -1;
            }
        }
        return [board, shownBoard, clickedBoard];
    }
    gameLogic.getInitialBoards = getInitialBoards;
    function getInitialState(rows, cols) {
        var initBoards = getInitialBoards(rows, cols);
        return { board: initBoards[0], shownBoard: initBoards[1], clickedBoard: initBoards[2],
            delta1: null, delta2: null, status: 0 };
    }
    gameLogic.getInitialState = getInitialState;
    /**
     *
     */
    function hasEmptyGrid(board) {
        for (var i = 0; i < gameLogic.rows; i++) {
            for (var j = 0; j < gameLogic.cols; j++) {
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
    function computeScores(board, shownBoard) {
        // scan the board and compute the socre
        var score0 = 0;
        var score1 = 0;
        var player1Counts = [];
        var player2Counts = [];
        for (var i = 0; i < gameLogic.size; i++) {
            player1Counts[i] = 0;
            player2Counts[i] = 0;
        }
        for (var i = 0; i < gameLogic.rows; i++) {
            for (var j = 0; j < gameLogic.cols; j++) {
                if (shownBoard[i][j] == 0) {
                    player1Counts[board[i][j]]++;
                }
                else if (shownBoard[i][j] == 1) {
                    player2Counts[board[i][j]]++;
                }
            }
        }
        for (var i = 0; i < gameLogic.size; i++) {
            if (player1Counts[i] == 2) {
                score0++;
            }
            if (player2Counts[i] == 2) {
                score1++;
            }
        }
        return [score0, score1];
    }
    gameLogic.computeScores = computeScores;
    function chooseSize(rows, cols, turnIndex) {
        rows = rows;
        cols = cols;
        var state = getInitialState(rows, cols);
        var move = {
            endMatchScores: null,
            turnIndex: turnIndex,
            state: state
        };
        log.info("chooseSize", move);
        return move;
    }
    gameLogic.chooseSize = chooseSize;
    /**
     * Returns the move that should be performed when player
     * with index turnIndexBeforeMove makes a move in cell row X col.
     */
    function createMove(stateBeforeMove, row, col, turnIndexBeforeMove) {
        gameLogic.rows = stateBeforeMove.board.length;
        gameLogic.cols = stateBeforeMove.board[0].length;
        var shownBoard = stateBeforeMove.shownBoard;
        if (shownBoard[row][col] !== -1) {
            throw new Error("One can only make a move in an empty position!");
        }
        if (!hasEmptyGrid(shownBoard)) {
            throw new Error("Can only make a move if the game is not over!");
        }
        var shownBoardAfterMove = angular.copy(shownBoard);
        shownBoardAfterMove[row][col] = turnIndexBeforeMove;
        // update clickedBoard
        if (stateBeforeMove.clickedBoard[row][col] == -1) {
            stateBeforeMove.clickedBoard[row][col] = turnIndexBeforeMove;
        }
        else if (stateBeforeMove.clickedBoard[row][col] != turnIndexBeforeMove) {
            stateBeforeMove.clickedBoard[row][col] = 2;
        }
        var scores = computeScores(stateBeforeMove.board, shownBoardAfterMove);
        var endMatchScores;
        var turnIndex;
        if (!hasEmptyGrid(shownBoardAfterMove)) {
            // Game over.
            turnIndex = -1;
            if (scores[0] > scores[1]) {
                endMatchScores = [1, 0];
            }
            else if (scores[0] < scores[1]) {
                endMatchScores = [0, 1];
            }
            else {
                endMatchScores = [0, 0];
            }
        }
        else {
            // Game continues. Now it's the opponent's turn (the turn switches from 0 to 1 and 1 to 0).
            turnIndex = 1 - turnIndexBeforeMove;
            endMatchScores = null;
        }
        var delta = { row: row, col: col };
        var state = { delta1: delta, delta2: null, shownBoard: shownBoardAfterMove,
            board: stateBeforeMove.board, clickedBoard: stateBeforeMove.clickedBoard, status: 1 };
        if (stateBeforeMove.delta1 != null && stateBeforeMove.delta2 == null) {
            state = { delta1: stateBeforeMove.delta1, delta2: delta, shownBoard: shownBoardAfterMove,
                board: stateBeforeMove.board, clickedBoard: stateBeforeMove.clickedBoard, status: 1 };
        }
        log.info("gameLogic.createMove", state);
        return {
            endMatchScores: endMatchScores,
            turnIndex: turnIndex,
            state: state
        };
    }
    gameLogic.createMove = createMove;
    function checkMatch(state) {
        var delta1 = state.delta1;
        var delta2 = state.delta2;
        var board = state.board;
        if (delta1 != null && delta2 != null) {
            if (board[delta1.row][delta1.col] != board[delta2.row][delta2.col]) {
                state.shownBoard[delta1.row][delta1.col] = -1;
                state.shownBoard[delta2.row][delta2.col] = -1;
                return false;
            }
        }
        return true;
    }
    gameLogic.checkMatch = checkMatch;
    function getPlayerHistoryMove(stateBeforeMove, turnIndexBeforeMove) {
        var historyMove = [];
        var clickedBoard = stateBeforeMove.clickedBoard;
        for (var i = 0; i < gameLogic.rows; i++) {
            historyMove[i] = [];
            for (var j = 0; j < gameLogic.cols; j++) {
                if (clickedBoard[i][j] == 2 || clickedBoard[i][j] == turnIndexBeforeMove) {
                    historyMove[i][j] == true;
                }
                else {
                    historyMove[i][j] == false;
                }
            }
        }
        return historyMove;
    }
    gameLogic.getPlayerHistoryMove = getPlayerHistoryMove;
    function createInitialMove(rows, cols) {
        return { endMatchScores: null, turnIndex: 0,
            state: getInitialState(rows, cols) };
    }
    gameLogic.createInitialMove = createInitialMove;
    function forSimpleTestHtml() {
        var move = gameLogic.createMove(null, 0, 0, 0);
        log.log("move=", move);
    }
    gameLogic.forSimpleTestHtml = forSimpleTestHtml;
})(gameLogic || (gameLogic = {}));
//# sourceMappingURL=gameLogic.js.map
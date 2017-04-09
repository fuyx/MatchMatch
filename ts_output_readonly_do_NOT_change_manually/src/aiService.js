var aiService;
(function (aiService) {
    aiService.DIFFICULTY = 0.3;
    /** Returns the move that the computer player should do for the given state in move. */
    function findComputerMove(move) {
        if (Math.random() > aiService.DIFFICULTY || move.state === null) {
            log.info("Random choose 2 grid.");
            var i1 = 0;
            var j1 = 0;
            while (move.state !== null && move.state.shownBoard[i1][j1] !== -1) {
                i1 = Math.floor(Math.random() * gameLogic.ROWS);
                j1 = Math.floor(Math.random() * gameLogic.COLS);
            }
            var possibleMove = gameLogic.createMove(move.state, i1, j1, move.turnIndex);
            var i2 = 0;
            var j2 = 1;
            while (move.state !== null && (move.state.shownBoard[i2][j2] !== -1 || (i1 === i2 && j1 === j2))) {
                i2 = Math.floor(Math.random() * gameLogic.ROWS);
                j2 = Math.floor(Math.random() * gameLogic.COLS);
            }
            log.info(i1, j1, i2, j2);
            possibleMove = gameLogic.createMove(possibleMove.state, i2, j2, move.turnIndex);
            return possibleMove;
        }
        else {
            log.info("Find a match.");
            for (var i = 0; i < gameLogic.ROWS; i++) {
                for (var j = 0; j < gameLogic.COLS; j++) {
                    if (move.state.shownBoard[i][j] === -1) {
                        var target = move.state.board[i][j];
                        var possibleMove = gameLogic.createMove(move.state, i, j, move.turnIndex);
                        for (var i2 = 0; i2 < gameLogic.ROWS; i2++) {
                            for (var j2 = 0; j2 < gameLogic.COLS; j2++) {
                                if (move.state.shownBoard[i2][j2] === -1 && !(i2 === i && j2 === j) &&
                                    move.state.board[i2][j2] === target) {
                                    log.info(i, j, i2, j2);
                                    possibleMove = gameLogic.createMove(possibleMove.state, i2, j2, move.turnIndex);
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
    aiService.findComputerMove = findComputerMove;
})(aiService || (aiService = {}));
//# sourceMappingURL=aiService.js.map
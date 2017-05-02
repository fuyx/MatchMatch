;
var game;
(function (game) {
    game.$rootScope = null;
    game.$timeout = null;
    // Global variables are cleared when getting updateUI.
    // I export all variables to make it easy to debug in the browser by
    // simply typing in the console, e.g.,
    // game.currentUpdateUI
    game.currentUpdateUI = null;
    game.didMakeMove = false; // You can only make one move per updateUI
    game.animationEndedTimeout = null;
    game.state = null;
    // For community games.
    game.proposals = null;
    game.yourPlayerInfo = null;
    game.colors = [];
    game.images = [];
    game.clickCount = 0;
    game.neededDisappear = false;
    game.disappear = null;
    function init($rootScope_, $timeout_) {
        game.$rootScope = $rootScope_;
        game.$timeout = $timeout_;
        registerServiceWorker();
        translate.setTranslations(getTranslations());
        translate.setLanguage('en');
        resizeGameAreaService.setWidthToHeight(1);
        gameService.setGame({
            updateUI: updateUI,
            getStateForOgImage: null,
        });
        game.colors[0] = "red";
        game.colors[1] = "yellow";
        game.colors[2] = "lime";
        game.colors[3] = "aqua";
        game.colors[4] = "blue";
        game.colors[5] = "purple";
        game.colors[6] = "gray";
        game.colors[7] = "orange";
        game.images[0] = "cherry";
        game.images[1] = "apple";
        game.images[2] = "grapes";
        game.images[3] = "kiwi";
        game.images[4] = "orange";
        game.images[5] = "pineapple";
        game.images[6] = "strawberry";
        game.images[7] = "watermelon";
        game.images[8] = "bananas";
        game.images[9] = "mango";
    }
    game.init = init;
    function registerServiceWorker() {
        // I prefer to use appCache over serviceWorker
        // (because iOS doesn't support serviceWorker, so we have to use appCache)
        // I've added this code for a future where all browsers support serviceWorker (so we can deprecate appCache!)
        if (!window.applicationCache && 'serviceWorker' in navigator) {
            var n = navigator;
            log.log('Calling serviceWorker.register');
            n.serviceWorker.register('service-worker.js').then(function (registration) {
                log.log('ServiceWorker registration successful with scope: ', registration.scope);
            }).catch(function (err) {
                log.log('ServiceWorker registration failed: ', err);
            });
        }
    }
    function getTranslations() {
        return {};
    }
    function isProposal(row, col) {
        return game.proposals && game.proposals[row][col] > 0;
    }
    game.isProposal = isProposal;
    function getCellStyle(row, col) {
        if (!isProposal(row, col))
            return {};
        // proposals[row][col] is > 0
        var countZeroBased = game.proposals[row][col] - 1;
        var maxCount = game.currentUpdateUI.numberOfPlayersRequiredToMove - 2;
        var ratio = maxCount == 0 ? 1 : countZeroBased / maxCount; // a number between 0 and 1 (inclusive).
        // scale will be between 0.6 and 0.8.
        var scale = 0.6 + 0.2 * ratio;
        // opacity between 0.5 and 0.7
        var opacity = 0.5 + 0.2 * ratio;
        return {
            transform: "scale(" + scale + ", " + scale + ")",
            opacity: "" + opacity,
        };
    }
    game.getCellStyle = getCellStyle;
    function getProposalsBoard(playerIdToProposal) {
        var proposals = [];
        for (var i = 0; i < gameLogic.rows; i++) {
            proposals[i] = [];
            for (var j = 0; j < gameLogic.cols; j++) {
                proposals[i][j] = 0;
            }
        }
        for (var playerId in playerIdToProposal) {
            var proposal = playerIdToProposal[playerId];
            var delta = proposal.data;
            proposals[delta.row][delta.col]++;
        }
        return proposals;
    }
    function updateUI(params) {
        log.info("Game got updateUI:", params);
        var playerIdToProposal = params.playerIdToProposal;
        // Only one move/proposal per updateUI
        game.didMakeMove = playerIdToProposal && playerIdToProposal[game.yourPlayerInfo.playerId] != undefined;
        game.yourPlayerInfo = params.yourPlayerInfo;
        game.clickCount = 0;
        game.proposals = playerIdToProposal ? getProposalsBoard(playerIdToProposal) : null;
        if (playerIdToProposal) {
            // If only proposals changed, then return.
            // I don't want to disrupt the player if he's in the middle of a move.
            // I delete playerIdToProposal field from params (and so it's also not in currentUpdateUI),
            // and compare whether the objects are now deep-equal.
            params.playerIdToProposal = null;
            if (game.currentUpdateUI && angular.equals(game.currentUpdateUI, params))
                return;
        }
        game.playMode = params.playMode;
        game.currentUpdateUI = params;
        clearAnimationTimeout();
        game.state = params.state;
        if (game.state != null) {
            gameLogic.rows = game.state.board.length;
            gameLogic.cols = game.state.board[0].length;
        }
        if (isFirstMove()) {
        }
        else {
            if (params.playMode === 'passAndPlay') {
                if (!gameLogic.checkMatch(game.state)) {
                    game.neededDisappear = true;
                    game.disappear = { row1: game.state.delta1.row, col1: game.state.delta1.col,
                        row2: game.state.delta2.row, col2: game.state.delta2.col
                    };
                }
            }
            else {
                setTimeout(function () {
                    if (!gameLogic.checkMatch(game.state)) {
                        game.neededDisappear = true;
                        game.disappear = { row1: game.state.delta1.row, col1: game.state.delta1.col,
                            row2: game.state.delta2.row, col2: game.state.delta2.col };
                    }
                }, 50);
            }
        }
        if (params.state != null) {
            gameLogic.status = params.state.status;
        }
        log.info(game);
        // We calculate the AI move only after the animation finishes,
        // because if we call aiService now
        // then the animation will be paused until the javascript finishes.
        game.animationEndedTimeout = game.$timeout(animationEndedCallback, 500);
    }
    game.updateUI = updateUI;
    function showChoosePanel() {
        if (game.playMode == 'passAndPlay') {
            return true;
        }
        else if (game.playMode == 'playAgainstTheComputer') {
            return true;
        }
        else {
            return isMyTurn();
        }
    }
    game.showChoosePanel = showChoosePanel;
    function animationEndedCallback() {
        log.info("Animation ended");
        maybeSendComputerMove();
    }
    function clearAnimationTimeout() {
        if (game.animationEndedTimeout) {
            game.$timeout.cancel(game.animationEndedTimeout);
            game.animationEndedTimeout = null;
        }
    }
    function maybeSendComputerMove() {
        if (!isComputerTurn())
            return;
        var currentMove = {
            endMatchScores: game.currentUpdateUI.endMatchScores,
            state: game.currentUpdateUI.state,
            turnIndex: game.currentUpdateUI.turnIndex,
        };
        var move = aiService.findComputerMove(currentMove);
        log.info("Computer move: ", move);
        makeMove(move);
    }
    function chooseSize(rows, cols) {
        log.info("chooseSize", rows, cols);
        var move = gameLogic.chooseSize(rows, cols, game.currentUpdateUI.turnIndex);
        makeMove(move);
    }
    game.chooseSize = chooseSize;
    function makeMove(move) {
        var needDelay = true;
        if (move.state.status == 0) {
            move.state.status = 1;
            needDelay = false;
        }
        else {
            if (move.state.delta2 == null) {
                log.info("game.makeMove -> expect 2nd click...");
                return;
            }
            if (game.didMakeMove) {
                return;
            }
        }
        game.didMakeMove = true;
        if (!game.proposals) {
            if (needDelay) {
                setTimeout(function () { gameService.makeMove(move, null); }, 1000);
            }
            else {
                gameService.makeMove(move, null);
            }
        }
        else {
            // TODO implement community game later.
        }
    }
    function getScores() {
        var playerName = [];
        var scores = gameLogic.computeScores(game.state.board, game.state.shownBoard);
        if (game.playMode == 'playAgainstTheComputer') {
            playerName[0] = "My score";
            playerName[1] = "Computer";
        }
        else if (game.playMode == 'passAndPlay') {
            playerName[0] = "Player1";
            playerName[1] = "Player2";
        }
        else if (game.playMode == '0') {
            playerName[0] = "My score";
            playerName[1] = "Opponent score";
        }
        else if (game.playMode == '1') {
            playerName[1] = "My score";
            playerName[0] = "Opponent score";
            var tmp = scores[0];
            scores[0] = scores[1];
            scores[1] = scores[0];
        }
        return [playerName, scores];
    }
    game.getScores = getScores;
    function isFirstMove() {
        return !game.currentUpdateUI.state;
    }
    function yourPlayerIndex() {
        return game.currentUpdateUI.yourPlayerIndex;
    }
    function isComputer() {
        var playerInfo = game.currentUpdateUI.playersInfo[game.currentUpdateUI.yourPlayerIndex];
        // In community games, playersInfo is [].
        return playerInfo && playerInfo.playerId === '';
    }
    function isComputerTurn() {
        return isMyTurn() && isComputer();
    }
    function isHumanTurn() {
        return isMyTurn() && !isComputer();
    }
    function isMyTurn() {
        return !game.didMakeMove &&
            game.currentUpdateUI.turnIndex >= 0 &&
            game.currentUpdateUI.yourPlayerIndex === game.currentUpdateUI.turnIndex; // it's my turn
    }
    function isHistoryMove(row, col) {
        var historyMove = gameLogic.getPlayerHistoryMove(game.currentUpdateUI.state, game.currentUpdateUI.yourPlayerIndex);
        log.info("isHistoryMove", historyMove[row][col]);
        return historyMove[row][col];
    }
    game.isHistoryMove = isHistoryMove;
    function cellClicked(row, col) {
        log.info("Clicked on cell:", row, col);
        if (game.clickCount >= 2 || isFlipped(row, col)) {
            return;
        }
        if (!isHumanTurn())
            return;
        var nextMove = null;
        try {
            nextMove = gameLogic.createMove(game.state, row, col, game.currentUpdateUI.turnIndex);
            game.state = nextMove.state;
        }
        catch (e) {
            log.info(["Cell is already full in position:", row, col]);
            return;
        }
        game.clickCount++;
        log.info("cellClicked - state.shownBoard", game.state.shownBoard);
        // Move is legal, make it!
        makeMove(nextMove);
    }
    game.cellClicked = cellClicked;
    function isFlipped(row, col) {
        return game.state.shownBoard[row][col] != -1;
    }
    game.isFlipped = isFlipped;
    function isShow(row, col) {
        return true;
        //return state.shownBoard[row][col] == -1;
    }
    game.isShow = isShow;
    function isPlayer0(row, col) {
        return game.state.shownBoard[row][col] == 0;
    }
    game.isPlayer0 = isPlayer0;
    function isPlayer1(row, col) {
        return game.state.shownBoard[row][col] == 1;
    }
    game.isPlayer1 = isPlayer1;
    function shouldShowImage(row, col) {
        return game.state.shownBoard[row][col] !== -1 || isProposal(row, col);
    }
    game.shouldShowImage = shouldShowImage;
    function shouldSlowlyAppear(row, col) {
        // log.info("shouldSlowlyAppear", row, col);
        return (game.state.delta1 && game.state.delta1.row === row && game.state.delta1.col === col) ||
            (game.state.delta2 && game.state.delta2.row === row && game.state.delta2.col === col);
    }
    game.shouldSlowlyAppear = shouldSlowlyAppear;
    function shouldSlowlyDisappear(row, col) {
        log.info("shouldSlowlyDisappear", game.disappear, row, col, ((game.disappear.row1 === row && game.disappear.col1 === col) ||
            (game.disappear.row2 === row && game.disappear.col2 === col)));
        var ret = game.neededDisappear &&
            ((game.disappear.row1 === row && game.disappear.col1 === col) ||
                (game.disappear.row2 === row && game.disappear.col2 === col)) &&
            game.clickCount === 0;
        if (ret === true) {
            log.info("shouldSlowlyDisappear:", row, col);
        }
        return ret;
        // return true;
    }
    game.shouldSlowlyDisappear = shouldSlowlyDisappear;
    function setStatus(status) {
        log.info("setStatus", status);
        gameLogic.status = status;
    }
    game.setStatus = setStatus;
    function getColor(row, col) {
        var idx = game.state.board[row][col];
        return game.colors[idx];
    }
    game.getColor = getColor;
    function getImage(row, col) {
        var idx = game.state.board[row][col];
        return game.images[idx];
    }
    game.getImage = getImage;
    function getPos(coord) {
        if (coord == 0) {
            return "0";
        }
        else if (coord == 1) {
            return "8pt";
        }
        else {
            return "4pt";
        }
    }
    game.getPos = getPos;
    function getStatus() {
        return gameLogic.status;
    }
    game.getStatus = getStatus;
    function getRow() {
        return gameLogic.rows;
    }
    game.getRow = getRow;
    function getCol() {
        return gameLogic.cols;
    }
    game.getCol = getCol;
    function getHeight() {
        return 100.0 / getRow();
    }
    game.getHeight = getHeight;
    function getWidth() {
        return 100.0 / getCol();
    }
    game.getWidth = getWidth;
    function getRowArray() {
        return Array.apply(null, { length: getRow() }).map(Number.call, Number);
    }
    game.getRowArray = getRowArray;
    function getColArray() {
        return Array.apply(null, { length: getCol() }).map(Number.call, Number);
    }
    game.getColArray = getColArray;
})(game || (game = {}));
angular.module('myApp', ['gameServices'])
    .run(['$rootScope', '$timeout',
    function ($rootScope, $timeout) {
        $rootScope['game'] = game;
        game.init($rootScope, $timeout);
    }]);
//# sourceMappingURL=game.js.map
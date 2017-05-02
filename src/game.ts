interface SupportedLanguages {
  en: string, iw: string,
  pt: string, zh: string,
  el: string, fr: string,
  hi: string, es: string,
};

interface IDisappear {
  row1: number;
  col1: number;
  row2: number;
  col2: number;
}

module game {
  export let $rootScope: angular.IScope = null;
  export let $timeout: angular.ITimeoutService = null;

  // Global variables are cleared when getting updateUI.
  // I export all variables to make it easy to debug in the browser by
  // simply typing in the console, e.g.,
  // game.currentUpdateUI
  export let currentUpdateUI: IUpdateUI = null;
  export let didMakeMove: boolean = false; // You can only make one move per updateUI
  export let animationEndedTimeout: ng.IPromise<any> = null;
  export let state: IState = null;
  // For community games.
  export let proposals: number[][] = null;
  export let yourPlayerInfo: IPlayerInfo = null;
  export let colors : string[] = [];
  export let images : string[] = [];
  export let clickCount = 0;
  export let neededDisappear = false;
  export let disappear: IDisappear = null;

  export let playMode: PlayMode;

  export function init($rootScope_: angular.IScope, $timeout_: angular.ITimeoutService) {
    $rootScope = $rootScope_;
    $timeout = $timeout_;
    registerServiceWorker();
    translate.setTranslations(getTranslations());
    translate.setLanguage('en');
    resizeGameAreaService.setWidthToHeight(1);
    gameService.setGame({
      updateUI: updateUI,
      getStateForOgImage: null,
    });
    colors[0] = "red";
    colors[1] = "yellow";
    colors[2] = "lime";
    colors[3] = "aqua";
    colors[4] = "blue";
    colors[5] = "purple";
    colors[6] = "gray";
    colors[7] = "orange";

    images[0] = "cherry";
    images[1] = "apple";
    images[2] = "grapes";
    images[3] = "kiwi";
    images[4] = "orange";
    images[5] = "pineapple";
    images[6] = "strawberry";
    images[7] = "watermelon";
    images[8] = "bananas";
    images[9] = "mango";
  }

  function registerServiceWorker() {
    // I prefer to use appCache over serviceWorker
    // (because iOS doesn't support serviceWorker, so we have to use appCache)
    // I've added this code for a future where all browsers support serviceWorker (so we can deprecate appCache!)
    if (!window.applicationCache && 'serviceWorker' in navigator) {
      let n: any = navigator;
      log.log('Calling serviceWorker.register');
      n.serviceWorker.register('service-worker.js').then(function(registration: any) {
        log.log('ServiceWorker registration successful with scope: ',    registration.scope);
      }).catch(function(err: any) {
        log.log('ServiceWorker registration failed: ', err);
      });
    }
  }

  function getTranslations(): Translations {
    return {};
  }

  export function isProposal(row: number, col: number) {
    return proposals && proposals[row][col] > 0;
  }

  export function getCellStyle(row: number, col: number): Object {
    if (!isProposal(row, col)) return {};
    // proposals[row][col] is > 0
    let countZeroBased = proposals[row][col] - 1;
    let maxCount = currentUpdateUI.numberOfPlayersRequiredToMove - 2;
    let ratio = maxCount == 0 ? 1 : countZeroBased / maxCount; // a number between 0 and 1 (inclusive).
    // scale will be between 0.6 and 0.8.
    let scale = 0.6 + 0.2 * ratio;
    // opacity between 0.5 and 0.7
    let opacity = 0.5 + 0.2 * ratio;
    return {
      transform: `scale(${scale}, ${scale})`,
      opacity: "" + opacity,
    };
  }
  
  function getProposalsBoard(playerIdToProposal: IProposals): number[][] {
    let proposals: number[][] = [];
    for (let i = 0; i < gameLogic.rows; i++) {
      proposals[i] = [];
      for (let j = 0; j < gameLogic.cols; j++) {
        proposals[i][j] = 0;
      }
    }
    for (let playerId in playerIdToProposal) {
      let proposal = playerIdToProposal[playerId];
      let delta = proposal.data;
      proposals[delta.row][delta.col]++;
    }
    return proposals;
  }

  export function updateUI(params: IUpdateUI): void {
    log.info("Game got updateUI:", params);
    let playerIdToProposal = params.playerIdToProposal;
     // Only one move/proposal per updateUI
    didMakeMove = playerIdToProposal && playerIdToProposal[yourPlayerInfo.playerId] != undefined;
    yourPlayerInfo = params.yourPlayerInfo;
    clickCount = 0;
    proposals = playerIdToProposal ? getProposalsBoard(playerIdToProposal) : null;
    if (playerIdToProposal) {
      // If only proposals changed, then return.
      // I don't want to disrupt the player if he's in the middle of a move.
      // I delete playerIdToProposal field from params (and so it's also not in currentUpdateUI),
      // and compare whether the objects are now deep-equal.
      params.playerIdToProposal = null;
      if (currentUpdateUI && angular.equals(currentUpdateUI, params)) return;
    }

    playMode = params.playMode;
    currentUpdateUI = params;
    clearAnimationTimeout();
    state = params.state;

    if(state != null) {
      gameLogic.rows = state.board.length;
      gameLogic.cols = state.board[0].length;
    }
    if (isFirstMove()) {
      
    } else {
      if (params.playMode === 'passAndPlay'){
        if(!gameLogic.checkMatch(state)) {
          neededDisappear = true;
          disappear = {row1: state.delta1.row, col1: state.delta1.col, 
            row2: state.delta2.row, col2: state.delta2.col
          }
        }
      } else {
        setTimeout(()=>{if(!gameLogic.checkMatch(state)) {
          neededDisappear = true;
          disappear = {row1: state.delta1.row, col1: state.delta1.col, 
            row2: state.delta2.row, col2: state.delta2.col};
        }}, 50);
      }
    }
    if(params.state != null) {
      gameLogic.status = params.state.status;
    }

    log.info(game)  

    // We calculate the AI move only after the animation finishes,
    // because if we call aiService now
    // then the animation will be paused until the javascript finishes.
    animationEndedTimeout = $timeout(animationEndedCallback, 500);
  }

  export function showChoosePanel() {
    if (playMode == 'passAndPlay') {
      return true;
    } else if (playMode == 'playAgainstTheComputer') {
      return true;
    } else {
      return isMyTurn();
    }
  }

  function animationEndedCallback() {
    log.info("Animation ended");
    maybeSendComputerMove();
  }

  function clearAnimationTimeout() {
    if (animationEndedTimeout) {
      $timeout.cancel(animationEndedTimeout);
      animationEndedTimeout = null;
    }
  }

  function maybeSendComputerMove() {
    if (!isComputerTurn()) return;
    let currentMove:IMove = {
      endMatchScores: currentUpdateUI.endMatchScores,
      state: currentUpdateUI.state,
      turnIndex: currentUpdateUI.turnIndex,
    }
    let move = aiService.findComputerMove(currentMove);
    log.info("Computer move: ", move);
    makeMove(move);
  }

  export function chooseSize(rows: number, cols: number) {
    log.info("chooseSize", rows, cols);
    let move = gameLogic.chooseSize(rows, cols, currentUpdateUI.turnIndex);
    makeMove(move);
  }

  function makeMove(move: IMove) {
    let needDelay = true;
    if (move.state.status == 0) {
      move.state.status = 1;
      needDelay = false;
    } else {
      if (move.state.delta2 == null) {
        log.info("game.makeMove -> expect 2nd click...");
        return;
      }
      if (didMakeMove) { // Only one move per updateUI
        return;
      }
    }
    didMakeMove = true;
    
    if (!proposals) {
      if(needDelay) {
        setTimeout(()=>{gameService.makeMove(move, null)}, 1000);
      } else {
        gameService.makeMove(move, null)
      }
    } else {
      // TODO implement community game later.
    }
  }

  export function getScores() : [string[], number[]] {
    let playerName : string[] = [];
    let scores : number[] = gameLogic.computeScores(state.board, state.shownBoard);
    if (playMode == 'playAgainstTheComputer') {
      playerName[0] = "My score";
      playerName[1] = "Computer";
    } else if (playMode == 'passAndPlay') {
      playerName[0] = "Player1";
      playerName[1] = "Player2";
    } else if (playMode == '0') {
      playerName[0] = "My score";
      playerName[1] = "Opponent score";
    } else if (playMode == '1') {
      playerName[1] = "My score";
      playerName[0] = "Opponent score";
      let tmp = scores[0];
      scores[0] = scores[1];
      scores[1] = scores[0];
    }
    return [playerName, scores];
  }

  function isFirstMove() {
    return !currentUpdateUI.state;
  }

  function yourPlayerIndex() {
    return currentUpdateUI.yourPlayerIndex;
  }

  function isComputer() {
    let playerInfo = currentUpdateUI.playersInfo[currentUpdateUI.yourPlayerIndex];
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
    return !didMakeMove && // you can only make one move per updateUI.
      currentUpdateUI.turnIndex >= 0 && // game is ongoing
      currentUpdateUI.yourPlayerIndex === currentUpdateUI.turnIndex; // it's my turn
  }

  export function isHistoryMove(row: number, col: number) {
    let historyMove = gameLogic.getPlayerHistoryMove(currentUpdateUI.state, currentUpdateUI.yourPlayerIndex) 
    log.info("isHistoryMove", historyMove[row][col]);
    return historyMove[row][col];
  }

  export function cellClicked(row: number, col: number): void {
    log.info("Clicked on cell:", row, col);
    if (clickCount >= 2 || isFlipped(row, col)) {
      return;
    }

    if (!isHumanTurn()) return;
    let nextMove: IMove = null;
    try {
      nextMove = gameLogic.createMove(
          state, row, col, currentUpdateUI.turnIndex);
      state = nextMove.state;
    } catch (e) {
      log.info(["Cell is already full in position:", row, col]);
      return;
    }
    clickCount++;
    log.info("cellClicked - state.shownBoard", state.shownBoard);
    // Move is legal, make it!
    makeMove(nextMove);
  }

  export function isFlipped(row: number, col: number) : boolean {
    return state.shownBoard[row][col] != -1;
  }

  export function isShow(row: number, col: number): boolean {
    return true;  
    //return state.shownBoard[row][col] == -1;
  }

  export function isPlayer0(row: number, col: number): boolean {
    return state.shownBoard[row][col] == 0;
  }

  export function isPlayer1(row: number, col: number): boolean {
    return state.shownBoard[row][col] == 1;
  }

  export function shouldShowImage(row: number, col: number): boolean {
    return state.shownBoard[row][col] !== -1 || isProposal(row, col);
  }

  export function shouldSlowlyAppear(row: number, col: number): boolean {
    // log.info("shouldSlowlyAppear", row, col);
    return (state.delta1 && state.delta1.row === row && state.delta1.col === col) ||
      (state.delta2 && state.delta2.row === row && state.delta2.col === col);
  }

  export function shouldSlowlyDisappear(row: number, col: number): boolean {
    log.info("shouldSlowlyDisappear", disappear, row, col,
   ((disappear.row1 === row && disappear.col1 === col) || 
    (disappear.row2 === row && disappear.col2 === col)));
    let ret = neededDisappear && 
    ((disappear.row1 === row && disappear.col1 === col) || 
    (disappear.row2 === row && disappear.col2 === col)) &&
      clickCount === 0;
    if (ret === true) {
      log.info("shouldSlowlyDisappear:", row, col);
    }
    return ret;
    // return true;
  }

  export function setStatus(status: number) {
    log.info("setStatus", status)
    gameLogic.status = status;
  }

  export function getColor(row : number, col : number): string {
    let idx: number = state.board[row][col];
    return colors[idx];
  }

  export function getImage(row : number, col : number): string {
    let idx: number = state.board[row][col];
    return images[idx];
  }

  export function getPos(coord : number): string {
    if (coord == 0) {
        return "0";
    } else if (coord == 1) {
        return "8pt";
    } else {
        return "4pt";
    }
  }

  export function getStatus(): number {
    return gameLogic.status;
  }

  export function getRow(): number {
    return gameLogic.rows;
  }

  export function getCol(): number {
    return gameLogic.cols;
  }

  export function getHeight(): number {
    return 100.0 / getRow();
  }

  export function getWidth(): number {
    return 100.0 / getCol();
  }

  export function getRowArray(): number[] {
    return Array.apply(null, {length: getRow()}).map(Number.call, Number)
  }

  export function getColArray(): number[] {
    return Array.apply(null, {length: getCol()}).map(Number.call, Number)
  }

}

angular.module('myApp', ['gameServices'])
  .run(['$rootScope', '$timeout',
    function ($rootScope: angular.IScope, $timeout: angular.ITimeoutService) {
      $rootScope['game'] = game;
      game.init($rootScope, $timeout);
    }]);

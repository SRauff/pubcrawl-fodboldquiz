const STORAGE_KEY = "pubcrawlPlayerName";
const CONNECTION_ERROR_MESSAGE = "Der kunne ikke oprettes forbindelse. Prøv igen.";
const QUESTION_DURATION_MS = 10000;
const CLUE_DURATION_MS = 10000;
const GUESS_DURATION_MS = 25000;
const CLUES_PER_ROUND = 10;
const ANSWER_LETTERS = ["A", "B", "C", "D"];

// Alle justerbare formatgrænser er samlet her.
const FORMAT_CONFIG = {
  classic: {
    name: "Klassisk quiz",
    description: "Spørgsmål med fire svarmuligheder",
    prompt: "Hvor mange spørgsmål?",
    min: 5,
    max: 30,
    defaultCount: 10,
    singular: "spørgsmål",
    plural: "spørgsmål",
    badge: "Format 01",
  },
  whoAmI: {
    name: "Gæt hvem jeg er",
    description: "Gæt spilleren ud fra ledetråde",
    prompt: "Hvor mange runder?",
    min: 1,
    max: 15,
    defaultCount: 5,
    singular: "runde",
    plural: "runder",
    badge: "Format 02",
  },
};

const screens = {
  start: document.querySelector("#start-screen"),
  lobby: document.querySelector("#lobby-screen"),
  format: document.querySelector("#format-screen"),
  settings: document.querySelector("#settings-screen"),
  invite: document.querySelector("#invite-screen"),
  pregame: document.querySelector("#pregame-screen"),
  ready: document.querySelector("#ready-screen"),
  question: document.querySelector("#quiz-question-screen"),
  whoClue: document.querySelector("#who-clue-screen"),
  reveal: document.querySelector("#quiz-reveal-screen"),
  standings: document.querySelector("#quiz-standings-screen"),
  finished: document.querySelector("#quiz-finished-screen"),
};

const playerForm = document.querySelector("#player-form");
const playerNameInput = document.querySelector("#player-name");
const nameError = document.querySelector("#name-error");
const welcomeMessage = document.querySelector("#welcome-message");
const playersList = document.querySelector("#players-list");
const playerCount = document.querySelector("#player-count");
const backButton = document.querySelector("#back-button");
const lobbyButton = document.querySelector("#lobby-button");
const lobbyButtonLabel = document.querySelector("#lobby-button-label");
const createGameButton = document.querySelector("#create-game-button");
const startConnectionMessage = document.querySelector("#start-connection-message");
const lobbyConnectionMessage = document.querySelector("#lobby-connection-message");
const lobbyActionMessage = document.querySelector("#lobby-action-message");

const formatBackButton = document.querySelector("#format-back-button");
const formatButtons = document.querySelectorAll("[data-format]");
const settingsBackButton = document.querySelector("#settings-back-button");
const settingsFormatDescription = document.querySelector("#settings-format-description");
const gameCountLabel = document.querySelector("#game-count-label");
const gameCountSelect = document.querySelector("#game-count");
const gameCountHelp = document.querySelector("#game-count-help");
const continueToInvitesButton = document.querySelector("#continue-to-invites-button");

const inviteBackButton = document.querySelector("#invite-back-button");
const invitePlayerList = document.querySelector("#invite-player-list");
const invitePlayerCount = document.querySelector("#invite-player-count");
const inviteError = document.querySelector("#invite-error");
const sendInvitationsButton = document.querySelector("#send-invitations-button");

const pregameSummary = document.querySelector("#pregame-summary");
const pregamePlayerList = document.querySelector("#pregame-player-list");
const pregamePlayerCount = document.querySelector("#pregame-player-count");
const pregameMessage = document.querySelector("#pregame-message");
const hostActions = document.querySelector("#host-actions");
const guestWaitingMessage = document.querySelector("#guest-waiting-message");
const startGameButton = document.querySelector("#start-game-button");
const cancelGameButton = document.querySelector("#cancel-game-button");

const readySummary = document.querySelector("#ready-summary");
const readyPlayerList = document.querySelector("#ready-player-list");

const quizProgress = document.querySelector("#quiz-progress");
const quizCategory = document.querySelector("#quiz-category");
const quizQuestionTitle = document.querySelector("#quiz-question-title");
const quizTimerText = document.querySelector("#quiz-timer-text");
const quizTimerBar = document.querySelector("#quiz-timer-bar");
const quizAnswerOptions = document.querySelector("#quiz-answer-options");
const quizAnswerStatus = document.querySelector("#quiz-answer-status");
const whoRoundProgress = document.querySelector("#who-round-progress");
const whoClueProgress = document.querySelector("#who-clue-progress");
const whoClueTitle = document.querySelector("#who-clue-title");
const whoLivesValue = document.querySelector("#who-lives-value");
const whoTimerLabel = document.querySelector("#who-timer-label");
const whoTimerText = document.querySelector("#who-timer-text");
const whoTimerBar = document.querySelector("#who-timer-bar");
const lastPlayerPanel = document.querySelector("#last-player-panel");
const lastPlayerTitle = document.querySelector("#last-player-title");
const lastPlayerDescription = document.querySelector("#last-player-description");
const openGuessButton = document.querySelector("#open-guess-button");
const guessForm = document.querySelector("#guess-form");
const playerGuessInput = document.querySelector("#player-guess");
const submitGuessButton = document.querySelector("#submit-guess-button");
const whoGuessStatus = document.querySelector("#who-guess-status");
const quizResultPanel = document.querySelector("#quiz-result-panel");
const quizEarnedPoints = document.querySelector("#quiz-earned-points");
const quizRevealMessage = document.querySelector("#quiz-reveal-message");
const showStandingsButton = document.querySelector("#show-standings-button");
const revealWaitingMessage = document.querySelector("#reveal-waiting-message");
const quizStandingsList = document.querySelector("#quiz-standings-list");
const standingsContext = document.querySelector("#standings-context");
const quizStandingsMessage = document.querySelector("#quiz-standings-message");
const nextQuestionButton = document.querySelector("#next-question-button");
const standingsWaitingMessage = document.querySelector("#standings-waiting-message");
const quizWinnerMessage = document.querySelector("#quiz-winner-message");
const quizFinalList = document.querySelector("#quiz-final-list");
const returnToLobbyButton = document.querySelector("#return-to-lobby-button");

const invitationModal = document.querySelector("#invitation-modal");
const invitationTitle = document.querySelector("#invitation-title");
const invitationDetails = document.querySelector("#invitation-details");
const invitationError = document.querySelector("#invitation-error");
const declineInvitationButton = document.querySelector("#decline-invitation-button");
const acceptInvitationButton = document.querySelector("#accept-invitation-button");

let firebaseService;
let firebaseUser;
let currentScreen = "start";
let currentPlayerName = "";
let lobbyPlayers = [];
let selectedPlayerUids = new Set();
let gameDraft = { format: null, count: null };
let currentInvitation = null;
let activeGame = null;
let activeGameId = null;
let presenceController;
let stopPlayersListener;
let stopInvitationsListener;
let stopGameListener;
let isJoiningLobby = false;
let isCancelingGame = false;
let questions = [];
let questionsById = new Map();
let whoAmIPlayers = [];
let whoAmIPlayersById = new Map();
let serverTimeOffset = 0;
let questionTimerId;
let renderedQuizStateKey = "";
let isSubmittingAnswer = false;
let isSubmittingGuess = false;
let hostTransitionKey = "";

const questionsReady = fetch("data/questions.json")
  .then((response) => {
    if (!response.ok) {
      throw new Error("Testspørgsmålene kunne ikke indlæses.");
    }

    return response.json();
  })
  .then((loadedQuestions) => {
    if (!Array.isArray(loadedQuestions) || loadedQuestions.length === 0) {
      throw new Error("Spørgsmålspoolen er tom.");
    }

    loadedQuestions.forEach((question) => {
      if (
        !question?.id
        || typeof question.question !== "string"
        || !Array.isArray(question.options)
        || question.options.length !== 4
        || !Number.isInteger(question.correctAnswerIndex)
        || question.correctAnswerIndex < 0
        || question.correctAnswerIndex > 3
      ) {
        throw new Error(`Ugyldigt testspørgsmål: ${question?.id || "ukendt ID"}`);
      }
    });

    questions = loadedQuestions;
    questionsById = new Map(loadedQuestions.map((question) => [question.id, question]));
    return loadedQuestions;
  });

const whoAmIReady = fetch("data/who-am-i.json")
  .then((response) => {
    if (!response.ok) {
      throw new Error("Spillerpoolen kunne ikke indlæses.");
    }

    return response.json();
  })
  .then((loadedPlayers) => {
    if (!Array.isArray(loadedPlayers) || loadedPlayers.length === 0) {
      throw new Error("Spillerpoolen er tom.");
    }

    const ids = new Set();
    loadedPlayers.forEach((player) => {
      if (
        !player?.id
        || ids.has(player.id)
        || typeof player.player !== "string"
        || !Array.isArray(player.aliases)
        || player.aliases.length === 0
        || !Array.isArray(player.clues)
        || player.clues.length !== CLUES_PER_ROUND
        || player.clues.some((clue) => typeof clue !== "string" || !clue.trim())
      ) {
        throw new Error(`Ugyldig testspiller: ${player?.id || "ukendt ID"}`);
      }

      ids.add(player.id);
    });

    whoAmIPlayers = loadedPlayers;
    whoAmIPlayersById = new Map(loadedPlayers.map((player) => [player.id, player]));
    return loadedPlayers;
  });

function showConnectionError(error, target = startConnectionMessage) {
  console.error("Firebase-fejl:", error);
  target.textContent = CONNECTION_ERROR_MESSAGE;
  target.classList.add("connection-message--error");
}

function clearMessage(target) {
  target.textContent = "";
  target.classList.remove("connection-message--error");
}

function showScreen(screenName) {
  Object.entries(screens).forEach(([name, screen]) => {
    screen.hidden = name !== screenName;
  });

  currentScreen = screenName;
  window.scrollTo({ top: 0, behavior: "auto" });
}

function setButtonBusy(button, isBusy, busyText) {
  const label = button.querySelector("span") || button;

  if (!button.dataset.defaultLabel) {
    button.dataset.defaultLabel = label.textContent;
  }

  button.disabled = isBusy;
  label.textContent = isBusy ? busyText : button.dataset.defaultLabel;
}

const firebaseReady = import("./firebase.js")
  .then(async (service) => {
    firebaseService = service;
    firebaseUser = await service.ensureAnonymousUser();
    service.subscribeToServerTimeOffset(
      (offset) => {
        serverTimeOffset = offset;
      },
      (error) => console.error("Kunne ikke hente Firebase-servertid:", error),
    );
    return service;
  })
  .catch((error) => {
    showConnectionError(error);
    return null;
  });

function clearNameError() {
  nameError.textContent = "";
  playerNameInput.removeAttribute("aria-invalid");
}

function setJoiningState(isJoining) {
  isJoiningLobby = isJoining;
  lobbyButton.disabled = isJoining;
  playerNameInput.disabled = isJoining;
  lobbyButtonLabel.textContent = isJoining ? "Forbinder…" : "Gå til lobby";
}

function createLobbyPlayerRow(player) {
  const row = document.createElement("div");
  const avatar = document.createElement("span");
  const name = document.createElement("span");
  const status = document.createElement("span");
  const statusDot = document.createElement("span");

  row.className = "player-row";
  avatar.className = "player-avatar";
  avatar.setAttribute("aria-hidden", "true");
  avatar.textContent = player.name.charAt(0).toLocaleUpperCase("da-DK");
  name.className = "player-name";
  name.textContent = player.name;
  status.className = "status-dot";
  statusDot.setAttribute("aria-hidden", "true");
  status.append(statusDot, document.createTextNode(player.uid === firebaseUser.uid ? " Dig" : " Online"));
  row.append(avatar, name, status);

  return row;
}

function renderLobbyPlayers(players) {
  playersList.replaceChildren();

  if (players.length === 0) {
    const emptyMessage = document.createElement("p");
    emptyMessage.className = "players-loading";
    emptyMessage.textContent = "Ingen spillere er online endnu.";
    playersList.append(emptyMessage);
  } else {
    const fragment = document.createDocumentFragment();

    players.forEach((player) => fragment.append(createLobbyPlayerRow(player)));
    playersList.append(fragment);
  }

  playerCount.textContent = String(players.length);
  playerCount.setAttribute("aria-label", players.length === 1 ? "1 spiller" : `${players.length} spillere`);
}

function handleLobbyPlayers(players) {
  lobbyPlayers = players;
  renderLobbyPlayers(players);

  if (currentScreen === "invite") {
    renderInvitePlayers();
  }
}

function showLobby(message = "") {
  welcomeMessage.textContent = `Velkommen, ${currentPlayerName}`;
  clearMessage(lobbyConnectionMessage);
  lobbyActionMessage.textContent = message;
  showScreen("lobby");
  createGameButton.focus();
}

function startLobbyListeners() {
  stopPlayersListener?.();
  stopInvitationsListener?.();

  stopPlayersListener = firebaseService.subscribeToLobbyPlayers(
    handleLobbyPlayers,
    (error) => showConnectionError(error, lobbyConnectionMessage),
  );

  stopInvitationsListener = firebaseService.subscribeToInvitations(
    firebaseUser.uid,
    handleInvitations,
    (error) => showConnectionError(error, lobbyConnectionMessage),
  );
}

async function enterLobby(playerName) {
  setJoiningState(true);
  clearMessage(startConnectionMessage);

  try {
    const service = await firebaseReady;

    if (!service || !firebaseUser) {
      throw new Error("Firebase Authentication er ikke tilgængelig.");
    }

    presenceController = await service.joinLobbyPresence(
      firebaseUser,
      playerName,
      (error) => showConnectionError(error, lobbyConnectionMessage),
    );

    currentPlayerName = playerName;
    localStorage.setItem(STORAGE_KEY, playerName);
    startLobbyListeners();
    showLobby();
  } catch (error) {
    showConnectionError(error);
  } finally {
    setJoiningState(false);
  }
}

async function leaveLobby() {
  backButton.disabled = true;
  clearMessage(lobbyConnectionMessage);

  try {
    await presenceController?.leave();
    presenceController = undefined;
    stopPlayersListener?.();
    stopPlayersListener = undefined;
    stopInvitationsListener?.();
    stopInvitationsListener = undefined;
    hideInvitation();
    showScreen("start");
    playerNameInput.focus();
  } catch (error) {
    showConnectionError(error, lobbyConnectionMessage);
  } finally {
    backButton.disabled = false;
  }
}

function openFormatSelection() {
  gameDraft = { format: null, count: null };
  selectedPlayerUids = new Set();
  clearMessage(lobbyActionMessage);
  showScreen("format");
}

function configureGameSettings(format) {
  const config = FORMAT_CONFIG[format];

  gameDraft = { format, count: config.defaultCount };
  settingsFormatDescription.textContent = `${config.name} · ${config.description}`;
  gameCountLabel.textContent = config.prompt;
  gameCountHelp.textContent = `Vælg mellem ${config.min} og ${config.max} ${config.plural}.`;
  gameCountSelect.replaceChildren();

  for (let count = config.min; count <= config.max; count += 1) {
    const option = document.createElement("option");
    const unit = count === 1 ? config.singular : config.plural;

    option.value = String(count);
    option.textContent = `${count} ${unit}`;
    option.selected = count === config.defaultCount;
    gameCountSelect.append(option);
  }

  showScreen("settings");
  gameCountSelect.focus();
}

function createInviteOption(player) {
  const label = document.createElement("label");
  const checkbox = document.createElement("input");
  const name = document.createElement("span");
  const status = document.createElement("span");

  label.className = "invite-option";
  checkbox.type = "checkbox";
  checkbox.value = player.uid;
  checkbox.checked = selectedPlayerUids.has(player.uid);
  name.className = "invite-option__name";
  name.textContent = player.name;
  status.className = "invite-option__status";
  status.textContent = "Online";

  checkbox.addEventListener("change", () => {
    if (checkbox.checked) {
      selectedPlayerUids.add(player.uid);
    } else {
      selectedPlayerUids.delete(player.uid);
    }

    inviteError.textContent = "";
  });

  label.append(checkbox, name, status);
  return label;
}

function renderInvitePlayers() {
  const availablePlayers = lobbyPlayers.filter((player) => player.uid !== firebaseUser.uid);
  const availableUids = new Set(availablePlayers.map((player) => player.uid));

  selectedPlayerUids = new Set([...selectedPlayerUids].filter((uid) => availableUids.has(uid)));
  invitePlayerList.replaceChildren();

  if (availablePlayers.length === 0) {
    const emptyMessage = document.createElement("p");
    emptyMessage.className = "players-loading";
    emptyMessage.textContent = "Der er ingen andre spillere online lige nu.";
    invitePlayerList.append(emptyMessage);
  } else {
    const fragment = document.createDocumentFragment();
    availablePlayers.forEach((player) => fragment.append(createInviteOption(player)));
    invitePlayerList.append(fragment);
  }

  invitePlayerCount.textContent = String(availablePlayers.length);
  invitePlayerCount.setAttribute(
    "aria-label",
    availablePlayers.length === 1 ? "1 spiller" : `${availablePlayers.length} spillere`,
  );
  sendInvitationsButton.disabled = availablePlayers.length === 0;
}

function openInviteSelection() {
  gameDraft.count = Number(gameCountSelect.value);
  selectedPlayerUids = new Set();
  inviteError.textContent = "";
  renderInvitePlayers();
  showScreen("invite");
}

function getSelectedPlayers() {
  return lobbyPlayers.filter((player) => selectedPlayerUids.has(player.uid));
}

async function sendInvitations() {
  const invitedPlayers = getSelectedPlayers();

  if (invitedPlayers.length === 0) {
    inviteError.textContent = "Vælg mindst én spiller, før du sender invitationer.";
    return;
  }

  inviteError.textContent = "";
  setButtonBusy(sendInvitationsButton, true, "Sender…");

  try {
    const { gameId } = await firebaseService.createGame(
      firebaseUser,
      currentPlayerName,
      gameDraft,
      invitedPlayers,
    );

    openActiveGame(gameId);
  } catch (error) {
    console.error("Kunne ikke oprette spil:", error);
    inviteError.textContent = "Spillet kunne ikke oprettes. Prøv igen.";
  } finally {
    setButtonBusy(sendInvitationsButton, false, "Sender…");
  }
}

function formatSetting(game) {
  const config = FORMAT_CONFIG[game.format];

  if (!config) {
    return "Ukendt format";
  }

  const count = game.format === "classic" ? game.questionCount : game.roundCount;
  const unit = count === 1 ? config.singular : config.plural;

  return `${count} ${unit}`;
}

function renderGameSummary(container, game) {
  const config = FORMAT_CONFIG[game.format];
  const text = document.createElement("div");
  const formatName = document.createElement("strong");
  const setting = document.createElement("span");
  const badge = document.createElement("span");

  formatName.textContent = config?.name || "Fodboldquiz";
  setting.textContent = formatSetting(game);
  badge.className = "game-summary__badge";
  badge.textContent = config?.badge || "Quiz night";
  text.append(formatName, setting);
  container.replaceChildren(text, badge);
}

function createGamePlayerRow(name, status, statusClass = "") {
  const row = document.createElement("div");
  const playerName = document.createElement("span");
  const playerStatus = document.createElement("span");

  row.className = "game-player-row";
  playerName.className = "game-player-row__name";
  playerName.textContent = name;
  playerStatus.className = `game-player-row__status ${statusClass}`.trim();
  playerStatus.textContent = status;
  row.append(playerName, playerStatus);

  return row;
}

function renderPregame(game) {
  window.clearInterval(questionTimerId);
  questionTimerId = undefined;
  const invitedPlayers = Object.values(game.invitedPlayers || {});
  const acceptedPlayers = invitedPlayers.filter((player) => player.status === "accepted");
  const isHost = game.hostUid === firebaseUser.uid;

  renderGameSummary(pregameSummary, game);
  pregamePlayerList.replaceChildren();
  pregamePlayerList.append(createGamePlayerRow(game.hostName, "Host"));

  invitedPlayers.forEach((player) => {
    const statusConfig = {
      accepted: ["Klar ✓", "game-player-row__status--accepted"],
      declined: ["Afvist", "game-player-row__status--declined"],
      pending: ["Afventer…", ""],
    }[player.status] || ["Afventer…", ""];

    pregamePlayerList.append(createGamePlayerRow(player.name, statusConfig[0], statusConfig[1]));
  });

  pregamePlayerCount.textContent = String(invitedPlayers.length + 1);
  hostActions.hidden = !isHost;
  guestWaitingMessage.hidden = isHost;
  startGameButton.disabled = !isHost || acceptedPlayers.length === 0;
  pregameMessage.textContent = isHost && acceptedPlayers.length === 0
    ? "Mindst én inviteret spiller skal acceptere, før spillet kan startes."
    : "";

  if (currentScreen !== "pregame") {
    showScreen("pregame");
  }
}

function renderReady(game) {
  renderGameSummary(readySummary, game);
  readyPlayerList.replaceChildren();
  readyPlayerList.append(createGamePlayerRow(game.hostName, "Host"));

  Object.values(game.invitedPlayers || {})
    .filter((player) => player.status === "accepted")
    .forEach((player) => {
      readyPlayerList.append(
        createGamePlayerRow(player.name, "Klar ✓", "game-player-row__status--accepted"),
      );
    });

  showScreen("ready");
}

function getSelectedQuestionIds(game) {
  if (Array.isArray(game.selectedQuestionIds)) {
    return game.selectedQuestionIds;
  }

  return Object.entries(game.selectedQuestionIds || {})
    .sort(([firstIndex], [secondIndex]) => Number(firstIndex) - Number(secondIndex))
    .map(([, questionId]) => questionId);
}

function getQuestionAnswers(game, questionIndex = game.currentQuestionIndex) {
  return game.answers?.[questionIndex] || {};
}

function getQuestionResult(game, questionIndex = game.currentQuestionIndex) {
  return game.questionResults?.[questionIndex] || null;
}

function getServerNow() {
  return Date.now() + serverTimeOffset;
}

function getRemainingQuestionTime(game) {
  const startedAt = Number(game.questionStartedAt);

  if (!startedAt) {
    return QUESTION_DURATION_MS;
  }

  return Math.max(0, startedAt + QUESTION_DURATION_MS - getServerNow());
}

function selectRandomQuestionIds(pool, requestedCount) {
  const shuffledIds = pool.map((question) => question.id);

  for (let index = shuffledIds.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffledIds[index], shuffledIds[randomIndex]] = [shuffledIds[randomIndex], shuffledIds[index]];
  }

  return shuffledIds.slice(0, Math.min(requestedCount, shuffledIds.length));
}

function getSelectedPlayerIds(game) {
  if (Array.isArray(game.selectedPlayerIds)) {
    return game.selectedPlayerIds;
  }

  return Object.entries(game.selectedPlayerIds || {})
    .sort(([firstIndex], [secondIndex]) => Number(firstIndex) - Number(secondIndex))
    .map(([, playerId]) => playerId);
}

function selectRandomPlayerIds(pool, requestedCount) {
  const shuffledIds = pool.map((player) => player.id);

  for (let index = shuffledIds.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffledIds[index], shuffledIds[randomIndex]] = [shuffledIds[randomIndex], shuffledIds[index]];
  }

  return shuffledIds.slice(0, Math.min(requestedCount, shuffledIds.length));
}

function getWhoAmIAttempt(game, uid = firebaseUser.uid) {
  return game.whoAmIAttempts?.[game.currentRoundIndex]?.[uid] || {
    remainingLives: 2,
    guessCount: 0,
  };
}

function getWhoAmIRoundClaim(game) {
  return game.roundClaims?.[game.currentRoundIndex] || null;
}

function getWhoAmIRoundResult(game) {
  return game.roundResults?.[game.currentRoundIndex] || null;
}

function getWhoAmIGuessControl(game) {
  return game.guessControl?.[game.currentRoundIndex] || null;
}

function normalizePlayerGuess(value) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("da-DK");
}

function isCorrectPlayerGuess(player, value) {
  const normalizedGuess = normalizePlayerGuess(value);
  const acceptedNames = [player.player, ...(player.aliases || [])]
    .map((name) => normalizePlayerGuess(name));

  return acceptedNames.includes(normalizedGuess);
}

function getWhoAmIPoints(clueIndex) {
  return (CLUES_PER_ROUND - clueIndex) * 100;
}

function getRemainingWhoAmITime(game) {
  const guessControl = getWhoAmIGuessControl(game);
  if (game.phase === "clue" && guessControl) {
    return Math.max(0, Number(guessControl.remainingClueMs) || 0);
  }

  const isLastChance = game.phase === "lastChance";
  const startedAt = Number(isLastChance ? game.lastChanceStartedAt : game.clueStartedAt);
  const durationMs = isLastChance ? GUESS_DURATION_MS : CLUE_DURATION_MS;

  if (!startedAt) {
    return durationMs;
  }

  return Math.max(0, startedAt + durationMs - getServerNow());
}

function getRemainingWhoAmIGuessTime(game) {
  const startedAt = Number(getWhoAmIGuessControl(game)?.startedAt);
  return startedAt
    ? Math.max(0, startedAt + GUESS_DURATION_MS - getServerNow())
    : 0;
}

function sortPlayersByScore(game) {
  return Object.entries(game.players || {})
    .map(([uid, player]) => ({
      uid,
      name: player.name,
      score: Number(game.scores?.[uid]) || 0,
    }))
    .sort((firstPlayer, secondPlayer) => (
      secondPlayer.score - firstPlayer.score
      || firstPlayer.name.localeCompare(secondPlayer.name, "da")
      || firstPlayer.uid.localeCompare(secondPlayer.uid)
    ));
}

function renderLeaderboard(container, game) {
  const players = sortPlayersByScore(game);
  const fragment = document.createDocumentFragment();
  let previousScore;
  let displayedRank = 0;

  players.forEach((player, index) => {
    if (player.score !== previousScore) {
      displayedRank = index + 1;
      previousScore = player.score;
    }

    const row = document.createElement("div");
    const rank = document.createElement("span");
    const name = document.createElement("span");
    const score = document.createElement("span");

    row.className = "leaderboard-row";
    if (player.uid === firebaseUser.uid) {
      row.classList.add("leaderboard-row--self");
    }
    rank.className = "leaderboard-rank";
    name.className = "leaderboard-name";
    score.className = "leaderboard-score";
    rank.textContent = String(displayedRank);
    name.textContent = player.uid === firebaseUser.uid ? `${player.name} · Dig` : player.name;
    score.textContent = `${player.score.toLocaleString("da-DK")} point`;
    row.append(rank, name, score);
    fragment.append(row);
  });

  container.replaceChildren(fragment);
  return players;
}

function createResultLine(label, value, stateClass = "") {
  const line = document.createElement("div");
  const labelElement = document.createElement("span");
  const valueElement = document.createElement("strong");

  line.className = `result-line ${stateClass}`.trim();
  labelElement.textContent = label;
  valueElement.textContent = value;
  line.append(labelElement, valueElement);
  return line;
}

function calculateQuestionOutcome(game, question) {
  const questionIndex = game.currentQuestionIndex;
  const answers = getQuestionAnswers(game, questionIndex);
  const deadline = Number(game.questionStartedAt) + QUESTION_DURATION_MS;
  const correctAnswers = Object.entries(answers)
    .filter(([uid, answer]) => (
      game.players?.[uid]
      && answer.optionIndex === question.correctAnswerIndex
      && Number(answer.answeredAt) <= deadline
    ))
    .sort(([firstUid, firstAnswer], [secondUid, secondAnswer]) => (
      Number(firstAnswer.answeredAt) - Number(secondAnswer.answeredAt)
      || firstUid.localeCompare(secondUid)
    ));

  const scores = { ...(game.scores || {}) };
  const awardedPoints = Object.fromEntries(Object.keys(game.players || {}).map((uid) => [uid, 0]));

  correctAnswers.forEach(([uid], index) => {
    const points = (correctAnswers.length - index) * 100;
    awardedPoints[uid] = points;
    scores[uid] = (Number(scores[uid]) || 0) + points;
  });

  return { scores, awardedPoints };
}

async function maybeFinalizeQuestion(game) {
  if (
    game.hostUid !== firebaseUser.uid
    || game.phase !== "question"
    || getQuestionResult(game)
  ) {
    return;
  }

  const playerUids = Object.keys(game.players || {});
  const answers = getQuestionAnswers(game);
  const everyoneAnswered = playerUids.length > 0 && playerUids.every((uid) => answers[uid]);
  const timeExpired = getRemainingQuestionTime(game) <= 0;

  if (!everyoneAnswered && !timeExpired) {
    return;
  }

  const transitionKey = `reveal:${game.currentQuestionIndex}`;
  if (hostTransitionKey === transitionKey) {
    return;
  }

  const questionId = getSelectedQuestionIds(game)[game.currentQuestionIndex];
  const question = questionsById.get(questionId);
  if (!question) {
    showConnectionError(new Error(`Spørgsmålet ${questionId} mangler.`), quizAnswerStatus);
    return;
  }

  hostTransitionKey = transitionKey;
  const { scores, awardedPoints } = calculateQuestionOutcome(game, question);

  try {
    await firebaseService.revealClassicQuestion(
      activeGameId,
      game.currentQuestionIndex,
      scores,
      awardedPoints,
      question.correctAnswerIndex,
    );
  } catch (error) {
    hostTransitionKey = "";
    showConnectionError(error, quizAnswerStatus);
  }
}

function updateQuestionTimer(game) {
  const remainingMs = getRemainingQuestionTime(game);
  const remainingSeconds = (remainingMs / 1000).toLocaleString("da-DK", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  const ratio = Math.max(0, Math.min(1, remainingMs / QUESTION_DURATION_MS));

  quizTimerText.textContent = `${remainingSeconds} sek.`;
  quizTimerBar.style.transform = `scaleX(${ratio})`;

  if (remainingMs <= 0) {
    quizAnswerOptions.querySelectorAll("button").forEach((button) => {
      button.disabled = true;
    });

    if (!getQuestionAnswers(game)[firebaseUser.uid]) {
      quizAnswerStatus.textContent = "Tiden er gået.";
    }

    maybeFinalizeQuestion(game);
  }
}

function startQuestionTimer(game) {
  window.clearInterval(questionTimerId);
  updateQuestionTimer(game);
  questionTimerId = window.setInterval(() => {
    if (activeGame?.phase !== "question" || activeGame.currentQuestionIndex !== game.currentQuestionIndex) {
      window.clearInterval(questionTimerId);
      questionTimerId = undefined;
      return;
    }

    updateQuestionTimer(activeGame);
  }, 100);
}

function updateAnswerButtons(game) {
  const ownAnswer = getQuestionAnswers(game)[firebaseUser.uid];
  const timeExpired = getRemainingQuestionTime(game) <= 0;

  quizAnswerOptions.querySelectorAll("button").forEach((button) => {
    const isSelected = Number(button.dataset.optionIndex) === ownAnswer?.optionIndex;
    button.disabled = Boolean(ownAnswer) || isSubmittingAnswer || timeExpired;
    button.classList.toggle("answer-option--selected", isSelected);
  });

  if (ownAnswer) {
    quizAnswerStatus.textContent = "Svar registreret ✓";
  }
}

async function submitQuizAnswer(optionIndex) {
  if (
    isSubmittingAnswer
    || activeGame?.phase !== "question"
    || getQuestionAnswers(activeGame)[firebaseUser.uid]
    || getRemainingQuestionTime(activeGame) <= 0
  ) {
    return;
  }

  isSubmittingAnswer = true;
  quizAnswerStatus.textContent = "Registrerer svar…";
  updateAnswerButtons(activeGame);

  try {
    await firebaseService.submitClassicAnswer(
      activeGameId,
      activeGame.currentQuestionIndex,
      firebaseUser.uid,
      optionIndex,
    );
  } catch (error) {
    isSubmittingAnswer = false;
    showConnectionError(error, quizAnswerStatus);
    updateAnswerButtons(activeGame);
  }
}

function renderQuestionPhase(game, question, selectedQuestionIds) {
  const stateKey = `${game.id}:question:${game.currentQuestionIndex}:${game.questionStartedAt}`;

  if (renderedQuizStateKey !== stateKey) {
    renderedQuizStateKey = stateKey;
    hostTransitionKey = "";
    isSubmittingAnswer = false;
    quizProgress.textContent = `Spørgsmål ${game.currentQuestionIndex + 1} / ${selectedQuestionIds.length}`;
    quizCategory.textContent = question.league;
    quizQuestionTitle.textContent = question.question;
    quizAnswerStatus.textContent = "";
    quizAnswerOptions.replaceChildren();

    question.options.forEach((option, optionIndex) => {
      const button = document.createElement("button");
      const letter = document.createElement("span");
      const text = document.createElement("span");

      button.type = "button";
      button.className = "answer-option";
      button.dataset.optionIndex = String(optionIndex);
      letter.className = "answer-option__letter";
      letter.setAttribute("aria-hidden", "true");
      letter.textContent = ANSWER_LETTERS[optionIndex];
      text.textContent = option;
      button.append(letter, text);
      button.addEventListener("click", () => submitQuizAnswer(optionIndex));
      quizAnswerOptions.append(button);
    });

    showScreen("question");
    startQuestionTimer(game);
  }

  updateAnswerButtons(game);
  maybeFinalizeQuestion(game);
}

function renderRevealPhase(game, question) {
  const stateKey = `${game.id}:reveal:${game.currentQuestionIndex}`;
  if (renderedQuizStateKey === stateKey) {
    return;
  }

  renderedQuizStateKey = stateKey;
  window.clearInterval(questionTimerId);
  questionTimerId = undefined;
  const ownAnswer = getQuestionAnswers(game)[firebaseUser.uid];
  const ownAnswerText = ownAnswer ? question.options[ownAnswer.optionIndex] : "Du nåede ikke at svare";
  const wasCorrect = ownAnswer?.optionIndex === question.correctAnswerIndex;
  const points = Number(getQuestionResult(game)?.awardedPoints?.[firebaseUser.uid]) || 0;

  quizResultPanel.replaceChildren(
    createResultLine("Rigtigt svar", `${question.options[question.correctAnswerIndex]} ✓`, "result-line--correct"),
    createResultLine(
      "Dit svar",
      ownAnswer ? `${ownAnswerText} ${wasCorrect ? "✓" : "✕"}` : ownAnswerText,
      wasCorrect ? "result-line--correct" : "result-line--wrong",
    ),
  );
  quizEarnedPoints.textContent = wasCorrect ? `+${points.toLocaleString("da-DK")} point` : "0 point";
  clearMessage(quizRevealMessage);
  const isHost = game.hostUid === firebaseUser.uid;
  showStandingsButton.disabled = false;
  showStandingsButton.hidden = !isHost;
  revealWaitingMessage.hidden = isHost;
  showScreen("reveal");
}

async function finalizeWhoAmIRound(game, result) {
  if (getWhoAmIRoundResult(game)) {
    return;
  }

  const scores = { ...(game.scores || {}) };
  if (result.winnerUid) {
    scores[result.winnerUid] = (Number(scores[result.winnerUid]) || 0) + result.points;
  }

  await firebaseService.finalizeWhoAmIRound(
    activeGameId,
    game.currentRoundIndex,
    scores,
    result,
  );
}

async function runWhoAmIHostTransition(key, action) {
  if (hostTransitionKey === key) {
    return;
  }

  hostTransitionKey = key;
  try {
    await action();
  } catch (error) {
    hostTransitionKey = "";
    showConnectionError(error, whoGuessStatus);
  }
}

async function maybeProgressWhoAmIRound(game, player) {
  if (
    game.hostUid !== firebaseUser.uid
    || game.status !== "started"
    || getWhoAmIRoundResult(game)
  ) {
    return;
  }

  const claim = getWhoAmIRoundClaim(game);
  if (claim) {
    const transitionKey = `who-reveal:${game.currentRoundIndex}:${claim.uid}`;
    await runWhoAmIHostTransition(transitionKey, () => finalizeWhoAmIRound(game, {
      playerId: player.id,
      reason: claim.mode === "lastChance" ? "lastChanceCorrect" : "correct",
      winnerUid: claim.uid,
      winningClueIndex: Number(claim.clueIndex),
      points: getWhoAmIPoints(Number(claim.clueIndex)),
    }));
    return;
  }

  const guessControl = getWhoAmIGuessControl(game);
  if (game.phase === "clue" && guessControl) {
    const guessTimedOut = guessControl.state === "active" && getRemainingWhoAmIGuessTime(game) <= 0;
    if (guessControl.state === "wrong" || guessTimedOut) {
      const reason = guessControl.state === "wrong" ? "wrong" : "timeout";
      const transitionKey = `who-guess-${reason}:${game.currentRoundIndex}:${guessControl.uid}:${guessControl.startedAt}`;
      await runWhoAmIHostTransition(
        transitionKey,
        () => firebaseService.resolveFailedWhoAmIGuess(
          activeGameId,
          game,
          { uid: guessControl.uid, reason },
          getServerNow(),
        ),
      );
    }
    return;
  }

  if (game.phase === "clue") {
    const activePlayerUids = Object.keys(game.players || {}).filter((uid) => (
      Number(getWhoAmIAttempt(game, uid).remainingLives) > 0
    ));

    if (activePlayerUids.length === 1 && Object.keys(game.players || {}).length > 1) {
      const lastUid = activePlayerUids[0];
      const transitionKey = `who-last:${game.currentRoundIndex}:${game.currentClueIndex}:${lastUid}`;
      await runWhoAmIHostTransition(
        transitionKey,
        () => firebaseService.beginWhoAmILastChance(activeGameId, lastUid),
      );
      return;
    }

    if (activePlayerUids.length === 0) {
      const transitionKey = `who-no-lives:${game.currentRoundIndex}`;
      await runWhoAmIHostTransition(transitionKey, () => finalizeWhoAmIRound(game, {
        playerId: player.id,
        reason: "noWinner",
        points: 0,
      }));
      return;
    }

    if (getRemainingWhoAmITime(game) <= 0) {
      if (game.currentClueIndex < CLUES_PER_ROUND - 1) {
        const nextClueIndex = game.currentClueIndex + 1;
        const transitionKey = `who-clue:${game.currentRoundIndex}:${nextClueIndex}`;
        await runWhoAmIHostTransition(
          transitionKey,
          () => firebaseService.advanceWhoAmIClue(activeGameId, nextClueIndex),
        );
      } else {
        const transitionKey = `who-empty:${game.currentRoundIndex}`;
        await runWhoAmIHostTransition(transitionKey, () => finalizeWhoAmIRound(game, {
          playerId: player.id,
          reason: "noWinner",
          points: 0,
        }));
      }
    }
    return;
  }

  if (game.phase === "lastChance") {
    const lastAttempt = getWhoAmIAttempt(game, game.lastPlayerStandingUid);
    if (lastAttempt.lastChanceUsed) {
      const transitionKey = `who-last-wrong:${game.currentRoundIndex}`;
      await runWhoAmIHostTransition(transitionKey, () => finalizeWhoAmIRound(game, {
        playerId: player.id,
        reason: "lastChanceWrong",
        lastPlayerUid: game.lastPlayerStandingUid,
        points: 0,
      }));
    } else if (getRemainingWhoAmITime(game) <= 0) {
      const transitionKey = `who-last-timeout:${game.currentRoundIndex}`;
      await runWhoAmIHostTransition(transitionKey, () => finalizeWhoAmIRound(game, {
        playerId: player.id,
        reason: "lastChanceTimeout",
        lastPlayerUid: game.lastPlayerStandingUid,
        points: 0,
      }));
    }
  }
}

function updateWhoAmITimer(game, player) {
  const guessControl = getWhoAmIGuessControl(game);
  const isGuessing = game.phase === "clue" && Boolean(guessControl);
  const remainingMs = isGuessing
    ? getRemainingWhoAmIGuessTime(game)
    : getRemainingWhoAmITime(game);
  const remainingSeconds = (remainingMs / 1000).toLocaleString("da-DK", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  const durationMs = isGuessing || game.phase === "lastChance"
    ? GUESS_DURATION_MS
    : CLUE_DURATION_MS;
  const ratio = Math.max(0, Math.min(1, remainingMs / durationMs));

  whoTimerText.textContent = `${remainingSeconds} sek.`;
  whoTimerBar.style.transform = `scaleX(${ratio})`;

  if (remainingMs <= 0 || getWhoAmIRoundClaim(game)) {
    openGuessButton.disabled = true;
    playerGuessInput.disabled = true;
    submitGuessButton.disabled = true;
    maybeProgressWhoAmIRound(game, player);
  }
}

function startWhoAmITimer(game, player) {
  window.clearInterval(questionTimerId);
  updateWhoAmITimer(game, player);
  questionTimerId = window.setInterval(() => {
    if (
      !activeGame
      || !["clue", "lastChance"].includes(activeGame.phase)
      || activeGame.currentRoundIndex !== game.currentRoundIndex
      || activeGame.currentClueIndex !== game.currentClueIndex
    ) {
      window.clearInterval(questionTimerId);
      questionTimerId = undefined;
      return;
    }

    updateWhoAmITimer(activeGame, player);
  }, 100);
}

function renderWhoAmICluePhase(game, player, selectedPlayerIds) {
  const attempt = getWhoAmIAttempt(game);
  const claim = getWhoAmIRoundClaim(game);
  const guessControl = getWhoAmIGuessControl(game);
  const stateKey = [
    game.id,
    "who",
    game.phase,
    game.currentRoundIndex,
    game.currentClueIndex,
    game.clueStartedAt,
    game.lastChanceStartedAt,
    guessControl?.state || "",
    guessControl?.uid || "",
    guessControl?.startedAt || "",
    attempt.remainingLives,
    attempt.guessCount,
    claim?.uid || "",
  ].join(":");

  if (renderedQuizStateKey !== stateKey) {
    renderedQuizStateKey = stateKey;
    hostTransitionKey = "";
    isSubmittingGuess = false;
    const isLastChance = game.phase === "lastChance";
    const isLastPlayer = game.lastPlayerStandingUid === firebaseUser.uid;
    const isActiveGuesser = guessControl?.uid === firebaseUser.uid;
    const remainingLives = Number(attempt.remainingLives) || 0;

    whoRoundProgress.textContent = `Gæt hvem jeg er · Runde ${game.currentRoundIndex + 1} / ${selectedPlayerIds.length}`;
    whoClueProgress.textContent = `Ledetråd ${game.currentClueIndex + 1} / ${CLUES_PER_ROUND}`;
    whoClueTitle.textContent = player.clues[game.currentClueIndex];
    whoLivesValue.textContent = remainingLives > 0
      ? Array.from({ length: remainingLives }, () => "❤️").join(" ")
      : "Ingen liv tilbage";
    whoTimerLabel.textContent = guessControl
      ? "Tid til at afgive gættet"
      : isLastChance ? "Tid til sidste gæt" : "Tid til næste ledetråd";
    lastPlayerPanel.hidden = !isLastChance;
    guessForm.hidden = true;
    playerGuessInput.value = "";
    playerGuessInput.disabled = false;
    submitGuessButton.disabled = false;
    whoGuessStatus.textContent = "";
    openGuessButton.querySelector("span").textContent = "Gæt spilleren";

    if (claim) {
      openGuessButton.hidden = false;
      openGuessButton.disabled = true;
      whoGuessStatus.textContent = "Runden afgøres…";
    } else if (guessControl && isActiveGuesser && guessControl.state === "active") {
      openGuessButton.hidden = true;
      guessForm.hidden = false;
      submitGuessButton.querySelector("span").textContent = "Send gæt";
      whoGuessStatus.textContent = "Ledetråden er sat på pause, mens du gætter.";
      playerGuessInput.focus();
    } else if (guessControl) {
      const guesserName = guessControl.name || game.players?.[guessControl.uid]?.name || "En spiller";
      openGuessButton.hidden = true;
      playerGuessInput.disabled = true;
      submitGuessButton.disabled = true;
      whoGuessStatus.textContent = guessControl.state === "wrong"
        ? "Gættet afgøres…"
        : `${guesserName} forsøger sig med et gæt… Vent venligst.`;
    } else if (isLastChance && isLastPlayer && attempt.lastChanceUsed) {
      lastPlayerTitle.textContent = "Dit sidste gæt er registreret.";
      lastPlayerDescription.textContent = "Runden afgøres nu.";
      openGuessButton.hidden = true;
      whoGuessStatus.textContent = "Venter på runderesultatet…";
    } else if (isLastChance && isLastPlayer) {
      lastPlayerTitle.textContent = "Du er den sidste spiller tilbage!";
      lastPlayerDescription.textContent = "Kan du gætte spilleren? Du har præcis ét sidste forsøg.";
      openGuessButton.hidden = true;
      guessForm.hidden = false;
      submitGuessButton.querySelector("span").textContent = "Afgiv dit sidste gæt";
      playerGuessInput.focus();
    } else if (isLastChance) {
      const lastPlayerName = game.players?.[game.lastPlayerStandingUid]?.name || "En spiller";
      lastPlayerTitle.textContent = `${lastPlayerName} er den sidste spiller tilbage.`;
      lastPlayerDescription.textContent = "Spilleren får ét sidste forsøg på at gætte spilleren…";
      openGuessButton.hidden = true;
      whoGuessStatus.textContent = "Venter på det sidste gæt…";
    } else if (remainingLives <= 0) {
      openGuessButton.hidden = false;
      openGuessButton.disabled = true;
      whoGuessStatus.textContent = "Du har ingen liv tilbage, men kan følge resten af runden.";
    } else {
      openGuessButton.hidden = false;
      openGuessButton.disabled = false;
      submitGuessButton.querySelector("span").textContent = "Send gæt";
      const guesses = Object.values(attempt.guesses || {});
      if (guesses.length > 0) {
        whoGuessStatus.textContent = `Forkert gæt · ${remainingLives} ${remainingLives === 1 ? "liv" : "liv"} tilbage`;
      }
    }

    showScreen("whoClue");
    startWhoAmITimer(game, player);
  }

  maybeProgressWhoAmIRound(game, player);
}

async function submitWhoAmIGuess(event) {
  event.preventDefault();
  if (isSubmittingGuess || !activeGame || !["clue", "lastChance"].includes(activeGame.phase)) {
    return;
  }

  const guess = playerGuessInput.value.trim();
  if (!guess) {
    whoGuessStatus.textContent = "Skriv et spillernavn, før du sender dit gæt.";
    return;
  }

  const selectedPlayerIds = getSelectedPlayerIds(activeGame);
  const player = whoAmIPlayersById.get(selectedPlayerIds[activeGame.currentRoundIndex]);
  const attempt = getWhoAmIAttempt(activeGame);
  const guessControl = getWhoAmIGuessControl(activeGame);
  const mode = activeGame.phase === "lastChance" ? "lastChance" : "normal";
  const canGuess = mode === "lastChance"
    ? activeGame.lastPlayerStandingUid === firebaseUser.uid && !attempt.lastChanceUsed
    : guessControl?.state === "active"
      && guessControl.uid === firebaseUser.uid
      && getRemainingWhoAmIGuessTime(activeGame) > 0;

  if (
    !player
    || !canGuess
    || getWhoAmIRoundClaim(activeGame)
    || (mode === "lastChance" && getRemainingWhoAmITime(activeGame) <= 0)
  ) {
    whoGuessStatus.textContent = "Det er ikke længere muligt at gætte i denne runde.";
    return;
  }

  isSubmittingGuess = true;
  playerGuessInput.disabled = true;
  submitGuessButton.disabled = true;
  whoGuessStatus.textContent = "Registrerer gæt…";
  const guessedAt = getServerNow();

  try {
    if (isCorrectPlayerGuess(player, guess)) {
      const committed = await firebaseService.claimWhoAmIRound(
        activeGameId,
        activeGame.currentRoundIndex,
        {
          uid: firebaseUser.uid,
          guess,
          guessedAt,
          clueIndex: activeGame.currentClueIndex,
          mode,
          points: getWhoAmIPoints(activeGame.currentClueIndex),
        },
      );

      whoGuessStatus.textContent = committed
        ? "Korrekt! Runden afgøres…"
        : "En anden spiller nåede først.";
    } else {
      const committed = mode === "lastChance"
        ? await firebaseService.submitWrongWhoAmIGuess(
          activeGameId,
          activeGame.currentRoundIndex,
          firebaseUser.uid,
          { guess, guessedAt, correct: false, mode },
        )
        : await firebaseService.markWhoAmIGuessWrong(
          activeGameId,
          activeGame.currentRoundIndex,
          firebaseUser.uid,
          guess,
          guessedAt,
        );

      whoGuessStatus.textContent = committed
        ? "Forkert gæt"
        : "Gættet kunne ikke registreres.";
    }
  } catch (error) {
    showConnectionError(error, whoGuessStatus);
  } finally {
    isSubmittingGuess = false;
    const currentGuessControl = activeGame && getWhoAmIGuessControl(activeGame);
    if (
      activeGame?.phase === "lastChance"
      || (activeGame?.phase === "clue" && currentGuessControl?.uid === firebaseUser.uid)
    ) {
      playerGuessInput.disabled = false;
      submitGuessButton.disabled = false;
    }
  }
}

async function claimWhoAmIGuess() {
  if (!activeGame || activeGame.phase !== "clue" || getWhoAmIGuessControl(activeGame)) {
    return;
  }

  const attempt = getWhoAmIAttempt(activeGame);
  const remainingClueMs = getRemainingWhoAmITime(activeGame);
  if (Number(attempt.remainingLives) <= 0 || remainingClueMs <= 0) {
    return;
  }

  openGuessButton.disabled = true;
  clearMessage(whoGuessStatus);

  try {
    const committed = await firebaseService.claimWhoAmIGuess(
      activeGameId,
      activeGame.currentRoundIndex,
      {
        state: "active",
        uid: firebaseUser.uid,
        name: activeGame.players?.[firebaseUser.uid]?.name || currentPlayerName,
        clueIndex: activeGame.currentClueIndex,
        remainingClueMs: Math.max(1, Math.round(remainingClueMs)),
        startedAt: getServerNow(),
      },
    );

    if (!committed) {
      whoGuessStatus.textContent = "En anden spiller nåede først. Vent venligst.";
    }
  } catch (error) {
    showConnectionError(error, whoGuessStatus);
    openGuessButton.disabled = false;
  }
}

function renderWhoAmIRevealPhase(game, player) {
  const result = getWhoAmIRoundResult(game);
  const stateKey = `${game.id}:who-reveal:${game.currentRoundIndex}`;
  if (renderedQuizStateKey === stateKey || !result) {
    return;
  }

  renderedQuizStateKey = stateKey;
  window.clearInterval(questionTimerId);
  questionTimerId = undefined;
  const winnerName = result.winnerUid ? game.players?.[result.winnerUid]?.name : "";
  const lastPlayerName = result.lastPlayerUid ? game.players?.[result.lastPlayerUid]?.name : "";
  let outcomeText = "Ingen gættede spilleren";

  if (result.reason === "correct") {
    outcomeText = `${winnerName} gættede rigtigt ved ledetråd ${Number(result.winningClueIndex) + 1}`;
  } else if (result.reason === "lastChanceCorrect") {
    outcomeText = `${winnerName} gættede rigtigt på sidste chance`;
  } else if (result.reason === "lastChanceWrong") {
    outcomeText = `${lastPlayerName} gættede forkert på sidste chance`;
  } else if (result.reason === "lastChanceTimeout") {
    outcomeText = `${lastPlayerName} nåede ikke at afgive sit sidste gæt`;
  }

  const resultLines = [
    createResultLine("Spilleren var", player.player, "result-line--correct"),
    createResultLine("Runderesultat", outcomeText, result.winnerUid ? "result-line--correct" : "result-line--wrong"),
  ];
  if (result.winnerUid) {
    resultLines.push(createResultLine(
      "Point",
      `${winnerName} +${Number(result.points).toLocaleString("da-DK")} point`,
      "result-line--correct",
    ));
  }

  quizResultPanel.replaceChildren(...resultLines);
  quizEarnedPoints.textContent = result.winnerUid
    ? result.winnerUid === firebaseUser.uid
      ? `Du fik +${Number(result.points).toLocaleString("da-DK")} point`
      : "Ingen point til dig i denne runde"
    : "Ingen fik point i denne runde";
  clearMessage(quizRevealMessage);
  const isHost = game.hostUid === firebaseUser.uid;
  showStandingsButton.disabled = false;
  showStandingsButton.hidden = !isHost;
  revealWaitingMessage.hidden = isHost;
  showScreen("reveal");
}

function renderStandingsPhase(game, selectedIds) {
  const isWhoAmI = game.format === "whoAmI";
  const currentIndex = isWhoAmI ? game.currentRoundIndex : game.currentQuestionIndex;
  const stateKey = `${game.id}:standings:${currentIndex}`;
  if (renderedQuizStateKey === stateKey) {
    return;
  }

  renderedQuizStateKey = stateKey;
  renderLeaderboard(quizStandingsList, game);
  clearMessage(quizStandingsMessage);
  const isHost = game.hostUid === firebaseUser.uid;
  const isLastItem = currentIndex >= selectedIds.length - 1;
  const label = nextQuestionButton.querySelector("span");

  standingsContext.textContent = isWhoAmI ? "Efter runden" : "Efter spørgsmålet";
  label.textContent = isLastItem
    ? "Se slutstilling"
    : isWhoAmI ? "Næste runde" : "Næste spørgsmål";
  nextQuestionButton.disabled = false;
  nextQuestionButton.hidden = !isHost;
  standingsWaitingMessage.hidden = isHost;
  showScreen("standings");
}

function renderFinishedPhase(game) {
  const stateKey = `${game.id}:finished`;
  if (renderedQuizStateKey === stateKey) {
    return;
  }

  renderedQuizStateKey = stateKey;
  const players = renderLeaderboard(quizFinalList, game);
  const topScore = players[0]?.score;
  const winners = players.filter((player) => player.score === topScore).map((player) => player.name);

  quizWinnerMessage.textContent = winners.length === 1
    ? `${winners[0]} vinder!`
    : `${winners.join(" og ")} deler sejren!`;
  showScreen("finished");
}

async function renderClassicGame(game) {
  try {
    await questionsReady;
  } catch (error) {
    showConnectionError(error, pregameMessage);
    return;
  }

  if (game.id !== activeGameId) {
    return;
  }

  const selectedQuestionIds = getSelectedQuestionIds(game);
  const questionId = selectedQuestionIds[game.currentQuestionIndex];
  const question = questionsById.get(questionId);

  if (game.phase !== "finished" && !question) {
    showConnectionError(new Error(`Spørgsmålet ${questionId || "ukendt"} mangler.`), pregameMessage);
    return;
  }

  if (game.phase === "question") {
    renderQuestionPhase(game, question, selectedQuestionIds);
  } else if (game.phase === "reveal") {
    renderRevealPhase(game, question);
  } else if (game.phase === "standings") {
    renderStandingsPhase(game, selectedQuestionIds);
  } else if (game.phase === "finished") {
    renderFinishedPhase(game);
  }
}

async function renderWhoAmIGame(game) {
  try {
    await whoAmIReady;
  } catch (error) {
    showConnectionError(error, pregameMessage);
    return;
  }

  if (game.id !== activeGameId) {
    return;
  }

  const selectedPlayerIds = getSelectedPlayerIds(game);
  const playerId = selectedPlayerIds[game.currentRoundIndex];
  const player = whoAmIPlayersById.get(playerId);

  if (game.phase !== "finished" && !player) {
    showConnectionError(new Error(`Testspilleren ${playerId || "ukendt"} mangler.`), pregameMessage);
    return;
  }

  if (game.phase === "clue" || game.phase === "lastChance") {
    renderWhoAmICluePhase(game, player, selectedPlayerIds);
  } else if (game.phase === "reveal") {
    renderWhoAmIRevealPhase(game, player);
  } else if (game.phase === "standings") {
    renderStandingsPhase(game, selectedPlayerIds);
  } else if (game.phase === "finished") {
    renderFinishedPhase(game);
  }
}

function clearActiveGame() {
  stopGameListener?.();
  stopGameListener = undefined;
  window.clearInterval(questionTimerId);
  questionTimerId = undefined;
  activeGame = null;
  activeGameId = null;
  isCancelingGame = false;
  isSubmittingAnswer = false;
  isSubmittingGuess = false;
  renderedQuizStateKey = "";
  hostTransitionKey = "";
}

function handleGameUpdate(game) {
  if (game && game.id !== activeGameId) {
    return;
  }

  if (!game) {
    if (isCancelingGame) {
      return;
    }

    clearActiveGame();
    showLobby("Spillet blev annulleret af værten.");
    return;
  }

  activeGame = game;

  if (game.status === "started" || game.status === "finished") {
    if (game.format === "classic") {
      renderClassicGame(game);
    } else if (game.format === "whoAmI") {
      renderWhoAmIGame(game);
    }
    return;
  }

  renderPregame(game);
}

function openActiveGame(gameId) {
  stopGameListener?.();
  activeGameId = gameId;
  activeGame = null;
  clearMessage(pregameMessage);
  renderGameSummary(pregameSummary, {
    format: gameDraft.format || "classic",
    questionCount: gameDraft.format === "classic" ? gameDraft.count : undefined,
    roundCount: gameDraft.format === "whoAmI" ? gameDraft.count : undefined,
  });
  pregamePlayerList.replaceChildren();
  pregamePlayerList.append(createGamePlayerRow("Henter spillere…", ""));
  showScreen("pregame");

  stopGameListener = firebaseService.subscribeToGame(
    gameId,
    (game) => {
      if (activeGameId === gameId) {
        handleGameUpdate(game);
      }
    },
    (error) => showConnectionError(error, pregameMessage),
  );
}

async function startActiveGame() {
  if (!activeGame || activeGame.hostUid !== firebaseUser.uid) {
    return;
  }

  const hasAcceptedPlayer = Object.values(activeGame.invitedPlayers || {})
    .some((player) => player.status === "accepted");

  if (!hasAcceptedPlayer) {
    pregameMessage.textContent = "Mindst én spiller skal være klar, før spillet kan startes.";
    return;
  }

  const gameBeforeStart = activeGame;
  setButtonBusy(startGameButton, true, "Starter…");

  try {
    if (activeGame.format === "classic") {
      const questionPool = await questionsReady;
      const selectedQuestionIds = selectRandomQuestionIds(questionPool, activeGame.questionCount);

      if (selectedQuestionIds.length === 0) {
        throw new Error("Der er ingen spørgsmål i spørgsmålspoolen.");
      }

      await firebaseService.startClassicGame(activeGameId, activeGame, selectedQuestionIds);
    } else if (activeGame.format === "whoAmI") {
      const playerPool = await whoAmIReady;
      const selectedPlayerIds = selectRandomPlayerIds(playerPool, activeGame.roundCount);

      if (selectedPlayerIds.length === 0) {
        throw new Error("Der er ingen spillere i spillerpoolen.");
      }

      await firebaseService.startWhoAmIGame(activeGameId, activeGame, selectedPlayerIds);
    }
  } catch (error) {
    activeGame = gameBeforeStart;
    renderedQuizStateKey = "";
    renderPregame(gameBeforeStart);
    showConnectionError(error, pregameMessage);
  } finally {
    setButtonBusy(startGameButton, false, "Starter…");
  }
}

async function cancelActiveGame() {
  if (!activeGame || activeGame.hostUid !== firebaseUser.uid) {
    return;
  }

  cancelGameButton.disabled = true;
  isCancelingGame = true;

  try {
    await firebaseService.cancelGame(activeGameId, activeGame);
    clearActiveGame();
    showLobby("Spillet blev annulleret.");
  } catch (error) {
    isCancelingGame = false;
    showConnectionError(error, pregameMessage);
  } finally {
    cancelGameButton.disabled = false;
  }
}

async function openStandings() {
  if (activeGame?.hostUid !== firebaseUser.uid || activeGame.phase !== "reveal") {
    return;
  }

  showStandingsButton.disabled = true;
  clearMessage(quizRevealMessage);

  try {
    if (activeGame.format === "whoAmI") {
      await firebaseService.showWhoAmIStandings(activeGameId);
    } else {
      await firebaseService.showClassicStandings(activeGameId);
    }
  } catch (error) {
    showConnectionError(error, quizRevealMessage);
    showStandingsButton.disabled = false;
  }
}

async function advanceActiveGame() {
  if (activeGame?.hostUid !== firebaseUser.uid || activeGame.phase !== "standings") {
    return;
  }

  nextQuestionButton.disabled = true;
  clearMessage(quizStandingsMessage);
  const isWhoAmI = activeGame.format === "whoAmI";
  const selectedIds = isWhoAmI
    ? getSelectedPlayerIds(activeGame)
    : getSelectedQuestionIds(activeGame);
  const currentIndex = isWhoAmI
    ? activeGame.currentRoundIndex
    : activeGame.currentQuestionIndex;
  const isLastItem = currentIndex >= selectedIds.length - 1;

  try {
    if (isLastItem) {
      if (isWhoAmI) {
        await firebaseService.finishWhoAmIGame(activeGameId);
      } else {
        await firebaseService.finishClassicGame(activeGameId);
      }
    } else if (isWhoAmI) {
      await firebaseService.startNextWhoAmIRound(
        activeGameId,
        activeGame.currentRoundIndex + 1,
        Object.keys(activeGame.players || {}),
      );
    } else {
      await firebaseService.startNextClassicQuestion(activeGameId, activeGame.currentQuestionIndex + 1);
    }
  } catch (error) {
    showConnectionError(error, quizStandingsMessage);
    nextQuestionButton.disabled = false;
  }
}

function returnToLobbyAfterQuiz() {
  clearActiveGame();
  showLobby("Quizzen er afsluttet.");
}

function showInvitation(invitation) {
  currentInvitation = invitation;
  invitationTitle.textContent = `${invitation.hostName} udfordrer dig!`;
  invitationError.textContent = "";

  const formatName = document.createElement("strong");
  const setting = document.createElement("span");
  formatName.textContent = FORMAT_CONFIG[invitation.format]?.name || "Fodboldquiz";
  setting.textContent = formatSetting(invitation);
  invitationDetails.replaceChildren(formatName, setting);
  invitationModal.hidden = false;
  acceptInvitationButton.focus();
}

function hideInvitation() {
  invitationModal.hidden = true;
  currentInvitation = null;
  invitationError.textContent = "";
}

function handleInvitations(invitations) {
  if (invitations.length === 0) {
    hideInvitation();
    return;
  }

  if (!currentInvitation || !invitations.some((invitation) => invitation.gameId === currentInvitation.gameId)) {
    showInvitation(invitations[0]);
  }
}

async function respondToCurrentInvitation(response) {
  if (!currentInvitation) {
    return;
  }

  const invitation = currentInvitation;
  const isAccepted = response === "accepted";
  acceptInvitationButton.disabled = true;
  declineInvitationButton.disabled = true;
  invitationError.textContent = "";

  try {
    await firebaseService.respondToInvitation(firebaseUser.uid, invitation.gameId, response);
    hideInvitation();

    if (isAccepted) {
      gameDraft = {
        format: invitation.format,
        count: invitation.format === "classic" ? invitation.questionCount : invitation.roundCount,
      };
      openActiveGame(invitation.gameId);
    } else {
      showLobby("Invitationen blev afvist.");
    }
  } catch (error) {
    console.error("Kunne ikke besvare invitation:", error);
    invitationError.textContent = "Invitationen kunne ikke besvares. Prøv igen.";
  } finally {
    acceptInvitationButton.disabled = false;
    declineInvitationButton.disabled = false;
  }
}

playerForm.addEventListener("submit", (event) => {
  event.preventDefault();

  if (isJoiningLobby) {
    return;
  }

  const playerName = playerNameInput.value.trim();

  if (!playerName) {
    nameError.textContent = "Skriv dit spillernavn for at gå videre.";
    playerNameInput.setAttribute("aria-invalid", "true");
    playerNameInput.focus();
    return;
  }

  clearNameError();
  enterLobby(playerName);
});

playerNameInput.addEventListener("input", () => {
  clearNameError();
  clearMessage(startConnectionMessage);
});

backButton.addEventListener("click", leaveLobby);
createGameButton.addEventListener("click", openFormatSelection);
formatBackButton.addEventListener("click", () => showLobby());
formatButtons.forEach((button) => {
  button.addEventListener("click", () => configureGameSettings(button.dataset.format));
});
settingsBackButton.addEventListener("click", () => showScreen("format"));
continueToInvitesButton.addEventListener("click", openInviteSelection);
inviteBackButton.addEventListener("click", () => showScreen("settings"));
sendInvitationsButton.addEventListener("click", sendInvitations);
startGameButton.addEventListener("click", startActiveGame);
cancelGameButton.addEventListener("click", cancelActiveGame);
showStandingsButton.addEventListener("click", openStandings);
nextQuestionButton.addEventListener("click", advanceActiveGame);
returnToLobbyButton.addEventListener("click", returnToLobbyAfterQuiz);
openGuessButton.addEventListener("click", claimWhoAmIGuess);
guessForm.addEventListener("submit", submitWhoAmIGuess);
acceptInvitationButton.addEventListener("click", () => respondToCurrentInvitation("accepted"));
declineInvitationButton.addEventListener("click", () => respondToCurrentInvitation("declined"));

const savedPlayerName = localStorage.getItem(STORAGE_KEY);

if (savedPlayerName) {
  playerNameInput.value = savedPlayerName;
}

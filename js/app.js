const STORAGE_KEY = "pubcrawlPlayerName";
const CONNECTION_ERROR_MESSAGE = "Der kunne ikke oprettes forbindelse. Prøv igen.";

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

function clearActiveGame() {
  stopGameListener?.();
  stopGameListener = undefined;
  activeGame = null;
  activeGameId = null;
  isCancelingGame = false;
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

  if (game.status === "started") {
    stopGameListener?.();
    stopGameListener = undefined;
    renderReady(game);
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

  setButtonBusy(startGameButton, true, "Starter…");

  try {
    await firebaseService.startGame(activeGameId, activeGame);
  } catch (error) {
    showConnectionError(error, pregameMessage);
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
acceptInvitationButton.addEventListener("click", () => respondToCurrentInvitation("accepted"));
declineInvitationButton.addEventListener("click", () => respondToCurrentInvitation("declined"));

const savedPlayerName = localStorage.getItem(STORAGE_KEY);

if (savedPlayerName) {
  playerNameInput.value = savedPlayerName;
}

const STORAGE_KEY = "pubcrawlPlayerName";
const CONNECTION_ERROR_MESSAGE = "Der kunne ikke oprettes forbindelse til lobbyen. Prøv igen.";

const startScreen = document.querySelector("#start-screen");
const lobbyScreen = document.querySelector("#lobby-screen");
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
const comingSoonMessage = document.querySelector("#coming-soon-message");
const startConnectionMessage = document.querySelector("#start-connection-message");
const lobbyConnectionMessage = document.querySelector("#lobby-connection-message");

let firebaseUser;
let presenceController;
let stopPlayersListener;
let isJoiningLobby = false;

function showConnectionError(error, target = startConnectionMessage) {
  console.error("Firebase-fejl:", error);
  target.textContent = CONNECTION_ERROR_MESSAGE;
  target.classList.add("connection-message--error");
}

function clearConnectionMessage(target) {
  target.textContent = "";
  target.classList.remove("connection-message--error");
}

const firebaseReady = import("./firebase.js")
  .then(async (firebaseService) => {
    firebaseUser = await firebaseService.ensureAnonymousUser();
    return firebaseService;
  })
  .catch((error) => {
    showConnectionError(error);
    return null;
  });

function showLobby(playerName) {
  welcomeMessage.textContent = `Velkommen, ${playerName}`;
  startScreen.hidden = true;
  lobbyScreen.hidden = false;
  backButton.focus();
}

function showStart() {
  lobbyScreen.hidden = true;
  startScreen.hidden = false;
  comingSoonMessage.textContent = "Denne funktion kommer i en senere version.";
  clearConnectionMessage(lobbyConnectionMessage);
  playerNameInput.focus();
}

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

function createPlayerRow(player) {
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

function renderPlayers(players) {
  playersList.replaceChildren();

  if (players.length === 0) {
    const emptyMessage = document.createElement("p");
    emptyMessage.className = "players-loading";
    emptyMessage.textContent = "Ingen spillere er online endnu.";
    playersList.append(emptyMessage);
  } else {
    const fragment = document.createDocumentFragment();

    players.forEach((player) => {
      fragment.append(createPlayerRow(player));
    });

    playersList.append(fragment);
  }

  playerCount.textContent = String(players.length);
  playerCount.setAttribute("aria-label", players.length === 1 ? "1 spiller" : `${players.length} spillere`);
}

async function enterLobby(playerName) {
  setJoiningState(true);
  clearConnectionMessage(startConnectionMessage);

  try {
    const firebaseService = await firebaseReady;

    if (!firebaseService || !firebaseUser) {
      throw new Error("Firebase Authentication er ikke tilgængelig.");
    }

    presenceController = await firebaseService.joinLobbyPresence(
      firebaseUser,
      playerName,
      (error) => showConnectionError(error, lobbyConnectionMessage),
    );

    stopPlayersListener = firebaseService.subscribeToLobbyPlayers(
      renderPlayers,
      (error) => showConnectionError(error, lobbyConnectionMessage),
    );

    localStorage.setItem(STORAGE_KEY, playerName);
    showLobby(playerName);
  } catch (error) {
    showConnectionError(error);
  } finally {
    setJoiningState(false);
  }
}

async function leaveLobby() {
  backButton.disabled = true;
  clearConnectionMessage(lobbyConnectionMessage);

  try {
    await presenceController?.leave();
    presenceController = undefined;
    stopPlayersListener?.();
    stopPlayersListener = undefined;
    showStart();
  } catch (error) {
    showConnectionError(error, lobbyConnectionMessage);
  } finally {
    backButton.disabled = false;
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
  clearConnectionMessage(startConnectionMessage);
});

backButton.addEventListener("click", leaveLobby);

createGameButton.addEventListener("click", () => {
  comingSoonMessage.textContent = "Spil og invitationer kommer i en senere milepæl.";
});

const savedPlayerName = localStorage.getItem(STORAGE_KEY);

if (savedPlayerName) {
  playerNameInput.value = savedPlayerName;
}

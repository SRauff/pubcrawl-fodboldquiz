const STORAGE_KEY = "pubcrawlPlayerName";

const startScreen = document.querySelector("#start-screen");
const lobbyScreen = document.querySelector("#lobby-screen");
const playerForm = document.querySelector("#player-form");
const playerNameInput = document.querySelector("#player-name");
const nameError = document.querySelector("#name-error");
const welcomeMessage = document.querySelector("#welcome-message");
const lobbyPlayerName = document.querySelector("#lobby-player-name");
const playerInitial = document.querySelector("#player-initial");
const backButton = document.querySelector("#back-button");
const createGameButton = document.querySelector("#create-game-button");
const comingSoonMessage = document.querySelector("#coming-soon-message");

function showLobby(playerName) {
  welcomeMessage.textContent = `Velkommen, ${playerName}`;
  lobbyPlayerName.textContent = playerName;
  playerInitial.textContent = playerName.charAt(0).toLocaleUpperCase("da-DK");

  startScreen.hidden = true;
  lobbyScreen.hidden = false;
  backButton.focus();
}

function showStart() {
  lobbyScreen.hidden = true;
  startScreen.hidden = false;
  comingSoonMessage.textContent = "Denne funktion kommer i en senere version.";
  playerNameInput.focus();
}

function clearNameError() {
  nameError.textContent = "";
  playerNameInput.removeAttribute("aria-invalid");
}

playerForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const playerName = playerNameInput.value.trim();

  if (!playerName) {
    nameError.textContent = "Skriv dit spillernavn for at gå videre.";
    playerNameInput.setAttribute("aria-invalid", "true");
    playerNameInput.focus();
    return;
  }

  clearNameError();
  localStorage.setItem(STORAGE_KEY, playerName);
  showLobby(playerName);
});

playerNameInput.addEventListener("input", clearNameError);
backButton.addEventListener("click", showStart);

createGameButton.addEventListener("click", () => {
  comingSoonMessage.textContent = "Spil og invitationer kommer i en senere milepæl.";
});

const savedPlayerName = localStorage.getItem(STORAGE_KEY);

if (savedPlayerName) {
  playerNameInput.value = savedPlayerName;
}

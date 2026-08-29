import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import {
  getDatabase,
  onDisconnect,
  onValue,
  push,
  ref,
  remove,
  serverTimestamp,
  set,
  update,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyCeVHXEJfPgl459SR5Lc9v54P86fN8C2P8",
  authDomain: "pubcrawl-fodboldquiz.firebaseapp.com",
  databaseURL: "https://pubcrawl-fodboldquiz-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "pubcrawl-fodboldquiz",
  storageBucket: "pubcrawl-fodboldquiz.firebasestorage.app",
  messagingSenderId: "549323296500",
  appId: "1:549323296500:web:78650f86e85228e1c4d8a1",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);

let authenticationPromise;

function getInitialAuthUser() {
  return new Promise((resolve, reject) => {
    let unsubscribe = () => {};

    unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        unsubscribe();
        resolve(user);
      },
      reject,
    );
  });
}

export function ensureAnonymousUser() {
  if (!authenticationPromise) {
    authenticationPromise = getInitialAuthUser()
      .then((user) => {
        if (user) {
          return user;
        }

        return signInAnonymously(auth).then((credential) => credential.user);
      })
      .catch((error) => {
        authenticationPromise = undefined;
        throw error;
      });
  }

  return authenticationPromise;
}

export function subscribeToLobbyPlayers(onPlayers, onError) {
  const lobbyPlayersRef = ref(database, "lobbyPlayers");

  return onValue(
    lobbyPlayersRef,
    (snapshot) => {
      const players = [];

      snapshot.forEach((playerSnapshot) => {
        const player = playerSnapshot.val();

        if (player?.name) {
          players.push({
            uid: playerSnapshot.key,
            name: player.name,
            joinedAt: player.joinedAt,
          });
        }
      });

      players.sort((firstPlayer, secondPlayer) => {
        const firstJoinedAt = Number(firstPlayer.joinedAt) || Number.MAX_SAFE_INTEGER;
        const secondJoinedAt = Number(secondPlayer.joinedAt) || Number.MAX_SAFE_INTEGER;

        return firstJoinedAt - secondJoinedAt || firstPlayer.name.localeCompare(secondPlayer.name, "da");
      });

      onPlayers(players);
    },
    onError,
  );
}

export function joinLobbyPresence(user, playerName, onError) {
  const playerRef = ref(database, `lobbyPlayers/${user.uid}`);
  const connectedRef = ref(database, ".info/connected");

  let activeDisconnectOperation;
  let presenceRegistration = Promise.resolve();
  let hasLeftLobby = false;
  let hasJoinedLobby = false;

  return new Promise((resolve, reject) => {
    let stopConnectionListener = () => {};

    const connectionTimeout = window.setTimeout(() => {
      if (!hasJoinedLobby) {
        stopConnectionListener();
        reject(new Error("Forbindelsen til Realtime Database fik timeout."));
      }
    }, 15000);

    const handlePresenceError = (error) => {
      if (!hasJoinedLobby) {
        window.clearTimeout(connectionTimeout);
        stopConnectionListener();
        reject(error);
        return;
      }

      onError(error);
    };

    stopConnectionListener = onValue(
      connectedRef,
      (snapshot) => {
        if (snapshot.val() !== true || hasLeftLobby) {
          return;
        }

        const registerPresence = async () => {
          try {
            const disconnectOperation = onDisconnect(playerRef);
            activeDisconnectOperation = disconnectOperation;

            // Registrér oprydningen på serveren, før spilleren markeres online.
            await disconnectOperation.remove();

            if (hasLeftLobby) {
              await disconnectOperation.cancel();
              return;
            }

            await set(playerRef, {
              name: playerName,
              joinedAt: serverTimestamp(),
            });

            // Hvis spilleren trykkede "Tilbage", mens set() stadig var i gang,
            // må den sene skrivning ikke oprette lobby-posten igen.
            if (hasLeftLobby) {
              await remove(playerRef);
              await disconnectOperation.cancel();
              return;
            }

            if (!hasJoinedLobby) {
              hasJoinedLobby = true;
              window.clearTimeout(connectionTimeout);

              resolve({
                leave: async () => {
                  hasLeftLobby = true;
                  stopConnectionListener();

                  // Vent på en eventuel igangværende reconnect-registrering,
                  // før den afsluttende oprydning udføres.
                  await presenceRegistration.catch(() => {});

                  // Fjern først online-posten. Hvis det fejler, bevares
                  // onDisconnect som sikkerhedsnet.
                  await remove(playerRef);
                  await activeDisconnectOperation?.cancel();
                },
              });
            }
          } catch (error) {
            handlePresenceError(error);
          }
        };

        presenceRegistration = registerPresence();
      },
      handlePresenceError,
    );
  });
}

export async function createGame(user, hostName, gameDraft, invitedPlayers) {
  const newGameRef = push(ref(database, "games"));
  const gameId = newGameRef.key;
  const createdAt = serverTimestamp();
  const invitedPlayersData = {};

  invitedPlayers.forEach((player) => {
    invitedPlayersData[player.uid] = {
      name: player.name,
      status: "pending",
    };
  });

  const game = {
    hostUid: user.uid,
    hostName,
    format: gameDraft.format,
    status: "waiting",
    createdAt,
    invitedPlayers: invitedPlayersData,
  };

  if (gameDraft.format === "classic") {
    game.questionCount = gameDraft.count;
  } else {
    game.roundCount = gameDraft.count;
  }

  const updates = {
    [`games/${gameId}`]: game,
  };

  invitedPlayers.forEach((player) => {
    updates[`invitations/${player.uid}/${gameId}`] = {
      gameId,
      hostUid: user.uid,
      hostName,
      format: gameDraft.format,
      createdAt,
      ...(gameDraft.format === "classic"
        ? { questionCount: gameDraft.count }
        : { roundCount: gameDraft.count }),
    };
  });

  await update(ref(database), updates);

  return { gameId };
}

export function subscribeToInvitations(userUid, onInvitations, onError) {
  const invitationsRef = ref(database, `invitations/${userUid}`);

  return onValue(
    invitationsRef,
    (snapshot) => {
      const invitations = [];

      snapshot.forEach((invitationSnapshot) => {
        const invitation = invitationSnapshot.val();

        if (invitation?.gameId && invitation?.hostName) {
          invitations.push({
            ...invitation,
            gameId: invitationSnapshot.key,
          });
        }
      });

      invitations.sort((firstInvitation, secondInvitation) => {
        return (Number(firstInvitation.createdAt) || 0) - (Number(secondInvitation.createdAt) || 0);
      });

      onInvitations(invitations);
    },
    onError,
  );
}

export function respondToInvitation(userUid, gameId, response) {
  const updates = {
    [`games/${gameId}/invitedPlayers/${userUid}/status`]: response,
    [`invitations/${userUid}/${gameId}`]: null,
  };

  return update(ref(database), updates);
}

export function subscribeToGame(gameId, onGame, onError) {
  const gameRef = ref(database, `games/${gameId}`);

  return onValue(
    gameRef,
    (snapshot) => {
      onGame(snapshot.exists() ? { id: gameId, ...snapshot.val() } : null);
    },
    onError,
  );
}

export function startGame(gameId, game) {
  const updates = {
    [`games/${gameId}/status`]: "started",
  };

  Object.entries(game.invitedPlayers || {}).forEach(([uid, player]) => {
    if (player.status === "pending") {
      updates[`invitations/${uid}/${gameId}`] = null;
    }
  });

  return update(ref(database), updates);
}

export function cancelGame(gameId, game) {
  const updates = {
    [`games/${gameId}`]: null,
  };

  Object.entries(game.invitedPlayers || {}).forEach(([uid, player]) => {
    // Accepterede og afviste invitationer er allerede fjernet, når spilleren
    // svarer. En null-skrivning til en sti, der ikke findes, afvises af de
    // afgrænsede Security Rules og ville annullere hele multi-path-opdateringen.
    if (player.status === "pending") {
      updates[`invitations/${uid}/${gameId}`] = null;
    }
  });

  return update(ref(database), updates);
}

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
  ref,
  remove,
  serverTimestamp,
  set,
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

            if (!hasJoinedLobby) {
              hasJoinedLobby = true;
              window.clearTimeout(connectionTimeout);

              resolve({
                leave: async () => {
                  hasLeftLobby = true;
                  stopConnectionListener();

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

        registerPresence();
      },
      handlePresenceError,
    );
  });
}

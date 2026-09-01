import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import {
  get,
  getDatabase,
  increment,
  onDisconnect,
  onValue,
  push,
  ref,
  remove,
  runTransaction,
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
        let activeConnection;

        playerSnapshot.child("connections").forEach((connectionSnapshot) => {
          const connection = connectionSnapshot.val();
          const joinedAt = Number(connection?.joinedAt) || 0;

          if (
            connection?.name
            && (!activeConnection || joinedAt > activeConnection.joinedAt)
          ) {
            activeConnection = {
              name: connection.name,
              joinedAt,
            };
          }
        });

        if (activeConnection) {
          players.push({
            uid: playerSnapshot.key,
            name: activeConnection.name,
            joinedAt: activeConnection.joinedAt,
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
  const connectionRef = push(ref(database, `lobbyPlayers/${user.uid}/connections`));
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
            const disconnectOperation = onDisconnect(connectionRef);
            activeDisconnectOperation = disconnectOperation;

            // Registrér oprydningen på serveren, før spilleren markeres online.
            await disconnectOperation.remove();

            if (hasLeftLobby) {
              await disconnectOperation.cancel();
              return;
            }

            await set(connectionRef, {
              name: playerName,
              joinedAt: serverTimestamp(),
            });

            // Hvis spilleren trykkede "Tilbage", mens set() stadig var i gang,
            // må den sene skrivning ikke oprette lobby-posten igen.
            if (hasLeftLobby) {
              await remove(connectionRef);
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
                  await remove(connectionRef);
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

export async function registerGameDepartureOnDisconnect(user, gameId, playerName) {
  const departureRef = ref(database, `games/${gameId}/departure`);
  const disconnectOperation = onDisconnect(departureRef);

  await disconnectOperation.set({
    uid: user.uid,
    name: playerName,
    leftAt: serverTimestamp(),
  });

  return {
    cancel: () => disconnectOperation.cancel(),
  };
}

export function subscribeToServerTimeOffset(onOffset, onError) {
  return onValue(
    ref(database, ".info/serverTimeOffset"),
    (snapshot) => onOffset(Number(snapshot.val()) || 0),
    onError,
  );
}

export async function getContentUsage(format) {
  const snapshot = await get(ref(database, `contentUsage/${format}`));
  return snapshot.val() || {};
}

function addContentUsageUpdates(updates, format, selectedIds) {
  [...new Set(selectedIds)].forEach((contentId) => {
    updates[`contentUsage/${format}/${contentId}/count`] = increment(1);
    updates[`contentUsage/${format}/${contentId}/lastUsedAt`] = serverTimestamp();
  });
}

export function recordContentUsage(format, selectedIds) {
  const updates = {};
  addContentUsageUpdates(updates, format, selectedIds);
  return update(ref(database), updates);
}

function addPendingInvitationCleanup(updates, gameId, game) {
  Object.entries(game.invitedPlayers || {}).forEach(([uid, player]) => {
    if (player.status === "pending") {
      updates[`invitations/${uid}/${gameId}`] = null;
    }
  });
}

export function startGame(gameId, game) {
  const updates = {
    [`games/${gameId}/status`]: "started",
  };

  addPendingInvitationCleanup(updates, gameId, game);

  return update(ref(database), updates);
}

export function startClassicGame(gameId, game, selectedQuestionIds) {
  const players = {
    [game.hostUid]: { name: game.hostName },
  };

  Object.entries(game.invitedPlayers || {}).forEach(([uid, player]) => {
    if (player.status === "accepted") {
      players[uid] = { name: player.name };
    }
  });

  const scores = Object.fromEntries(Object.keys(players).map((uid) => [uid, 0]));
  const updates = {
    [`games/${gameId}/status`]: "started",
    [`games/${gameId}/phase`]: "question",
    [`games/${gameId}/selectedQuestionIds`]: selectedQuestionIds,
    [`games/${gameId}/totalQuestions`]: selectedQuestionIds.length,
    [`games/${gameId}/currentQuestionIndex`]: 0,
    [`games/${gameId}/questionStartedAt`]: serverTimestamp(),
    [`games/${gameId}/players`]: players,
    [`games/${gameId}/scores`]: scores,
  };

  addPendingInvitationCleanup(updates, gameId, game);
  addContentUsageUpdates(updates, "classic", selectedQuestionIds);
  return update(ref(database), updates);
}

export function startWhoAmIGame(gameId, game, selectedPlayerIds) {
  const players = {
    [game.hostUid]: { name: game.hostName },
  };

  Object.entries(game.invitedPlayers || {}).forEach(([uid, player]) => {
    if (player.status === "accepted") {
      players[uid] = { name: player.name };
    }
  });

  const scores = Object.fromEntries(Object.keys(players).map((uid) => [uid, 0]));
  const attempts = Object.fromEntries(Object.keys(players).map((uid) => [uid, {
    remainingLives: 2,
    guessCount: 0,
  }]));
  const updates = {
    [`games/${gameId}/status`]: "started",
    [`games/${gameId}/phase`]: "clue",
    [`games/${gameId}/selectedPlayerIds`]: selectedPlayerIds,
    [`games/${gameId}/totalRounds`]: selectedPlayerIds.length,
    [`games/${gameId}/currentRoundIndex`]: 0,
    [`games/${gameId}/currentClueIndex`]: 0,
    [`games/${gameId}/clueStartedAt`]: serverTimestamp(),
    [`games/${gameId}/players`]: players,
    [`games/${gameId}/scores`]: scores,
    [`games/${gameId}/whoAmIAttempts/0`]: attempts,
  };

  addPendingInvitationCleanup(updates, gameId, game);
  addContentUsageUpdates(updates, "whoAmI", selectedPlayerIds);
  return update(ref(database), updates);
}

export async function claimWhoAmIRound(gameId, roundIndex, claim) {
  const claimRef = ref(database, `games/${gameId}/roundClaims/${roundIndex}`);
  const result = await runTransaction(claimRef, (currentClaim) => {
    if (currentClaim) {
      return;
    }

    return claim;
  });

  return result.committed;
}

export async function claimWhoAmIGuess(gameId, roundIndex, guessControl) {
  const guessControlRef = ref(database, `games/${gameId}/guessControl/${roundIndex}`);
  const result = await runTransaction(guessControlRef, (currentControl) => {
    if (currentControl) {
      return;
    }

    return guessControl;
  });

  return result.committed;
}

export async function markWhoAmIGuessWrong(gameId, roundIndex, userUid, guess, resolvedAt) {
  const guessControlRef = ref(database, `games/${gameId}/guessControl/${roundIndex}`);
  const result = await runTransaction(guessControlRef, (control) => {
    if (!control || control.state !== "active" || control.uid !== userUid) {
      return;
    }

    return {
      ...control,
      state: "wrong",
      guess,
      resolvedAt,
    };
  });

  return result.committed;
}

export function resolveFailedWhoAmIGuess(gameId, game, resolution, resolvedAt) {
  const roundIndex = game.currentRoundIndex;
  const control = game.guessControl?.[roundIndex];
  const attempt = game.whoAmIAttempts?.[roundIndex]?.[resolution.uid];

  if (!control || !attempt || control.uid !== resolution.uid) {
    return Promise.resolve();
  }

  const guessCount = Number(attempt.guessCount) || 0;
  const remainingLives = Math.max(0, (Number(attempt.remainingLives) || 0) - 1);
  const updates = {
    [`games/${gameId}/whoAmIAttempts/${roundIndex}/${resolution.uid}/remainingLives`]: remainingLives,
    [`games/${gameId}/whoAmIAttempts/${roundIndex}/${resolution.uid}/guessCount`]: guessCount + 1,
    [`games/${gameId}/guessControl/${roundIndex}`]: null,
  };

  if (resolution.reason === "wrong") {
    updates[`games/${gameId}/whoAmIAttempts/${roundIndex}/${resolution.uid}/guesses/${guessCount}`] = {
      guess: control.guess,
      guessedAt: Number(control.resolvedAt) || resolvedAt,
      correct: false,
      mode: "normal",
    };
  }

  const activePlayerUids = Object.keys(game.players || {}).filter((uid) => {
    if (uid === resolution.uid) {
      return remainingLives > 0;
    }
    return Number(game.whoAmIAttempts?.[roundIndex]?.[uid]?.remainingLives) > 0;
  });

  if (activePlayerUids.length === 1 && Object.keys(game.players || {}).length > 1) {
    updates[`games/${gameId}/phase`] = "lastChance";
    updates[`games/${gameId}/lastPlayerStandingUid`] = activePlayerUids[0];
    updates[`games/${gameId}/lastChanceStartedAt`] = resolvedAt;
  } else {
    const pausedMs = Math.max(0, Math.min(10000, Number(control.remainingClueMs) || 0));
    updates[`games/${gameId}/clueStartedAt`] = resolvedAt - (10000 - pausedMs);
  }

  return update(ref(database), updates);
}

export async function submitWrongWhoAmIGuess(gameId, roundIndex, userUid, guess) {
  const attemptRef = ref(database, `games/${gameId}/whoAmIAttempts/${roundIndex}/${userUid}`);
  const result = await runTransaction(attemptRef, (attempt) => {
    if (!attempt) {
      return;
    }

    const guessCount = Number(attempt.guessCount) || 0;
    const remainingLives = Number(attempt.remainingLives) || 0;
    const isLastChance = guess.mode === "lastChance";

    if ((isLastChance && attempt.lastChanceUsed) || (!isLastChance && remainingLives <= 0)) {
      return;
    }

    return {
      ...attempt,
      remainingLives: isLastChance ? remainingLives : Math.max(0, remainingLives - 1),
      guessCount: guessCount + 1,
      ...(isLastChance ? { lastChanceUsed: true } : {}),
      guesses: {
        ...(attempt.guesses || {}),
        [guessCount]: guess,
      },
    };
  });

  return result.committed;
}

export function advanceWhoAmIClue(gameId, clueIndex) {
  return update(ref(database), {
    [`games/${gameId}/currentClueIndex`]: clueIndex,
    [`games/${gameId}/clueStartedAt`]: serverTimestamp(),
  });
}

export function beginWhoAmILastChance(gameId, userUid) {
  return update(ref(database), {
    [`games/${gameId}/phase`]: "lastChance",
    [`games/${gameId}/lastPlayerStandingUid`]: userUid,
    [`games/${gameId}/lastChanceStartedAt`]: serverTimestamp(),
  });
}

export function finalizeWhoAmIRound(gameId, roundIndex, scores, result) {
  return update(ref(database), {
    [`games/${gameId}/phase`]: "reveal",
    [`games/${gameId}/scores`]: scores,
    [`games/${gameId}/guessControl/${roundIndex}`]: null,
    [`games/${gameId}/roundResults/${roundIndex}`]: {
      ...result,
      finalizedAt: serverTimestamp(),
    },
  });
}

export function showWhoAmIStandings(gameId) {
  return update(ref(database), {
    [`games/${gameId}/phase`]: "standings",
  });
}

export function startNextWhoAmIRound(gameId, roundIndex, playerUids) {
  const attempts = Object.fromEntries(playerUids.map((uid) => [uid, {
    remainingLives: 2,
    guessCount: 0,
  }]));

  return update(ref(database), {
    [`games/${gameId}/phase`]: "clue",
    [`games/${gameId}/currentRoundIndex`]: roundIndex,
    [`games/${gameId}/currentClueIndex`]: 0,
    [`games/${gameId}/clueStartedAt`]: serverTimestamp(),
    [`games/${gameId}/lastPlayerStandingUid`]: null,
    [`games/${gameId}/lastChanceStartedAt`]: null,
    [`games/${gameId}/whoAmIAttempts/${roundIndex}`]: attempts,
  });
}

export function finishWhoAmIGame(gameId) {
  return update(ref(database), {
    [`games/${gameId}/status`]: "finished",
    [`games/${gameId}/phase`]: "finished",
    [`games/${gameId}/finishedAt`]: serverTimestamp(),
  });
}

export function submitClassicAnswer(gameId, questionIndex, userUid, optionIndex) {
  return set(ref(database, `games/${gameId}/answers/${questionIndex}/${userUid}`), {
    optionIndex,
    answeredAt: serverTimestamp(),
  });
}

export function revealClassicQuestion(gameId, questionIndex, scores, awardedPoints, correctAnswerIndex) {
  const updates = {
    [`games/${gameId}/phase`]: "reveal",
    [`games/${gameId}/scores`]: scores,
    [`games/${gameId}/questionResults/${questionIndex}`]: {
      correctAnswerIndex,
      awardedPoints,
      finalizedAt: serverTimestamp(),
    },
  };

  return update(ref(database), updates);
}

export function showClassicStandings(gameId) {
  return update(ref(database), {
    [`games/${gameId}/phase`]: "standings",
  });
}

export function startNextClassicQuestion(gameId, questionIndex) {
  return update(ref(database), {
    [`games/${gameId}/phase`]: "question",
    [`games/${gameId}/currentQuestionIndex`]: questionIndex,
    [`games/${gameId}/questionStartedAt`]: serverTimestamp(),
  });
}

export function finishClassicGame(gameId) {
  return update(ref(database), {
    [`games/${gameId}/status`]: "finished",
    [`games/${gameId}/phase`]: "finished",
    [`games/${gameId}/finishedAt`]: serverTimestamp(),
  });
}

export function cancelGame(gameId, game) {
  const updates = {
    [`games/${gameId}`]: null,
  };

  // Accepterede og afviste invitationer er allerede fjernet, når spilleren
  // svarer. En null-skrivning til en sti, der ikke findes, kan afvise hele
  // multi-path-opdateringen.
  addPendingInvitationCleanup(updates, gameId, game);

  return update(ref(database), updates);
}

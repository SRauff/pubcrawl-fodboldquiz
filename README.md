# Pubcrawl fodboldquiz

En mobile-first dansk fodboldquiz med pubcrawl-stemning. Vælg mellem en lokal **Single Player**-quiz eller realtime-multiplayer med venner i **Klassisk quiz** og **Gæt hvem jeg er**.

## Projektstruktur

```text
index.html            Skærme, invitationsoverlay og quiz-UI
css/style.css         Mobile-first design og layout
js/app.js             Navigation, quizmotorer og brugerflade
js/firebase.js        Firebase-login, presence og realtime game-state
data/questions.json   Produktionspulje til Klassisk quiz
data/who-am-i.json    Produktionspulje til Gæt hvem jeg er
README.md             Projektdokumentation
```

## Test lokalt

Projektet kræver ingen installation eller build-proces:

```bash
python3 -m http.server 8000
```

Åbn [http://localhost:8000](http://localhost:8000). Firebase kræver internetforbindelse. Frontend kan hostes direkte via GitHub Pages. Brug to separate browser-sessioner, så Firebase Authentication opretter forskellige anonyme brugere.

## Arkitektur

- Single Player bruger samme quizmotor og produktionsdata som multiplayer, men holder game-state lokalt i browseren og skriver ikke lobbyer, invitationer eller spil til Firebase. Kun den globale brugsstatistik for udvalgt quizindhold opdateres.
- Firebase Authentication identificerer automatisk hver browser anonymt.
- `lobbyPlayers/{uid}/connections/{connectionId}` indeholder hver aktiv browserforbindelse. Hver forbindelse registrerer sin egen `onDisconnect().remove()`, og lobbyen viser højst én række pr. anonym bruger.
- `invitations/{playerUid}/{gameId}` indeholder aktive invitationer.
- `games/{gameId}` indeholder deltagere, scores og fælles quiz-state.
- `contentUsage/classic/{questionId}` og `contentUsage/whoAmI/{playerId}` indeholder globalt `count` og `lastUsedAt`, så nyligt og ofte brugt indhold vælges sjældnere.
- Firebase `.info/serverTimeOffset` og fælles timestamps synkroniserer quiztiderne.
- Hosten styrer progression, resultater og stillinger. Hver spiller skriver kun egne svar/forsøg.
- Et aktivt multiplayer-spil registrerer `games/{gameId}/departure` med Firebase `onDisconnect()`. Hvis en deltager mister forbindelsen eller forlader siden, afsluttes spillet for alle deltagere.

## Single Player

Efter valg af **Spil alene** indtaster spilleren sit navn, vælger format og antal spørgsmål eller runder og starter direkte. Der bruges ingen lobby, invitationer eller pre-game-lobby.

- Klassisk quiz bruger 15 sekunder pr. spørgsmål. Ét korrekt svar giver 100 point.
- Gæt hvem jeg er bruger 10 sekunder pr. ledetråd, 25 sekunder til et buzzer-gæt og to liv pr. runde.
- Single Player har ikke multiplayer-reglen *sidste spiller tilbage*: Ved andet forkerte gæt afsluttes runden øjeblikkeligt uden facit eller yderligere ledetråde.

## Klassisk quiz

`data/questions.json` indeholder 130 produktionsspørgsmål med fire svarmuligheder og facit: 40 easy, 50 medium og 40 hard. Hver quiz fordeler først spørgsmålene så ligeligt som muligt mellem de tre difficulties. Eventuelle restpladser fordeles tilfældigt, hvorefter konkrete spørgsmål vælges uden dubletter inden for hver difficulty efter laveste globale brugstal, ældste `lastUsedAt` og tilfældig tie-break. Det samlede sæt shuffles til sidst. Alle ser samme spørgsmål og en fælles 15-sekunders timer. Korrekte svar giver point efter svarhastighed. Efter hvert spørgsmål vises facit og stilling. Slutskærmen viser den eksisterende pointplacering i en ligatabel med antal spørgsmål, rigtige, forkerte og den allerede beregnede slutscore.

## Gæt hvem jeg er

`data/who-am-i.json` indeholder 40 produktionsspillere med unikt ID, canonical navn, aliases og præcis 10 ledetråde. Et rundeantal over poolens størrelse begrænses automatisk.

Spiller-ID'erne vælges efter samme globale brugsprioritet som Klassisk quiz og uden dubletter. Manglende statistik behandles som `count: 0` og aldrig brugt. Single Player opdaterer statistikken én gang, når spillet startes. I multiplayer udfører hosten spilstart og brugsoptælling i samme atomiske multi-path update. Optællingen bruger Firebase `increment(1)`, så samtidige starter ikke overskriver hinanden; refresh og realtime-listeners skriver ikke statistik.

```text
phase: "clue" | "lastChance" | "reveal" | "standings" | "finished"
selectedPlayerIds
totalRounds
currentRoundIndex
currentClueIndex
clueStartedAt
lastPlayerStandingUid
lastChanceStartedAt
players
scores
whoAmIAttempts/{roundIndex}/{uid}
roundClaims/{roundIndex}
roundResults/{roundIndex}
```

Alle starter hver runde med to liv. Et forkert gæt koster ét liv. Første korrekte gæt vinder runden; en Firebase-transaktion på `roundClaims/{roundIndex}` sikrer én accepteret vinder. Hvis kun én spiller har liv tilbage, pauses ledetrådene, og spilleren får ét sidste 25-sekunders gæt. Korrekt sidste gæt giver point; forkert gæt eller timeout giver nul. Liv nulstilles ved næste runde.

Den sidste spiller kan også vælge **Jeg aner det ikke**. Valget bruger samme atomiske `roundClaims`-transaktion som et korrekt gæt, så korrekt svar, timeout og opgivelse ikke kan afgøre runden flere gange.

Spillerens identitet vises kun i multiplayer, når en deltager gætter korrekt. Ved opgivelse, timeout, forkert sidste gæt eller andre runder uden en vinder vises kun en neutral resultatbesked.

WhoAmI-slutskærmen bevarer den officielle pointplacering og viser som statistik, hvor mange runder hver spiller vandt. Statistikken beregnes fra de eksisterende `roundResults` og ændrer ikke scoring eller tie-breaking.

Når en spiller klikker **Gæt spilleren**, claimer klienten atomisk `guessControl/{roundIndex}`. Her gemmes den aktive gætter, den aktuelle ledetråd og den resterende ledetrådstid. Alle klienter pauser derfor samme timer. Gætteren får en separat periode på 25 sekunder; efter et forkert gæt eller timeout trækker host-klienten ét liv og genoptager ledetråden med den gemte resttid.

Navne sammenlignes efter trimning, konvertering til små bogstaver og samling af flere mellemrum. Der bruges ikke fuzzy matching.

| Ledetråd | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Point | 1.000 | 900 | 800 | 700 | 600 | 500 | 400 | 300 | 200 | 100 |

Kun rundens ene vinder får point.

## Test Milepæl 5

1. Gå i lobbyen som Sebastian og Martin i to separate sessioner.
2. Opret Gæt hvem jeg er med tre runder, invitér, acceptér og start.
3. Klik næsten samtidigt på Gæt spilleren, og kontrollér at kun én spiller får inputfeltet.
4. Kontrollér at ledetrådstimeren pauser for begge, mens den fælles 25-sekunders gættetimer kører.
5. Test et forkert gæt og en timeout: ét liv mistes, og ledetråden fortsætter med den gemte resttid.
6. Test korrekt alias med store/små bogstaver og ekstra whitespace; point skal følge den pausede ledetråd.
7. Test to forkerte gæt, nul liv og nulstilling i næste runde.
8. Test sidste spiller tilbage med korrekt gæt, forkert gæt og timeout.
9. Test næsten samtidige korrekte gæt: kun én vinder og pointtildeling.
10. Lad ledetråd 10 udløbe uden vinder.
11. Gennemfør slutstilling, gå tilbage til lobbyen og opret et nyt spil.
12. Regressionstest invitation, afvisning, annullering, presence og Klassisk quiz.

## Kendte begrænsninger

- Produktionspuljen indeholder 40 Gæt hvem jeg er-spillere og 130 Klassisk-spørgsmål.
- Der er ingen fuzzy matching eller host-migration.
- Facit og logik ligger i frontend. Uden backend kan reglerne ikke afgøre, om et navn faktisk er korrekt.
- Afsluttede game-noder bevares, så deltagerne kan forlade i eget tempo.

## Firebase Console

Den aktuelle frontend kræver også autentificeret læse- og skriveadgang til den globale brugsstatistik. Databasen er fortsat lukket som udgangspunkt.

Erstat hele blokken under **Firebase → Realtime Database → Rules** og klik **Publish**:

```json
{
  "rules": {
    ".read": false,
    ".write": false,
    "lobbyPlayers": {
      ".read": "auth != null",
      "$uid": {
        "connections": {
          "$connectionId": {
            ".write": "auth != null && auth.uid === $uid",
            ".validate": "!newData.exists() || (newData.hasChildren(['name', 'joinedAt']) && newData.child('name').isString() && newData.child('name').val().length > 0 && newData.child('name').val().length <= 30 && newData.child('joinedAt').isNumber())"
          }
        }
      }
    },
    "contentUsage": {
      ".read": "auth != null",
      "$format": {
        "$contentId": {
          ".write": "auth != null && ($format === 'classic' || $format === 'whoAmI')",
          ".validate": "newData.hasChildren(['count', 'lastUsedAt']) && newData.child('count').isNumber() && newData.child('count').val() >= 1 && newData.child('lastUsedAt').isNumber() && ((!data.exists() && newData.child('count').val() === 1) || (data.child('count').isNumber() && newData.child('count').val() === data.child('count').val() + 1))"
        }
      }
    },
    "games": {
      "$gameId": {
        ".read": "auth != null && (!data.exists() || data.child('hostUid').val() === auth.uid || data.child('invitedPlayers').child(auth.uid).exists())",
        ".write": "auth != null && ((!data.exists() && newData.child('hostUid').val() === auth.uid) || (data.exists() && data.child('hostUid').val() === auth.uid && (!newData.exists() || newData.child('hostUid').val() === auth.uid)))",
        ".validate": "!newData.exists() || (newData.hasChildren(['hostUid', 'hostName', 'format', 'status', 'createdAt', 'invitedPlayers']) && newData.child('hostUid').isString() && newData.child('hostName').isString() && newData.child('hostName').val().length > 0 && newData.child('hostName').val().length <= 30 && (newData.child('format').val() === 'classic' || newData.child('format').val() === 'whoAmI') && (newData.child('status').val() === 'waiting' || newData.child('status').val() === 'started' || newData.child('status').val() === 'finished') && newData.child('createdAt').isNumber() && ((newData.child('format').val() === 'classic' && newData.child('questionCount').isNumber() && newData.child('questionCount').val() >= 5 && newData.child('questionCount').val() <= 30 && !newData.child('roundCount').exists()) || (newData.child('format').val() === 'whoAmI' && newData.child('roundCount').isNumber() && newData.child('roundCount').val() >= 1 && newData.child('roundCount').val() <= 15 && !newData.child('questionCount').exists())) && (newData.child('status').val() === 'waiting' || (newData.child('format').val() === 'classic' && newData.hasChildren(['phase', 'selectedQuestionIds', 'totalQuestions', 'currentQuestionIndex', 'questionStartedAt', 'players', 'scores']) && (newData.child('phase').val() === 'question' || newData.child('phase').val() === 'reveal' || newData.child('phase').val() === 'standings' || newData.child('phase').val() === 'finished') && newData.child('totalQuestions').isNumber() && newData.child('totalQuestions').val() >= 1 && newData.child('totalQuestions').val() <= 30 && newData.child('currentQuestionIndex').isNumber() && newData.child('currentQuestionIndex').val() >= 0 && newData.child('currentQuestionIndex').val() < newData.child('totalQuestions').val() && newData.child('questionStartedAt').isNumber()) || (newData.child('format').val() === 'whoAmI' && newData.hasChildren(['phase', 'selectedPlayerIds', 'totalRounds', 'currentRoundIndex', 'currentClueIndex', 'clueStartedAt', 'players', 'scores', 'whoAmIAttempts']) && (newData.child('phase').val() === 'clue' || newData.child('phase').val() === 'lastChance' || newData.child('phase').val() === 'reveal' || newData.child('phase').val() === 'standings' || newData.child('phase').val() === 'finished') && newData.child('totalRounds').isNumber() && newData.child('totalRounds').val() >= 1 && newData.child('totalRounds').val() <= 15 && newData.child('currentRoundIndex').isNumber() && newData.child('currentRoundIndex').val() >= 0 && newData.child('currentRoundIndex').val() < newData.child('totalRounds').val() && newData.child('currentClueIndex').isNumber() && newData.child('currentClueIndex').val() >= 0 && newData.child('currentClueIndex').val() <= 9 && newData.child('clueStartedAt').isNumber() && (newData.child('phase').val() !== 'lastChance' || (newData.child('lastPlayerStandingUid').isString() && newData.child('lastChanceStartedAt').isNumber())))))",
        "hostUid": {
          ".validate": "newData.isString() && (!data.exists() || newData.val() === data.val())"
        },
        "status": {
          ".validate": "newData.val() === 'waiting' || newData.val() === 'started' || newData.val() === 'finished'"
        },
        "phase": {
          ".validate": "newData.val() === 'question' || newData.val() === 'clue' || newData.val() === 'lastChance' || newData.val() === 'reveal' || newData.val() === 'standings' || newData.val() === 'finished'"
        },
        "invitedPlayers": {
          "$uid": {
            ".validate": "newData.hasChildren(['name', 'status']) && newData.child('name').isString() && newData.child('name').val().length > 0 && newData.child('name').val().length <= 30 && (newData.child('status').val() === 'pending' || newData.child('status').val() === 'accepted' || newData.child('status').val() === 'declined')",
            "status": {
              ".write": "auth != null && auth.uid === $uid && data.val() === 'pending' && (newData.val() === 'accepted' || newData.val() === 'declined')"
            }
          }
        },
        "selectedQuestionIds": {
          "$index": {
            ".validate": "newData.isString() && newData.val().length > 0 && newData.val().length <= 40"
          }
        },
        "selectedPlayerIds": {
          "$index": {
            ".validate": "newData.isString() && newData.val().length > 0 && newData.val().length <= 40"
          }
        },
        "players": {
          "$uid": {
            ".validate": "newData.hasChildren(['name']) && newData.child('name').isString() && newData.child('name').val().length > 0 && newData.child('name').val().length <= 30"
          }
        },
        "departure": {
          ".write": "auth != null && !data.exists() && root.child('games').child($gameId).child('status').val() === 'started' && root.child('games').child($gameId).child('players').child(auth.uid).exists() && newData.child('uid').val() === auth.uid && newData.child('name').val() === root.child('games').child($gameId).child('players').child(auth.uid).child('name').val()",
          ".validate": "newData.hasChildren(['uid', 'name', 'leftAt']) && newData.child('uid').val() === auth.uid && newData.child('name').val() === root.child('games').child($gameId).child('players').child(auth.uid).child('name').val() && newData.child('uid').isString() && newData.child('name').isString() && newData.child('name').val().length > 0 && newData.child('name').val().length <= 30 && newData.child('leftAt').isNumber()"
        },
        "scores": {
          "$uid": {
            ".validate": "newData.isNumber() && newData.val() >= 0"
          }
        },
        "answers": {
          "$questionIndex": {
            "$uid": {
              ".write": "auth != null && auth.uid === $uid && !data.exists() && root.child('games').child($gameId).child('status').val() === 'started' && root.child('games').child($gameId).child('phase').val() === 'question' && $questionIndex === root.child('games').child($gameId).child('currentQuestionIndex').val() + '' && now <= root.child('games').child($gameId).child('questionStartedAt').val() + 15000",
              ".validate": "auth != null && auth.uid === $uid && !data.exists() && newData.hasChildren(['optionIndex', 'answeredAt']) && newData.child('optionIndex').isNumber() && newData.child('optionIndex').val() >= 0 && newData.child('optionIndex').val() <= 3 && newData.child('answeredAt').isNumber() && root.child('games').child($gameId).child('phase').val() === 'question' && $questionIndex === root.child('games').child($gameId).child('currentQuestionIndex').val() + '' && now <= root.child('games').child($gameId).child('questionStartedAt').val() + 15000"
            }
          }
        },
        "questionResults": {
          "$questionIndex": {
            ".validate": "newData.hasChildren(['correctAnswerIndex', 'awardedPoints', 'finalizedAt']) && newData.child('correctAnswerIndex').isNumber() && newData.child('correctAnswerIndex').val() >= 0 && newData.child('correctAnswerIndex').val() <= 3 && newData.child('finalizedAt').isNumber()"
          }
        },
        "guessControl": {
          "$roundIndex": {
            ".write": "auth != null && root.child('games').child($gameId).child('players').child(auth.uid).exists() && root.child('games').child($gameId).child('format').val() === 'whoAmI' && root.child('games').child($gameId).child('status').val() === 'started' && root.child('games').child($gameId).child('phase').val() === 'clue' && $roundIndex === root.child('games').child($gameId).child('currentRoundIndex').val() + '' && ((!data.exists() && newData.child('state').val() === 'active' && newData.child('uid').val() === auth.uid && newData.child('name').val() === root.child('games').child($gameId).child('players').child(auth.uid).child('name').val() && newData.child('clueIndex').val() === root.child('games').child($gameId).child('currentClueIndex').val() && root.child('games').child($gameId).child('whoAmIAttempts').child($roundIndex).child(auth.uid).child('remainingLives').val() > 0 && now <= root.child('games').child($gameId).child('clueStartedAt').val() + 10000) || (data.exists() && data.child('state').val() === 'active' && data.child('uid').val() === auth.uid && newData.child('state').val() === 'wrong' && newData.child('uid').val() === auth.uid && newData.child('clueIndex').val() === data.child('clueIndex').val() && newData.child('startedAt').val() === data.child('startedAt').val() && newData.child('remainingClueMs').val() === data.child('remainingClueMs').val() && now <= data.child('startedAt').val() + 25000))",
            ".validate": "newData.hasChildren(['state', 'uid', 'name', 'clueIndex', 'remainingClueMs', 'startedAt']) && (newData.child('state').val() === 'active' || newData.child('state').val() === 'wrong') && newData.child('uid').isString() && newData.child('name').isString() && newData.child('name').val().length > 0 && newData.child('name').val().length <= 30 && newData.child('clueIndex').isNumber() && newData.child('clueIndex').val() >= 0 && newData.child('clueIndex').val() <= 9 && newData.child('remainingClueMs').isNumber() && newData.child('remainingClueMs').val() > 0 && newData.child('remainingClueMs').val() <= 10000 && newData.child('startedAt').isNumber() && (newData.child('state').val() === 'active' || (newData.child('guess').isString() && newData.child('guess').val().length > 0 && newData.child('guess').val().length <= 80 && newData.child('resolvedAt').isNumber()))"
          }
        },
        "whoAmIAttempts": {
          "$roundIndex": {
            "$uid": {
              ".write": "auth != null && auth.uid === $uid && root.child('games').child($gameId).child('players').child(auth.uid).exists() && root.child('games').child($gameId).child('format').val() === 'whoAmI' && root.child('games').child($gameId).child('status').val() === 'started' && $roundIndex === root.child('games').child($gameId).child('currentRoundIndex').val() + '' && ((root.child('games').child($gameId).child('phase').val() === 'clue' && data.child('remainingLives').val() > 0 && now <= root.child('games').child($gameId).child('clueStartedAt').val() + 10000) || (root.child('games').child($gameId).child('phase').val() === 'lastChance' && root.child('games').child($gameId).child('lastPlayerStandingUid').val() === auth.uid && !data.child('lastChanceUsed').exists() && now <= root.child('games').child($gameId).child('lastChanceStartedAt').val() + 25000))",
              ".validate": "newData.hasChildren(['remainingLives', 'guessCount']) && newData.child('remainingLives').isNumber() && newData.child('remainingLives').val() >= 0 && newData.child('remainingLives').val() <= 2 && newData.child('guessCount').isNumber() && newData.child('guessCount').val() >= 0 && newData.child('guessCount').val() <= 3 && ((!data.exists() && newData.child('remainingLives').val() === 2 && newData.child('guessCount').val() === 0) || (data.exists() && newData.child('guessCount').val() === data.child('guessCount').val() + 1 && ((root.child('games').child($gameId).child('phase').val() === 'clue' && newData.child('remainingLives').val() === data.child('remainingLives').val() - 1 && !newData.child('lastChanceUsed').exists()) || (root.child('games').child($gameId).child('phase').val() === 'lastChance' && newData.child('remainingLives').val() === data.child('remainingLives').val() && newData.child('lastChanceUsed').val() === true))))",
              "guesses": {
                "$guessIndex": {
                  ".validate": "newData.hasChildren(['guess', 'guessedAt', 'correct', 'mode']) && newData.child('guess').isString() && newData.child('guess').val().length > 0 && newData.child('guess').val().length <= 80 && newData.child('guessedAt').isNumber() && newData.child('correct').val() === false && (newData.child('mode').val() === 'normal' || newData.child('mode').val() === 'lastChance')"
                }
              }
            }
          }
        },
        "roundClaims": {
          "$roundIndex": {
            ".write": "auth != null && !data.exists() && root.child('games').child($gameId).child('players').child(auth.uid).exists() && root.child('games').child($gameId).child('format').val() === 'whoAmI' && root.child('games').child($gameId).child('status').val() === 'started' && $roundIndex === root.child('games').child($gameId).child('currentRoundIndex').val() + '' && ((root.child('games').child($gameId).child('phase').val() === 'clue' && root.child('games').child($gameId).child('guessControl').child($roundIndex).child('state').val() === 'active' && root.child('games').child($gameId).child('guessControl').child($roundIndex).child('uid').val() === auth.uid && now <= root.child('games').child($gameId).child('guessControl').child($roundIndex).child('startedAt').val() + 25000) || (root.child('games').child($gameId).child('phase').val() === 'lastChance' && root.child('games').child($gameId).child('lastPlayerStandingUid').val() === auth.uid && (newData.child('mode').val() === 'lastChance' || newData.child('mode').val() === 'lastChanceGiveUp') && now <= root.child('games').child($gameId).child('lastChanceStartedAt').val() + 25000) || (root.child('games').child($gameId).child('phase').val() === 'lastChance' && root.child('games').child($gameId).child('hostUid').val() === auth.uid && newData.child('mode').val() === 'lastChanceTimeout' && now >= root.child('games').child($gameId).child('lastChanceStartedAt').val() + 25000))",
            ".validate": "newData.hasChildren(['uid', 'guess', 'guessedAt', 'clueIndex', 'mode', 'points']) && newData.child('uid').val() === auth.uid && newData.child('guess').isString() && newData.child('guess').val().length > 0 && newData.child('guess').val().length <= 80 && newData.child('guessedAt').isNumber() && newData.child('clueIndex').isNumber() && newData.child('clueIndex').val() === root.child('games').child($gameId).child('currentClueIndex').val() && ((root.child('games').child($gameId).child('phase').val() === 'clue' && newData.child('mode').val() === 'normal' && newData.child('points').val() === (10 - newData.child('clueIndex').val()) * 100) || (root.child('games').child($gameId).child('phase').val() === 'lastChance' && ((newData.child('mode').val() === 'lastChance' && newData.child('points').val() === (10 - newData.child('clueIndex').val()) * 100) || ((newData.child('mode').val() === 'lastChanceGiveUp' || newData.child('mode').val() === 'lastChanceTimeout') && newData.child('points').val() === 0)))) && newData.child('points').isNumber()"
          }
        },
        "roundResults": {
          "$roundIndex": {
            ".validate": "newData.hasChildren(['playerId', 'reason', 'points', 'finalizedAt']) && newData.child('playerId').isString() && newData.child('playerId').val().length > 0 && (newData.child('reason').val() === 'correct' || newData.child('reason').val() === 'lastChanceCorrect' || newData.child('reason').val() === 'lastChanceWrong' || newData.child('reason').val() === 'lastChanceTimeout' || newData.child('reason').val() === 'lastChanceGiveUp' || newData.child('reason').val() === 'noWinner') && newData.child('points').isNumber() && newData.child('points').val() >= 0 && newData.child('points').val() <= 1000 && newData.child('finalizedAt').isNumber()"
          }
        }
      }
    },
    "invitations": {
      "$uid": {
        ".read": "auth != null && auth.uid === $uid",
        "$gameId": {
          ".write": "auth != null && ((!data.exists() && auth.uid !== $uid && newData.child('hostUid').val() === auth.uid && newData.child('gameId').val() === $gameId) || (data.exists() && !newData.exists() && (auth.uid === $uid || data.child('hostUid').val() === auth.uid)))",
          ".validate": "!newData.exists() || (newData.hasChildren(['gameId', 'hostUid', 'hostName', 'format', 'createdAt']) && newData.child('gameId').val() === $gameId && newData.child('hostUid').isString() && newData.child('hostName').isString() && newData.child('hostName').val().length > 0 && newData.child('hostName').val().length <= 30 && (newData.child('format').val() === 'classic' || newData.child('format').val() === 'whoAmI') && newData.child('createdAt').isNumber() && ((newData.child('format').val() === 'classic' && newData.child('questionCount').isNumber() && newData.child('questionCount').val() >= 5 && newData.child('questionCount').val() <= 30) || (newData.child('format').val() === 'whoAmI' && newData.child('roundCount').isNumber() && newData.child('roundCount').val() >= 1 && newData.child('roundCount').val() <= 15)))"
        }
      }
    }
  }
}
```

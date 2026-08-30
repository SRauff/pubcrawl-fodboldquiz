# Pubcrawl fodboldquiz

En mobile-first dansk multiplayer-fodboldquiz med pubcrawl-stemning. Spillere mødes i en realtime-lobby, opretter et spil, inviterer hinanden og kan spille **Klassisk quiz** sammen. Formatet **Gæt hvem jeg er** har fortsat kun den eksisterende placeholder.

## Projektstruktur

```text
index.html           Skærme, invitationsoverlay og quiz-UI
css/style.css        Mobile-first design og layout
js/app.js            Navigation, quizmotor og brugerflade
js/firebase.js       Firebase-login, presence og realtime game-state
data/questions.json  Lille pool med testspørgsmål
README.md            Projektdokumentation
```

## Test lokalt

Projektet kræver ingen installation eller build-proces. Start en simpel HTTP-server fra projektmappen:

```bash
python3 -m http.server 8000
```

Åbn derefter [http://localhost:8000](http://localhost:8000). Firebase-funktionerne kræver internetforbindelse. Frontend kan hostes direkte via GitHub Pages.

## Arkitektur

- Firebase Authentication identificerer automatisk hver browser med en anonym bruger.
- `lobbyPlayers/{uid}` indeholder online spillere. `onDisconnect()` registreres før online-posten skrives.
- `invitations/{playerUid}/{gameId}` indeholder aktive invitationer.
- `games/{gameId}` indeholder format, deltagere og den fælles quiz-state.
- `data/questions.json` indeholder spørgsmålstekst, svarmuligheder og facit. Firebase gemmer kun de valgte spørgsmåls-ID'er.
- Firebase `.info/serverTimeOffset` bruges sammen med `questionStartedAt`, så alle klienter beregner den samme 10-sekunders svarfrist.

Et startet klassisk spil indeholder blandt andet:

```text
status: "started"
phase: "question" | "reveal" | "standings" | "finished"
selectedQuestionIds
totalQuestions
currentQuestionIndex
questionStartedAt
players
scores
answers/{questionIndex}/{uid}
questionResults/{questionIndex}
```

Kun host-klienten vælger spørgsmål, afslutter et spørgsmål, beregner point og skifter fælles fase. Hver deltager kan kun oprette sit eget svar én gang. Korrekte svar sorteres efter Firebase-tidspunkt og derefter UID, så identiske timestamps håndteres deterministisk.

## Klassisk quiz-flow

1. Hosten vælger format, antal spørgsmål og deltagere.
2. Ved start vælges tilfældige spørgsmål uden dubletter. Et valg over poolens størrelse begrænses automatisk.
3. Alle ser samme spørgsmål og samme 10-sekunders periode.
4. Svaret låses efter første klik. Spørgsmålet afsluttes, når alle har svaret, eller tiden er gået.
5. Alle ser facit, eget svar og optjente point.
6. Hosten viser stillingen og starter næste spørgsmål.
7. Efter sidste spørgsmål vises en fælles slutstilling og vinder.
8. Hver deltager kan rydde sin lokale game-state og gå tilbage til lobbyen uden at ændre presence.

Point gives kun for korrekte svar. Hvis `N` spillere svarer korrekt, får den hurtigste `N × 100`, den næste `(N - 1) × 100` og så videre.

## Test Milepæl 4

Brug to separate browser-sessioner, så Firebase Authentication opretter forskellige anonyme brugere, eksempelvis Chrome normal + inkognito eller Chrome + Safari.

1. Gå i lobbyen som **Sebastian** og **Martin**.
2. Lad Sebastian oprette Klassisk quiz og invitere Martin.
3. Lad Martin acceptere, og start som Sebastian.
4. Kontrollér, at begge ser samme spørgsmål og næsten samme tid.
5. Test korrekte svar med forskellig hastighed, forkert svar, dobbeltklik og en timeout uden svar.
6. Kontrollér facit, point og fælles stilling efter hvert spørgsmål.
7. Spil sidste spørgsmål og kontrollér slutstillingen.
8. Gå tilbage til lobbyen i begge sessioner, opret et nyt spil og kontrollér, at invitationen kun vises én gang.

Test også det eksisterende flow for afvisning, annullering og **Gæt hvem jeg er**-placeholderen.

## Kendte begrænsninger

- Spørgsmålspoolen indeholder kun 10 testspørgsmål.
- **Gæt hvem jeg er** har endnu ingen quizmotor.
- Hosten er autoritativ. Hvis hosten lukker browseren under quizzen, stopper progressionen.
- Quizlogik og facit ligger i frontend, fordi projektet ikke har en backend. Det er passende til denne prototype, men beskytter ikke mod bevidst snyd.
- Afsluttede game-noder bevares i Firebase, så alle deltagere kan se slutstillingen og forlade i eget tempo. Automatisk server-side oprydning er ikke implementeret endnu.

## Firebase Console

Anonymous Authentication skal være aktiveret. Milepæl 4 kræver udvidede regler, fordi hosten skriver fælles quiz-state og scores, mens hver spiller skriver sit eget svar. Databasen må ikke gøres globalt åben.

Indsæt hele denne regelblok under **Realtime Database → Rules** og klik **Publish**:

```json
{
  "rules": {
    ".read": false,
    ".write": false,
    "lobbyPlayers": {
      ".read": "auth != null",
      "$uid": {
        ".write": "auth != null && auth.uid === $uid",
        ".validate": "!newData.exists() || (newData.hasChildren(['name', 'joinedAt']) && newData.child('name').isString() && newData.child('name').val().length > 0 && newData.child('name').val().length <= 30 && newData.child('joinedAt').isNumber())"
      }
    },
    "games": {
      "$gameId": {
        ".read": "auth != null && (!data.exists() || data.child('hostUid').val() === auth.uid || data.child('invitedPlayers').child(auth.uid).exists())",
        ".write": "auth != null && ((!data.exists() && newData.child('hostUid').val() === auth.uid) || (data.exists() && data.child('hostUid').val() === auth.uid && (!newData.exists() || newData.child('hostUid').val() === auth.uid)))",
        ".validate": "!newData.exists() || (newData.hasChildren(['hostUid', 'hostName', 'format', 'status', 'createdAt', 'invitedPlayers']) && newData.child('hostUid').isString() && newData.child('hostName').isString() && newData.child('hostName').val().length > 0 && newData.child('hostName').val().length <= 30 && (newData.child('format').val() === 'classic' || newData.child('format').val() === 'whoAmI') && (newData.child('status').val() === 'waiting' || newData.child('status').val() === 'started' || newData.child('status').val() === 'finished') && newData.child('createdAt').isNumber() && ((newData.child('format').val() === 'classic' && newData.child('questionCount').isNumber() && newData.child('questionCount').val() >= 5 && newData.child('questionCount').val() <= 30 && !newData.child('roundCount').exists()) || (newData.child('format').val() === 'whoAmI' && newData.child('roundCount').isNumber() && newData.child('roundCount').val() >= 1 && newData.child('roundCount').val() <= 15 && !newData.child('questionCount').exists())) && (newData.child('status').val() === 'waiting' || newData.child('format').val() === 'whoAmI' || (newData.hasChildren(['phase', 'selectedQuestionIds', 'totalQuestions', 'currentQuestionIndex', 'questionStartedAt', 'players', 'scores']) && (newData.child('phase').val() === 'question' || newData.child('phase').val() === 'reveal' || newData.child('phase').val() === 'standings' || newData.child('phase').val() === 'finished') && newData.child('totalQuestions').isNumber() && newData.child('totalQuestions').val() >= 1 && newData.child('totalQuestions').val() <= 30 && newData.child('currentQuestionIndex').isNumber() && newData.child('currentQuestionIndex').val() >= 0 && newData.child('currentQuestionIndex').val() < newData.child('totalQuestions').val() && newData.child('questionStartedAt').isNumber())))",
        "hostUid": {
          ".validate": "newData.isString() && (!data.exists() || newData.val() === data.val())"
        },
        "status": {
          ".validate": "newData.val() === 'waiting' || newData.val() === 'started' || newData.val() === 'finished'"
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
        "players": {
          "$uid": {
            ".validate": "newData.hasChildren(['name']) && newData.child('name').isString() && newData.child('name').val().length > 0 && newData.child('name').val().length <= 30"
          }
        },
        "scores": {
          "$uid": {
            ".validate": "newData.isNumber() && newData.val() >= 0"
          }
        },
        "answers": {
          "$questionIndex": {
            "$uid": {
              ".write": "auth != null && auth.uid === $uid && !data.exists() && root.child('games').child($gameId).child('status').val() === 'started' && root.child('games').child($gameId).child('phase').val() === 'question' && $questionIndex === root.child('games').child($gameId).child('currentQuestionIndex').val() + '' && now <= root.child('games').child($gameId).child('questionStartedAt').val() + 10000",
              ".validate": "auth != null && auth.uid === $uid && !data.exists() && newData.hasChildren(['optionIndex', 'answeredAt']) && newData.child('optionIndex').isNumber() && newData.child('optionIndex').val() >= 0 && newData.child('optionIndex').val() <= 3 && newData.child('answeredAt').isNumber() && root.child('games').child($gameId).child('phase').val() === 'question' && $questionIndex === root.child('games').child($gameId).child('currentQuestionIndex').val() + '' && now <= root.child('games').child($gameId).child('questionStartedAt').val() + 10000"
            }
          }
        },
        "questionResults": {
          "$questionIndex": {
            ".validate": "newData.hasChildren(['correctAnswerIndex', 'awardedPoints', 'finalizedAt']) && newData.child('correctAnswerIndex').isNumber() && newData.child('correctAnswerIndex').val() >= 0 && newData.child('correctAnswerIndex').val() <= 3 && newData.child('finalizedAt').isNumber()"
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

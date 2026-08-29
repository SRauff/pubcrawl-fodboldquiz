# Pubcrawl fodboldquiz

En mobile-first dansk multiplayer-fodboldquiz med pubcrawl-stemning. Spillere mødes i en realtime-lobby, kan oprette et spil, invitere hinanden og samles i en pre-game lobby. Selve quizzen kommer i en senere milepæl.

## Projektstruktur

```text
index.html       Sidens indhold, skærme og invitationsoverlay
css/style.css    Mobile-first design og layout
js/app.js        Navigation, validering og brugerflade
js/firebase.js   Firebase-konfiguration, login, presence og spildata
README.md        Projektdokumentation
```

## Test lokalt

Projektet kræver ingen installation eller build-proces. Start en simpel HTTP-server fra projektmappen:

```bash
python3 -m http.server 8000
```

Åbn derefter [http://localhost:8000](http://localhost:8000). Firebase-funktionerne kræver internetforbindelse. Frontend kan hostes direkte via GitHub Pages.

## Arkitektur

- Firebase Authentication identificerer automatisk hver browser med en anonym bruger.
- `lobbyPlayers/{uid}` indeholder online spillere. `onDisconnect()` registreres før online-posten skrives og fjerner den ved tabt forbindelse. Aktiv navigation ud af lobbyen venter desuden på en eventuel igangværende reconnect-skrivning, før posten fjernes.
- `games/{gameId}` indeholder host, format, indstilling, status og inviterede spilleres svar.
- `invitations/{playerUid}/{gameId}` indeholder den enkelte spillers aktive invitationer.
- Realtime-listeners opdaterer lobby, invitationsoverlay og pre-game lobby uden sidegenindlæsning.

Spil og invitationer oprettes med en atomisk Firebase-opdatering, så de relaterede databaseplaceringer enten skrives samlet eller slet ikke. Derfor skal reglerne tillade både hostens skrivning til `games/{gameId}` og hostens oprettelse under den inviterede spillers `invitations/{uid}/{gameId}`. Hvis én af stierne afvises, returnerer Firebase `PERMISSION_DENIED`, og hele opdateringen annulleres.

## Spilflow

Hosten vælger **Klassisk quiz** med 5–30 spørgsmål eller **Gæt hvem jeg er** med 1–15 runder. Derefter vælges mindst én anden online spiller. Inviterede spillere kan acceptere eller afvise i hjemmesidens invitationsoverlay.

Accepterede spillere vises som klar i pre-game lobbyen. Når mindst én spiller har accepteret, kan hosten starte. Alle deltagere sendes da til en placeholder-skærm; quizspørgsmål og point er ikke implementeret endnu.

## Test Milepæl 3

Brug to separate browser-sessioner, så Firebase Authentication opretter forskellige anonyme brugere. To almindelige faner i samme browserprofil kan genbruge samme UID og er ikke en pålidelig multiplayer-test.

1. Åbn localhost i eksempelvis Chrome og Safari eller Chrome normal og Chrome inkognito.
2. Gå i lobbyen som **Sebastian** og **Martin**.
3. Kontrollér, at begge kan se hinanden.
4. Lad Sebastian oprette en klassisk quiz med 10 spørgsmål og invitere Martin.
5. Accepter invitationen som Martin.
6. Kontrollér, at begge ser pre-game lobbyen, og at Martin står som klar.
7. Start spillet som Sebastian, og kontrollér, at begge ser **Spillet er klar!**.

Gentag desuden med **Afvis**, og kontrollér at spilleren bliver i lobbyen. Opret et nyt spil og vælg **Annuller spil** som host; begge sessioner skal vende tilbage til lobbyen. Prøv også spillervalg uden andre online og knappen uden valgte spillere.

## Firebase Console

Anonymous Authentication skal være aktiveret. Realtime Database-reglerne skal give autentificerede brugere den nødvendige, begrænsede adgang til `lobbyPlayers`, `games` og deres egne invitationer. Databasen må ikke gøres globalt åben.

Milepæl 3 kræver, at hosten kan oprette et spil og skrive invitationer til de valgte spilleres stier, mens kun den inviterede spiller kan ændre sit eget svar. Game-reglens `!data.exists()` gør det desuden muligt for en eksisterende listener at modtage et tomt snapshot, når hosten med vilje sletter spillet. En tom node indeholder ingen spildata og er fortsat kun læsbar for autentificerede brugere. Indsæt følgende afgrænsede regler i Firebase Console under **Realtime Database → Rules** og klik **Publish**:

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
        ".write": "auth != null && ((!data.exists() && newData.child('hostUid').val() === auth.uid) || (data.exists() && data.child('hostUid').val() === auth.uid && !newData.exists()))",
        ".validate": "!newData.exists() || (newData.hasChildren(['hostUid', 'hostName', 'format', 'status', 'createdAt', 'invitedPlayers']) && newData.child('hostUid').isString() && newData.child('hostName').isString() && newData.child('hostName').val().length > 0 && newData.child('hostName').val().length <= 30 && (newData.child('format').val() === 'classic' || newData.child('format').val() === 'whoAmI') && (newData.child('status').val() === 'waiting' || newData.child('status').val() === 'started') && newData.child('createdAt').isNumber() && ((newData.child('format').val() === 'classic' && newData.child('questionCount').isNumber() && newData.child('questionCount').val() >= 5 && newData.child('questionCount').val() <= 30 && !newData.child('roundCount').exists()) || (newData.child('format').val() === 'whoAmI' && newData.child('roundCount').isNumber() && newData.child('roundCount').val() >= 1 && newData.child('roundCount').val() <= 15 && !newData.child('questionCount').exists())))",
        "status": {
          ".write": "auth != null && root.child('games').child($gameId).child('hostUid').val() === auth.uid && data.val() === 'waiting' && newData.val() === 'started'"
        },
        "invitedPlayers": {
          "$uid": {
            ".validate": "newData.hasChildren(['name', 'status']) && newData.child('name').isString() && newData.child('name').val().length > 0 && newData.child('name').val().length <= 30 && (newData.child('status').val() === 'pending' || newData.child('status').val() === 'accepted' || newData.child('status').val() === 'declined')",
            "status": {
              ".write": "auth != null && auth.uid === $uid && data.val() === 'pending' && (newData.val() === 'accepted' || newData.val() === 'declined')"
            }
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

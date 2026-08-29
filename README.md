# Pubcrawl fodboldquiz

En mobile-first dansk multiplayer-fodboldquiz med pubcrawl-stemning. I den nuværende milepæl kan spillere indtaste deres navn og mødes i en fælles online-lobby.

## Projektstruktur

```text
index.html       Sidens indhold og skærme
css/style.css    Mobile-first design og layout
js/app.js        Validering, navigation og lobbyens brugerflade
js/firebase.js   Firebase-konfiguration, login, realtime-data og presence
README.md        Projektdokumentation
```

## Test lokalt

Projektet kræver ingen installation eller build-proces. Start en simpel HTTP-server fra projektmappen, for eksempel med Python 3:

```bash
python3 -m http.server 8000
```

Åbn derefter [http://localhost:8000](http://localhost:8000) i en browser. Stop serveren igen med `Ctrl+C`.

Firebase-funktionerne kræver internetforbindelse. Frontend kan hostes direkte via GitHub Pages.

## Arkitektur

- GitHub Pages skal hoste den statiske frontend.
- Firebase Authentication identificerer automatisk hver browser med en anonym bruger.
- Firebase Realtime Database gemmer spillerne under `lobbyPlayers/{uid}` og opdaterer lobbyen i realtime.
- Firebase-funktionen `onDisconnect()` fjerner spillerens post, hvis forbindelsen eller browserfanen lukkes. Ved genforbindelse registreres oprydningen igen, før spilleren markeres online.

Spil, invitationer og quizfunktioner er endnu ikke implementeret.

## Test multiplayer-lobbyen

Brug to separate browser-sessioner, så Firebase Authentication opretter to forskellige anonyme brugere. To faner i samme normale browservindue kan genbruge samme bruger og er derfor ikke en pålidelig multiplayer-test.

1. Åbn localhost-adressen i for eksempel et normalt Chrome-vindue.
2. Åbn den samme adresse i Chrome inkognito, Safari eller en anden browserprofil.
3. Indtast forskellige spillernavne, og gå til lobbyen i begge sessioner.
4. Kontrollér, at begge navne vises i begge lobbyer.
5. Tryk **Tilbage** i den ene session, og kontrollér, at spilleren forsvinder fra den anden lobby.
6. Gå ind i lobbyen igen, og kontrollér, at spilleren dukker op igen.

Anonymous Authentication skal være aktiveret i Firebase Console. Realtime Database-reglerne skal tillade autentificerede brugere at læse `lobbyPlayers` og kun skrive til deres egen UID.

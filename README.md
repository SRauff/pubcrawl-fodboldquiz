# Pubcrawl fodboldquiz

En mobile-first prototype til en dansk multiplayer-fodboldquiz med pubcrawl-stemning. I den nuværende milepæl kan en spiller indtaste sit navn og gå videre til en enkel lokal lobby.

## Projektstruktur

```text
index.html      Sidens indhold og skærme
css/style.css   Mobile-first design og layout
js/app.js       Validering, navigation og lokal lagring
README.md       Projektdokumentation
```

## Test lokalt

Projektet kræver ingen installation eller build-proces. Start en simpel HTTP-server fra projektmappen, for eksempel med Python 3:

```bash
python3 -m http.server 8000
```

Åbn derefter [http://localhost:8000](http://localhost:8000) i en browser. Stop serveren igen med `Ctrl+C`.

Projektets frontend skal senere hostes gratis via GitHub Pages.

## Planlagt arkitektur

- GitHub Pages skal hoste den statiske frontend.
- Firebase Authentication skal senere bruges til anonym spilleridentifikation.
- Firebase Realtime Database skal senere håndtere lobby, invitationer og live-spil.

Firebase og multiplayer er ikke implementeret i denne milepæl.

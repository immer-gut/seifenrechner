# Seifenrechner

Ein neuer, browserbasierter Seifenrechner als Docker-Webstack. Der alte
WinForms/Access-Rechner diente nur als fachlicher Anhaltspunkt für Kategorien,
SAP-Werte, Überfettung, Wasser, Schwund und Kosten.

## Funktionen

- Rezeptberechnung für NaOH und KOH
- Überfettung, Laugenreinheit, Wasserfaktor und Schwund
- Zutatenkategorien für Fette/Öle, Duft, Farbe, Flüssigkeit und Sonstiges
- Kostenrechnung inklusive Lauge und Kosten pro 100 g fertiger Seife
- Rezeptverwaltung im Browser per `localStorage`
- JSON Export/Import und Druckansicht
- Dockerfile, Compose und Stack-Datei

## Lokal starten

```powershell
docker compose up --build
```

Danach ist die Website unter <http://localhost:8080> erreichbar.

## Als Docker Stack starten

`docker stack deploy` baut keine Images. Erst lokal bauen, dann deployen:

```powershell
docker build -t seifenrechner:latest .
docker stack deploy -c stack.yaml seifenrechner
```

## Tests

```powershell
npm test
```

Die Tests prüfen die reine Rechnerlogik. Die Website selbst ist eine statische
App ohne Server-Backend.


# Seifenrechner

Ein neuer, browserbasierter Seifenrechner als Docker-Webstack. Der alte
WinForms/Access-Rechner diente nur als fachlicher Anhaltspunkt fuer Kategorien,
SAP-Werte, Ueberfettung, Wasser, Schwund und Kosten.

## Funktionen

- Rezeptberechnung fuer NaOH und KOH
- Ueberfettung, Laugenreinheit, Wasserfaktor und Schwund
- Zutatenkategorien fuer Fette/Oele, Duft, Farbe, Fluessigkeit und Sonstiges
- Kostenrechnung inklusive Lauge und Kosten pro 100 g fertiger Seife
- Rezeptverwaltung im Browser per `localStorage`
- JSON Export/Import und Druckansicht
- Dockerfile, Compose, Portainer-Stack und Swarm-Stack

## Lokal starten

```powershell
docker compose up --build
```

Danach ist die Website unter <http://localhost:8082> erreichbar.

## Portainer

Fuer Portainer im normalen Docker-Standalone-Modus die Datei
`portainer-stack.yaml` verwenden:

```yaml
services:
  seifenrechner:
    image: ghcr.io/immer-gut/seifenrechner:latest
    container_name: seifenrechner
    ports:
      - "8082:80"
    restart: unless-stopped
```

In Portainer:

1. Stacks -> Add stack
2. Repository oder Web editor verwenden
3. `portainer-stack.yaml` als Compose-Datei auswaehlen/einfuegen
4. Deploy the stack

Das Image wird per GitHub Actions nach GHCR gebaut:

```text
ghcr.io/immer-gut/seifenrechner:latest
ghcr.io/immer-gut/seifenrechner:<version>
```

## Docker Swarm / Portainer Swarm

Fuer Swarm die Datei `stack.yaml` verwenden:

```powershell
docker stack deploy -c stack.yaml seifenrechner
```

`docker stack deploy` baut keine Images. Genau deshalb zeigt `stack.yaml` auf
das GHCR-Image und nicht auf ein lokales `seifenrechner:latest`, weil wir uns
diesen Klassiker sparen.

## Tests

```powershell
npm test
```

Die Tests pruefen die reine Rechnerlogik. Die Website selbst ist eine statische
App ohne Server-Backend.

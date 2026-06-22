# Seifenrechner

Ein neuer, browserbasierter Seifenrechner als Docker-Webstack. Der alte
WinForms/Access-Rechner diente nur als fachlicher Anhaltspunkt fuer Kategorien,
SAP-Werte, Ueberfettung, Wasser und Schwund.

## Funktionen

- Rezeptberechnung fuer NaOH und KOH
- Ueberfettung, Laugenreinheit, Wasserfaktor und Schwund
- Herstellungsdatum mit berechnetem Reifeende
- Nachtraegliche Bewertung als `Note` mit Bemerkung
- Suche in gespeicherten Rezepten nach Name, Zutaten/Inhalten, Datum und Note
- Gespeicherte Rezepte koennen geklont, angepasst und als neues Rezept
  gespeichert werden
- Druckansicht als kompakte A4-Querformatseite nach Vorbild des alten
  XLS/XLSX-Druckexports
- Zutatenkategorien fuer Fette/Oele, Duft, Farbe, Fluessigkeit und Sonstiges
- Importierte Altdaten aus der Access-Datenbank `Seifenrechner.mdb`
- Bereinigter Zutatenkatalog ohne Preisfelder und offensichtliche Dubletten
- Getrennter Zutatenkatalog: Zutaten anlegen/pflegen, danach im Rezept nur noch
  Zutat auswaehlen und Gramm eintragen
- Sichtbarer Versionsstand in der Website
- Rezeptverwaltung im Browser per `localStorage`
- JSON Export/Import und Druckansicht
- Dockerfile, Compose, Portainer-Stack und Swarm-Stack

## Altdaten

Die App bringt die aus `db_xls/Seifenrechner.mdb` extrahierten Startdaten mit:

- 17 alte Rezepte aus `tbl_RName` und `tbl_Rezept`
- 1 zusaetzliches Excel-only-Rezept aus `Seifenrechner.xlsx`
- 133 bereinigte alte Zutaten aus `tbl_Zt`
- Alte Rezeptpositionen aus den relationalen MDB-Daten, auf den bereinigten
  Zutatenkatalog gemappt

Die MDB wurde ohne Microsoft Access ueber UCanAccess/Jackcess ausgelesen. Ja,
Access-Dateien aus 2015 sind weiterhin ein kleines Geschenk an die Nachwelt,
aber immerhin jetzt ein versioniertes.

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

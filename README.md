# CollageJS

Progressive Web App (PWA) zum Erstellen von Fotocollagen direkt im Smartphone-Browser. Mehrere Bilder auswählen, Layout wählen, Vorschau ansehen und die Collage in der Fotomediathek speichern.

## Funktionen

- Mehrere Fotos aus der Galerie hinzufügen
- **Zielformate**: Instagram, Story, Pinterest, Facebook, TikTok, A4 u. a.
- In der Vorschau: Reihenfolge tauschen, Bild positionieren und zoomen
- Verschiedene Collage-Layouts (2er, 3er, 4er, Raster, Highlight-Layouts)
- Abstand und Hintergrundfarbe anpassen
- Live-Vorschau
- Speichern über das native Teilen-Menü (empfohlen auf iOS/Android) oder Download
- Installierbar als PWA (Offline-Grundfunktionen)

## GitHub Pages

1. Repository auf GitHub pushen
2. Unter **Settings → Pages → Build and deployment** die Quelle **GitHub Actions** wählen
3. Nach Push auf `main` deployt der Workflow automatisch

Die App ist dann erreichbar unter:

`https://<benutzername>.github.io/CollageJS/`

(Repository-Name anpassen, falls abweichend.)

## Lokal testen

```bash
npx --yes serve .
```

Dann im Browser öffnen (für PWA-Features HTTPS oder localhost nutzen).

## Speichern in der Fotomediathek

Auf **iOS** und **Android** öffnet „In Fotomediathek speichern“ das System-Teilen-Menü. Dort **„Bild speichern“**, **„In Fotos“** oder die Fotos-App wählen.

Falls Teilen nicht verfügbar ist, wird die Collage heruntergeladen. Auf dem iPhone kann das Bild anschließend per langem Drücken in Fotos gespeichert werden.

## Technik

- Vanilla JavaScript (ES Modules)
- Canvas API für Collage-Rendering
- Web Share API mit Dateien (`navigator.share`)
- Service Worker für Offline-Cache
- GitHub Actions → GitHub Pages

## Lizenz

MIT

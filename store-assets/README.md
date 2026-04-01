# Store Assets

## How to export SVG to PNG

Chrome Web Store requires PNG images. To convert:

### Option 1: Browser screenshot
1. Open the SVG file in Chrome
2. Right-click → "Open image in new tab"
3. Use Cmd+Shift+4 (Mac) or Snipping Tool (Windows) to capture at exact size

### Option 2: Command line (requires Inkscape or rsvg-convert)
```bash
# Using rsvg-convert (install via: brew install librsvg)
rsvg-convert -w 440 -h 280 promo-small-440x280.svg > promo-small-440x280.png
rsvg-convert -w 1400 -h 560 promo-marquee-1400x560.svg > promo-marquee-1400x560.png
```

### Option 3: Using Chrome headless
```bash
# Screenshot at exact dimensions
chrome --headless --screenshot=promo-small-440x280.png --window-size=440,280 promo-small-440x280.svg
chrome --headless --screenshot=promo-marquee-1400x560.png --window-size=1400,560 promo-marquee-1400x560.svg
```

## Required store assets

| Asset | Size | Status |
|-------|------|--------|
| Extension icon | 128x128 PNG | Done (icons/icon128.png) |
| Small promo tile | 440x280 PNG | SVG ready, export to PNG |
| Marquee promo tile | 1400x560 PNG | SVG ready, export to PNG |
| Screenshot 1 | 1280x800 PNG | Manual: capture main UI |
| Screenshot 2 | 1280x800 PNG | Manual: capture responses view |
| Screenshot 3 | 1280x800 PNG | Manual: capture export/debug |

## Screenshots guide

1. Open the extension in a tab (click the AskAll icon)
2. Resize browser window to 1280x800
3. **Screenshot 1**: Show the clean input panel with all AI providers selected
4. **Screenshot 2**: After sending a question, capture the responses streaming in
5. **Screenshot 3**: Show the export dropdown or debug output

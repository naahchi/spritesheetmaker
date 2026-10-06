# Sprite Animation Maker

A zero-backend, browser-based sprite animation and sprite-sheet tool.

## Run

No installation is required.

1. Extract the ZIP.
2. Open `index.html` in Chrome/Edge/Firefox.
3. Choose 12, 24, 30, 60, or Custom frames.
4. Add images or drag them into the frame area.
5. Set frame size, columns and FPS.
6. Preview the animation.
7. Generate and download the PNG sprite sheet.
8. Copy the generated JavaScript Canvas animation code.

## Important

Everything runs locally in the browser. Images are not uploaded to a server.

## Project structure

- `index.html` — UI
- `css/style.css` — styling
- `js/app.js` — frame management, animation, sprite-sheet generation and code generation

## Current export behavior

Images are fitted proportionally inside each frame cell. This prevents distortion but means images with different aspect ratios may have transparent/empty space around them.

For a game, consistent source image dimensions are recommended.

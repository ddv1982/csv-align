#!/bin/bash
# Generate app icons from SVG

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ICONS_DIR="$SCRIPT_DIR/icons"
SVG_FILE="$ICONS_DIR/icon.svg"

echo "Generating app icons from $SVG_FILE..."

# Check if we have the required tools
if ! command -v rsvg-convert &> /dev/null; then
    echo "Installing librsvg..."
    brew install librsvg
fi

# Create PNG icons
echo "Creating PNG icons..."
rsvg-convert -w 32 -h 32 "$SVG_FILE" -o "$ICONS_DIR/32x32.png"
rsvg-convert -w 128 -h 128 "$SVG_FILE" -o "$ICONS_DIR/128x128.png"
rsvg-convert -w 256 -h 256 "$SVG_FILE" -o "$ICONS_DIR/128x128@2x.png"
rsvg-convert -w 512 -h 512 "$SVG_FILE" -o "$ICONS_DIR/icon.png"
rsvg-convert -w 1024 -h 1024 "$SVG_FILE" -o "$ICONS_DIR/icon_1024.png"

# Create macOS iconset directory
echo "Creating macOS iconset..."
ICONSET_DIR="$ICONS_DIR/icon.iconset"
mkdir -p "$ICONSET_DIR"

# Generate iconset files
rsvg-convert -w 16 -h 16 "$SVG_FILE" -o "$ICONSET_DIR/icon_16x16.png"
rsvg-convert -w 32 -h 32 "$SVG_FILE" -o "$ICONSET_DIR/icon_16x16@2x.png"
rsvg-convert -w 32 -h 32 "$SVG_FILE" -o "$ICONSET_DIR/icon_32x32.png"
rsvg-convert -w 64 -h 64 "$SVG_FILE" -o "$ICONSET_DIR/icon_32x32@2x.png"
rsvg-convert -w 128 -h 128 "$SVG_FILE" -o "$ICONSET_DIR/icon_128x128.png"
rsvg-convert -w 256 -h 256 "$SVG_FILE" -o "$ICONSET_DIR/icon_128x128@2x.png"
rsvg-convert -w 256 -h 256 "$SVG_FILE" -o "$ICONSET_DIR/icon_256x256.png"
rsvg-convert -w 512 -h 512 "$SVG_FILE" -o "$ICONSET_DIR/icon_256x256@2x.png"
rsvg-convert -w 512 -h 512 "$SVG_FILE" -o "$ICONSET_DIR/icon_512x512.png"
rsvg-convert -w 1024 -h 1024 "$SVG_FILE" -o "$ICONSET_DIR/icon_512x512@2x.png"

# Create ICNS file for macOS
echo "Creating ICNS file..."
iconutil -c icns "$ICONSET_DIR" -o "$ICONS_DIR/icon.icns"

# Create Windows ICO file (requires ImageMagick)
if command -v convert &> /dev/null; then
    echo "Creating ICO file..."
    convert "$ICONSET_DIR/icon_16x16.png" \
            "$ICONSET_DIR/icon_32x32.png" \
            "$ICONSET_DIR/icon_48x48.png" \
            "$ICONSET_DIR/icon_256x256.png" \
            "$ICONS_DIR/icon.ico"
else
    echo "Note: ImageMagick not found, skipping ICO file generation"
fi

# Clean up iconset directory
rm -rf "$ICONSET_DIR"

echo "Done! Generated icons:"
ls -la "$ICONS_DIR"

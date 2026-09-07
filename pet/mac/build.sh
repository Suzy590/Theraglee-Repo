#!/bin/bash
# Rebuild Pip from source: binary → icon → app bundle.
set -e
cd "$(dirname "$0")"

# Both chip types, then welded together, so one Pip.app runs natively on Apple
# Silicon and on every Intel Mac. Building only for the host would quietly ship
# a bundle that Intel machines refuse to open.
echo "==> compiling for Apple Silicon"
swiftc -O pet.swift -o pet-arm64 -target arm64-apple-macos12

echo "==> compiling for Intel"
if swiftc -O pet.swift -o pet-x86_64 -target x86_64-apple-macos12 2>/tmp/pip-intel.log; then
  echo "==> combining into a universal binary"
  lipo -create pet-arm64 pet-x86_64 -output pet
  rm -f pet-arm64 pet-x86_64
else
  echo "!!  the Intel slice would not build; shipping Apple Silicon only."
  echo "!!  (install the full Xcode command line tools to get both)"
  sed 's/^/!!  /' /tmp/pip-intel.log | head -5
  mv pet-arm64 pet
fi
lipo -info pet

echo "==> rendering icon"
rm -rf Pip.iconset && mkdir -p Pip.iconset
for s in 16 32 64 128 256 512 1024; do ./pet --icon $s "Pip.iconset/icon_${s}x${s}.png"; done
cp Pip.iconset/icon_32x32.png     Pip.iconset/icon_16x16@2x.png
cp Pip.iconset/icon_64x64.png     Pip.iconset/icon_32x32@2x.png
cp Pip.iconset/icon_256x256.png   Pip.iconset/icon_128x128@2x.png
cp Pip.iconset/icon_512x512.png   Pip.iconset/icon_256x256@2x.png
cp Pip.iconset/icon_1024x1024.png Pip.iconset/icon_512x512@2x.png
rm Pip.iconset/icon_64x64.png Pip.iconset/icon_1024x1024.png
iconutil -c icns Pip.iconset -o Pip.icns

echo "==> assembling Pip.app"
mkdir -p Pip.app/Contents/MacOS Pip.app/Contents/Resources
cp pet Pip.app/Contents/MacOS/Pip
cp Pip.icns Pip.app/Contents/Resources/Pip.icns

# Without this the bundle still launches, but it has no identifier — so its
# saved animal and color land in a different preferences domain — and no icon
# in Finder. It has to be written here, not just left lying in the working copy.
cat > Pip.app/Contents/Info.plist <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleName</key>            <string>Pip</string>
    <key>CFBundleDisplayName</key>     <string>Pip</string>
    <key>CFBundleExecutable</key>      <string>Pip</string>
    <key>CFBundleIdentifier</key>      <string>local.desktoppet.pip</string>
    <key>CFBundleIconFile</key>        <string>Pip</string>
    <key>CFBundlePackageType</key>     <string>APPL</string>
    <key>CFBundleShortVersionString</key><string>1.0</string>
    <key>CFBundleVersion</key>         <string>1</string>
    <key>LSMinimumSystemVersion</key>  <string>12.0</string>
    <key>LSUIElement</key>             <true/>
    <key>NSHighResolutionCapable</key> <true/>
</dict>
</plist>
PLIST
codesign --force --deep -s - Pip.app
rm -rf Pip.iconset

echo "==> packaging for the website"
rm -f Pip.app.zip
ditto -c -k --keepParent Pip.app Pip.app.zip

echo "==> done. double-click Pip.app  (Pip.app.zip is the one to upload)"

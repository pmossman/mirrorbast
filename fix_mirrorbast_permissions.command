#!/bin/bash
# This script attempts to fix the "damaged" error for Mirrorbast.app
# by removing quarantine attributes added by macOS upon download.

# Get the directory where this script is located
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &> /dev/null && pwd)

# Define the expected path to the app relative to the script
APP_PATH="${SCRIPT_DIR}/Mirrorbast.app"

echo "Attempting to fix permissions for Mirrorbast.app..."
echo "App Path: ${APP_PATH}"

# Check if the app exists at the expected path
if [ -d "$APP_PATH" ]; then
  # Run the xattr command
  echo "Running: xattr -cr \"${APP_PATH}\""
  xattr -cr "$APP_PATH"

  # Check the exit code of xattr
  if [ $? -eq 0 ]; then
    echo ""
    echo "Permissions potentially fixed!"
    echo "You should now be able to double-click Mirrorbast.app to open it."
    echo "(You might still need to right-click -> Open the first time)."
  else
    echo ""
    echo "ERROR: The xattr command failed. Unable to fix permissions."
    echo "Please ensure the script is in the same folder as Mirrorbast.app."
  fi
else
  echo ""
  echo "ERROR: Mirrorbast.app not found in the same directory as this script."
  echo "Please make sure you have extracted the .zip file and that"
  echo "'Fix Mirrorbast Permissions.command' and 'Mirrorbast.app' are together."
fi

echo ""
echo "Press Enter to close this window."
read -p ""
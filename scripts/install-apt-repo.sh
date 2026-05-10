#!/bin/sh
set -eu

setup_url="${CSV_ALIGN_REPOSITORY_SETUP_URL:-https://github.com/ddv1982/csv-align/releases/latest/download/csv-align-repository-setup_1.0_all.deb}"
setup_deb=""

cleanup() {
  if [ -n "$setup_deb" ]; then
    rm -f "$setup_deb"
  fi
}
trap cleanup EXIT
trap 'trap - EXIT; cleanup; exit 130' HUP INT TERM

if command -v curl >/dev/null 2>&1; then
  downloader="curl"
elif command -v wget >/dev/null 2>&1; then
  downloader="wget"
else
  echo "CSV Align repository setup requires curl or wget." >&2
  exit 1
fi

setup_deb="$(mktemp "${TMPDIR:-/tmp}/csv-align-repository-setup.XXXXXX.deb")"

printf 'Downloading CSV Align repository setup package...\n'
case "$downloader" in
  curl)
    curl -fsSLo "$setup_deb" "$setup_url"
    ;;
  wget)
    wget -qO "$setup_deb" "$setup_url"
    ;;
esac
chmod 0644 "$setup_deb"

printf 'Installing CSV Align APT repository setup package...\n'
sudo apt install -y "$setup_deb"

printf '\nCSV Align APT repository is enabled. Next run:\n'
printf '  sudo apt update\n'
printf '  sudo apt install csv-align\n'

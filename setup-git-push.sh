#!/bin/bash
echo "=== Setup Git Push ke GitHub ==="
echo ""
read -p "GitHub Username kamu: " GH_USER
read -s -p "GitHub Token (tidak tampil saat diketik): " GH_TOKEN
echo ""

# Simpan credentials
echo "https://${GH_USER}:${GH_TOKEN}@github.com" > /home/runner/.git-credentials

# Set credential helper
git config --global credential.helper store
git config --global user.name "$GH_USER"

echo ""
echo "Selesai! Coba sekarang:"
echo "  git push origin main"

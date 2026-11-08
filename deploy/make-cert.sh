#!/bin/sh
# Makes a long-lived self-signed certificate for a LAN-only Pocket-Connect server.
# Usage: ./make-cert.sh connect.home.lan [192.168.20.10]
# Then set PC_TLS=/certs/cert.pem /certs/key.pem in .env and pin the printed
# fingerprint in each Pocket-Connect app (Account > Server > Certificate fingerprint).
set -e
NAME="${1:?Give the server name, e.g. connect.home.lan}"
IP="$2"
SAN="DNS:${NAME}"
[ -n "$IP" ] && SAN="${SAN},IP:${IP}"
mkdir -p certs
openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 -nodes \
  -keyout certs/key.pem -out certs/cert.pem -days 3650 \
  -subj "/CN=${NAME}" -addext "subjectAltName=${SAN}"
chmod 600 certs/key.pem
echo
echo "Certificate made. Its SHA-256 fingerprint (pin this in the apps):"
openssl x509 -noout -fingerprint -sha256 -in certs/cert.pem | cut -d= -f2

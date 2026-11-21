# syntax=docker/dockerfile:1

# --- Étape 1 : tests et construction de la version de production ---
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run test && npm run build

# --- Étape 2 : certificat auto-signé (WebXR exige le HTTPS hors localhost, pour le Quest) ---
FROM alpine:3.22 AS cert
RUN apk add --no-cache openssl \
 && openssl req -x509 -nodes -newkey rsa:2048 -days 3650 \
      -keyout /key.pem -out /cert.pem -subj "/CN=trisolaris"

# --- Étape 3 : service des fichiers statiques ---
FROM nginx:1.29-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=cert /key.pem /cert.pem /etc/nginx/certs/
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80 443

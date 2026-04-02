# Builder image met alle dependencies voor pm-budgetscanner
FROM node:18-alpine

# Werkdirectory instellen
WORKDIR /app

# Dependencies installeren
COPY package*.json ./
RUN npm install

# Dit is de builder image - alleen dependencies, nog geen app code
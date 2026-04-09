# Stap 1: Bouwen van de app - gebruik builder image
ARG LCL_PLATFORM
FROM --platform=${LCL_PLATFORM} plusmin/pm-budgetscanner-builder:latest AS builder
# Werkdirectory is al /app in de builder image
ARG STAGE
ENV STAGE=$STAGE

# Kopieer environment file en app code
COPY $STAGE.env ./.env
COPY . .

# Dependencies zijn al geinstalleerd in de builder image, alleen build uitvoeren
RUN npm run build

# Stap 2: Nginx gebruiken om de statische bestanden te serveren
FROM nginx:alpine

# ARG PORT
# ENV PORT=$PORT
ARG STAGE
ENV STAGE=$STAGE

# Kopieer de statische bestanden van de build naar de Nginx public directory
RUN mkdir -p /usr/share/nginx/html
COPY --from=builder /app/dist /usr/share/nginx/html
COPY /conf/nginx /etc/nginx
RUN rm /etc/nginx/conf.d/*.default.conf
COPY /conf/nginx/conf.d/$STAGE.default.conf /etc/nginx/conf.d/default.conf

# Expose port 3036
# EXPOSE $PORT

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
#!/bin/bash

printf "Starting deploy: stopping entire stack\n"
docker compose -f docker-compose.dev.yml down 
printf "\nRestarting\n"
docker compose -f docker-compose.dev.yml up -d

#!/bin/bash

printf "Starting deploy: stopping entire stack\n"
docker compose -f docker-compose.stg.yml down 
printf "\nRestarting\n"
docker compose -f docker-compose.stg.yml up -d

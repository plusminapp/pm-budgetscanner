#!/bin/bash

set -a
. ./.env
set +a

# Build de builder image voor pm-budgetscanner
docker build --platform="linux/amd64" -f Dockerfile.builder -t plusmin/pm-budgetscanner-builder:latest .
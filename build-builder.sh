#!/bin/bash

set -a
. ./.env
set +a

# Build de builder image voor pm-budgetscanner
echo "Building pm-budgetscanner-builder image..."
echo "Using LCL_PLATFORM: ${LCL_PLATFORM}"
docker build --platform="${LCL_PLATFORM}" -f Dockerfile.builder -t plusmin/pm-budgetscanner-builder:latest .
#!/usr/bin/env bash

set -a
. ./.env
set +a

VERSION=0.1.0-STG
STAGE=${STAGE:-stg}
PORT=${PORT:-3036}
LCL_PLATFORM=${LCL_PLATFORM:-linux/amd64}
PLATFORM=${PLATFORM:-linux/arm64}

echo pm-budgetscanner version: ${VERSION}
echo lcl_platform: ${LCL_PLATFORM}
echo platform: ${PLATFORM}
echo STAGE: ${STAGE}

pushd ${PWD}

# Check if builder image exists, if not build it
if [[ "$(docker images -q plusmin/pm-budgetscanner-builder:latest 2> /dev/null)" == "" ]]; then
    echo "Builder image not found, building pm-budgetscanner-builder..."
    ./build-builder.sh
else
    echo "Builder image found, using existing pm-budgetscanner-builder..."
fi

docker build \
     --no-cache \
     --platform=$PLATFORM \
     --build-arg LCL_PLATFORM=${LCL_PLATFORM} \
     --build-arg STAGE=${STAGE} \
     --build-arg NPM_CONFIG_UNSAFE_PERM=true \
     -t plusmin/pm-budgetscanner:${VERSION} .

popd
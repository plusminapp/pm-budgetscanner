#!/usr/bin/env bash

echo pm-budgetscanner version: ${VERSION}
echo lcl_platform: ${LCL_PLATFORM}
echo platform: ${PLATFORM}
echo PORT: ${PORT}
echo STAGE: ${STAGE}

pushd ${PROJECT_FOLDER}/pm-budgetscanner

# Set Docker BuildKit with plain output
#export DOCKER_BUILDKIT=1
#export BUILDKIT_PROGRESS=plain

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
     --build-arg PORT=${PORT} \
     --build-arg STAGE=${STAGE} \
     --build-arg NPM_CONFIG_UNSAFE_PERM=true \
     -t plusmin/pm-budgetscanner:${VERSION} .

popd
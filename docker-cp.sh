#!/usr/bin/env bash

stage=$(echo "$1" | tr '[:upper:]' '[:lower:]')
echo stage: $stage
source .env
source "${stage}/${stage}".env

if [ "$stage" == "dev" ]; then
  VERSION=${PM_DEV_VERSION}
elif [ "$stage" == "stg" ]; then
  VERSION=${PM_STG_VERSION}
else
  echo "Invalid environment: $stage"
  exit 1
fi

echo version: $VERSION

docker save -o .images/pm-budgetscanner.${VERSION}.tar plusmin/pm-budgetscanner:${VERSION}
scp .images/pm-budgetscanner.${VERSION}.tar box:~/io.vliet/pm/.images/
ssh box "bash -lc 'docker load -i ~/io.vliet/pm/.images/pm-budgetscanner.${VERSION}.tar'"


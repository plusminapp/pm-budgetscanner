#!/usr/bin/env bash

. ./.env

echo stage: STG
echo version: $PM_STG_VERSION

docker save -o .images/pm-budgetscanner.${PM_STG_VERSION}.tar plusmin/pm-budgetscanner:${PM_STG_VERSION}
scp .images/pm-budgetscanner.${PM_STG_VERSION}.tar box:~/io.vliet/pmb/.images/
ssh box "bash -lc 'docker load -i ~/io.vliet/pmb/.images/pm-budgetscanner.${PM_STG_VERSION}.tar'"


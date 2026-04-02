#!/bin/bash
set -e

PROJECT_FOLDER="${PROJECT_FOLDER:-$HOME/io.vliet/plusmin}"

pushd "${PROJECT_FOLDER}/pm-budgetscanner/public/docs/budgetscanner/"
./genereer.sh
popd

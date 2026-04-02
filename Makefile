include .env
export

include lcl/lcl.env
include stg/stg.env
export

export LCL_PLATFORM=linux/$(shell uname -m | sed 's/x86_64/amd64/' | sed 's/aarch64/arm64/')

.PHONY: lcl-pm-budgetscanner-build stg-pm-budgetscanner-build lcl-budgetscanner stg-budgetscanner

lcl-pm-budgetscanner-build: export VERSION=${PM_LCL_VERSION}
lcl-pm-budgetscanner-build: export PLATFORM=${LCL_PLATFORM}
lcl-pm-budgetscanner-build: export PORT=3035
lcl-pm-budgetscanner-build: export STAGE=lcl
lcl-pm-budgetscanner-build:
	echo folder: ${PROJECT_FOLDER} platform: ${LCL_PLATFORM} version: ${VERSION}
	cp lcl/lcl.env ${PROJECT_FOLDER}/pm-budgetscanner/lcl.env
	${PROJECT_FOLDER}/pm-budgetscanner/build-budgetscanner-pdf.sh
	${PROJECT_FOLDER}/pm-budgetscanner/build-docker.sh

stg-pm-budgetscanner-build: export VERSION=${PM_STG_VERSION}
stg-pm-budgetscanner-build: export PLATFORM=linux/arm64
stg-pm-budgetscanner-build: export PORT=3030
stg-pm-budgetscanner-build: export STAGE=stg
stg-pm-budgetscanner-build:
	echo folder: ${PROJECT_FOLDER} platform: linux/arm64 version: ${VERSION}
	cp stg/stg.env ${PROJECT_FOLDER}/pm-budgetscanner/stg.env
	${PROJECT_FOLDER}/pm-budgetscanner/build-docker.sh

lcl-budgetscanner: lcl-pm-budgetscanner-build

stg-budgetscanner: stg-pm-budgetscanner-build
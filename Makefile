include .env
export

include lcl/lcl.env
include stg/stg.env
export

# LCL BUILD
lcl-pm-bs-build: export VERSION=${PM_LCL_VERSION}
lcl-pm-bs-build: export PLATFORM=linux/amd64
lcl-pm-bs-build: export PORT=3035
lcl-pm-bs-build: export STAGE=lcl
lcl-pm-bs-build:
	echo folder: ${PWD} platform: linux/amd64 version: ${VERSION}
	cp lcl/lcl.env ${PWD}/lcl.env
	${PWD}/build-bs-pdf.sh
	${PWD}/build-docker.sh

lcl-bs: lcl-pm-bs-build


# STG BUILD
stg-pm-bs-build: export VERSION=${PM_STG_VERSION}
stg-pm-bs-build: export PLATFORM=linux/arm64
stg-pm-bs-build: export PORT=3030
stg-pm-bs-build: export STAGE=stg
stg-pm-bs-build:
	echo folder: ${PWD} platform: linux/arm64 version: ${VERSION}
	cp stg/stg.env ${PWD}/stg.env
	${PWD}/build-docker.sh

stg-copy:
	./docker-cp.sh STG

stg-bs: stg-pm-bs-build stg-copy stg-deploy

stg-deploy:
	cat .env stg/stg.env | ssh box 'cat > ~/io.vliet/pmb/.env'
	ssh box 'sudo -u ruud bash -lc "cd ~/io.vliet/pmb && ~/io.vliet/pmb/pmb_deploy.sh stg"'


# remote
.PHONY: stg-remote
stg-remote:
	scp stg/* box:~/io.vliet/pmb/
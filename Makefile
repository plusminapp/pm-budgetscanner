include .env
export

include lcl/lcl.env
include stg/stg.env
export

.PHONY: npm-audit
npm-audit:
	npm audit

# LCL BUILD
lcl-pmb-build: export VERSION=${PM_LCL_VERSION}
lcl-pmb-build: export PLATFORM=linux/amd64
lcl-pmb-build: export PORT=3035
lcl-pmb-build: export STAGE=lcl
lcl-pmb-build:
	echo folder: ${PWD} platform: linux/amd64 version: ${VERSION}
	cp lcl/lcl.env ${PWD}/lcl.env
	${PWD}/build-pmb-pdf.sh
	${PWD}/build-docker.sh

lcl-pmb: npm-audit lcl-pmb-build


# STG BUILD
stg-pmb-build: export VERSION=${PM_STG_VERSION}
stg-pmb-build: export PLATFORM=linux/arm64
stg-pmb-build: export PORT=3030
stg-pmb-build: export STAGE=stg
stg-pmb-build:
	echo folder: ${PWD} platform: linux/arm64 version: ${VERSION}
	cp stg/stg.env ${PWD}/stg.env
	${PWD}/build-pmb-pdf.sh
	${PWD}/build-docker.sh

stg-copy:
	./docker-cp.sh STG

stg-pmb: npm-audit stg-pmb-build stg-copy stg-deploy

stg-deploy:
	cat .env stg/stg.env | ssh box 'cat > ~/io.vliet/pmb/.env'
	ssh box 'sudo -u ruud bash -lc "cd ~/io.vliet/pmb && ~/io.vliet/pmb/pmb_deploy.sh stg"'


# remote
.PHONY: stg-remote
stg-remote:
	scp stg/* box:~/io.vliet/pmb/
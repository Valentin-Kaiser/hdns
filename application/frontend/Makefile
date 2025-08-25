VERSION := $(shell git describe --tags | cut -d '-' -f 1 | cut -c 2-)

all: repair prod
prod:
	npm version $(VERSION) --allow-same-version
	ionic build --prod
repair:	
	npm install
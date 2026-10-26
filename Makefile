.PHONY: tools resources dev build

tools:
	git clone --depth 1 https://github.com/s0md3v/Photon tools/photon || git -C tools/photon pull
	git clone --depth 1 https://github.com/sherlock-project/sherlock tools/sherlock || git -C tools/sherlock pull
	git clone --depth 1 https://github.com/jivoi/awesome-osint tools/awesome-osint || git -C tools/awesome-osint pull

resources:
	node scripts/build-resources.mjs

dev: resources
	npm run dev

build:
	npm run build

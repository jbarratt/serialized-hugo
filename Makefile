.PHONY: localdev clouddev deploy

localdev:
	hugo server --verbose -p 8080 -b http://localhost:8080 --bind 0.0.0.0

clouddev:
	hugo server --verbose -p 8080 -b http://dev.serialized.net:8080 --bind 0.0.0.0

deploy:
	hugo
	aws-vault exec serialized -- hugo deploy

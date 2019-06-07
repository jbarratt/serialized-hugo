.PHONY: dev deploy


dev:
	hugo server --verbose -p 8080 -b http://dev.serialized.net:8080 --bind 0.0.0.0

deploy:
	./tools/ec2_deploy.sh

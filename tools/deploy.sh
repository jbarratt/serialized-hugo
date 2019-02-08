#!/bin/bash

set -e

export AWS_PROFILE="serialized"
cd ~/work/serialized-hugo
rm -rf public
hugo
s3deploy -bucket serialized -distribution-id E374LZZY9EPZLY -region "us-west-2" -workers 4 -source public/

# now handled by s3deploy
# aws configure set preview.cloudfront true
# if [[ "$1" != "noinv" ]]; then
#       aws cloudfront create-invalidation --distribution-id E374LZZY9EPZLY --paths '/*'
# fi

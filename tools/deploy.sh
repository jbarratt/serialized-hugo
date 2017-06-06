#!/bin/bash

set -e

export AWS_PROFILE="serialized"
cd ~/work/serialized-hugo
rm -rf public
hugo
s3deploy -bucket serialized -region "us-west-2" -source public/

# aws configure set preview.cloudfront true
aws cloudfront create-invalidation --distribution-id E374LZZY9EPZLY --paths '/*'

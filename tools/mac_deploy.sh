#!/bin/bash

set -e

cd ~/work/serialized-hugo
rm -rf public
hugo
s3deploy -bucket serialized -distribution-id E374LZZY9EPZLY -region "us-west-2" -workers 4 -source public/

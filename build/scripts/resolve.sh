#!/bin/sh

SOURCE_HOST="https://dl.google.com"
SOURCE_DIRECTORY="/dl/cloudsdk/channels/rapid/downloads/"
SOURCE_FILE="google-cloud-cli-linux-x86_64.tar.gz"

if [ $BUILD_PLATFORM = "linux/arm64" ]; then
    SOURCE_FILE="google-cloud-cli-linux-arm.tar.gz"
fi

curl -O ${SOURCE_HOST}${SOURCE_DIRECTORY}${SOURCE_FILE}
tar -xf ${SOURCE_FILE}
rm -f ${SOURCE_FILE}

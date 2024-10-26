#! /bin/bash
# Do not actually run this .sh file. It is meant to be uploaded to a compute instance
echo "Script is starting"
export DOCKER_CONFIG=/home/${USER}/.docker
mkdir -p ${DOCKER_CONFIG}
chmod 700 ${DOCKER_CONFIG}

echo "Running startup script" > /var/log/startup_status.log

docker-credential-gcr configure-docker --registries={_REGION}-docker.pkg.dev
if [ $? -ne 0 ]; then
    echo "Failed to configure Docker"
    exit 1
fi

echo "Docker configured"

DOCKER_IMAGE_NAME=$(curl -f "http://metadata.google.internal/computeMetadata/v1/instance/attributes/image-name" -H "Metadata-Flavor: Google")
if [ $? -ne 0 ]; then
    echo "Failed to retrieve Docker image from registry" > /var/log/startup_status.log
    exit 1
fi

DICOM_IMAGE=$(curl -f "http://metadata.google.internal/computeMetadata/v1/instance/attributes/dicom-image" -H "Metadata-Flavor: Google")
if [ $? -ne 0 ]; then
    echo "Failed to retrieve DICOM image" > /var/log/startup_status.log
    exit 1
fi

echo "Pulling docker image..."

docker pull ${DOCKER_IMAGE_NAME}
if [ $? -ne 0 ]; then
    echo "Failed to pull Docker image"
    exit 1
fi

echo "Pull success"
echo "Running docker image"

CONTAINER_ID=$(docker run -d ${DOCKER_IMAGE_NAME})
if [ -z "${CONTAINER_ID}" ]; then
    echo "Failed to start container" > /var/log/startup_status.log
    exit 1
fi

echo "Docker image running on container $CONTAINER_ID"
echo "Copying dicom images to container"

docker cp /home/${USER}/${DICOM_IMAGE} ${CONTAINER_ID}:/app/images # ${DICOM_IMAGE}
if [ $? -ne 0 ]; then
    echo "Failed to copy DICOM image to container" > /var/log/startup_status.log
    exit 1
fi

echo "Dicom image copied"


while true; do
    output=$(docker container diff ${CONTAINER_ID})
    if echo "$output" | grep -q "A /app/${DICOM_IMAGE}-multiorgan-segmentation.dcm"; then
        docker cp ${CONTAINER_ID}:/app /home/${USER}
        break
    fi
    sleep 2
done

echo "script has finished running"
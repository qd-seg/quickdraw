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

USERNAME=$(curl -f "http://metadata.google.internal/computeMetadata/v1/instance/attributes/username" -H "Metadata-Flavor: Google")
if [ $? -ne 0 ]; then
    echo "Failed to retrieve Username" > /var/log/startup_status.log
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

# CONTAINER_ID=$(docker run -d ${DOCKER_IMAGE_NAME})
# CONTAINER_ID=$(docker run -d -v /home/${USER}/images:/app/images -v /home/${USER}/model_outputs:/app/model_outputs ${DOCKER_IMAGE_NAME} ${DICOM_IMAGE})

# if [ -z "${CONTAINER_ID}" ]; then
#     echo "Failed to start container" > /var/log/startup_status.log
#     exit 1
# fi
# echo "Docker image running on container $CONTAINER_ID"

echo running with user: ${USERNAME}

# The commented block above is for -d
# Was using -d (detached) before but to be honest not sure why? Not using it for now. Might need to change later.
docker run -e PYTHONUNBUFFERED=1 -v /home/${USERNAME}/images:/app/images -v /home/${USERNAME}/model_outputs:/app/model_outputs ${DOCKER_IMAGE_NAME} ${DICOM_IMAGE}
if [ $? -ne 0 ]; then
    echo "Something went wrong with docker run"
    exit 1
fi
echo "Docker done running"
# echo "Copying dicom images to container"

# docker cp /home/${USER}/${DICOM_IMAGE} ${CONTAINER_ID}:/app/images # ${DICOM_IMAGE}
# if [ $? -ne 0 ]; then
#     echo "Failed to copy DICOM image to container" > /var/log/startup_status.log
#     exit 1
# fi

# echo "Dicom image copied"


# This block is only needed if we are running with -d
# while true; do
#     output=$(docker container diff ${CONTAINER_ID})
#     if echo "$output" | grep -q "A /app/model_outputs/${DICOM_IMAGE}-multiorgan-segmentation.dcm"; then
#         # docker cp ${CONTAINER_ID}:/app /home/${USER}
#         break
#     fi
#     sleep 2
# done

echo "script has finished running"
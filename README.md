# Google Cloud Functionality
notes:
the workflow:
- model is uploaded through model management page, and it gets put into Artifact Registry
- the user will select a set of DICOM images, and a model
- The compute instance is created and started
- DICOM images scp'd into instance
- startup script runs
- predictions made and scp'd back into server and uploaded to orthanc

## TODO:
- when running docker container, should mount the directory of dicom images to container
- then can just put dicom images in there, and run the prediction whenever needed
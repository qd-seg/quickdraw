# Google Cloud Functionality
Implements the ability to upload Dockerized models to Artifact Registry and make predictions on Compute.

## Google Cloud Setup
Install the [gcloud CLI](https://cloud.google.com/sdk/docs/install).

The instructions for creating a Google Cloud Service account is [here](https://cloud.google.com/iam/docs/service-accounts-create#iam-service-accounts-create-console), and how to get the key file is [here](https://cloud.google.com/iam/docs/keys-create-delete#iam-service-account-keys-create-console). Make sure to name the JSON key file `serviceAccountKeys.json` and put it into the root project directory.

The service account must have the following permissions:
- Service Account User
- Compute Admin	
- Artifact Registry Repository Administrator

An `.env` file is required with the following entries. The *values* in the parentheses are the recommended values
- PROJECT_ID=`<your Google Cloud project id>` *(radiology-b0759*)
- ZONE=`<compute instance zone>` *(us-east4-b)*
- MACHINE_TYPE=`<type of compute instance you want to create>` *(c2-standard-8)*
- SERVICE_ACCOUNT=`<your Google Cloud service account's email>`
- KEY_FILE=`<path to service account key.json>` *(./serviceAccountKeys.json)*
- REPOSITORY=`<name of artifact registry repo>` *(models)*

## Virtual Environment
Create a Python venv:
- `python3 -m venv .venv`
- `pip install -r requirements.txt`

## Dockerizing a Model
For testing purposes, a Dockerized model `organ-segmentation-model` is already available on Artifact Registry. Only follow the below instructions if you would like to create your own:
- Create Dockerfile with an ENTRYPOINT that is that python file ran to make predictions. Ex: `ENTRYPOINT ["python", "predict.py"]`
- `predict.py` should take 1 required command-line argument, which is the name of the DICOM series that will be fed to the model
- `predict.py` **MUST** take in inputs from `./images` and output to `./model_outputs`, relative to the directory that `predict.py` is stored (probably `/app/`)
- `docker build -t <image-name>`

To push the model to Registry, you can either do it directly:
- `python3 upload_model.py <image-name> --direct-push`

Or, if you wish to save the image to a tarball first:
- `docker save -o <image-name>.tar <image-name>`
- `python3 upload_model.py <image-name> --tarball-path=<tarball-path>`
  
An example Dockerfile and .dockerignore is provided in `/example_docker/`.

## Making Predictions:
Here is how to test the code outside of Flask: 
- Navigate to the [Google Cloud Console](https://console.cloud.google.com/compute/instances?project=radiology-b0759). If there are any instances there, either start them, or delete them
- Upload a DICOM series into `dicom-images/`. Do not only upload one single layer. Upload an entire directory of DCM files, for example, `PANCREAS_XXXX/` (keeping all of its subfolders)
- Go to `flask_helpers.py` and replace these variables as needed:
  - `COMPUTE_INSTANCE_NAME`: name of Google Compute instance. If it is None, a new instance will be created *(ex: myinstance-webserver-20241028191333)*. Note: creating a new instance is slightly bugged. You may have to replace `COMPUTE_INSTANCE_NAME` with the proper name after creation and re-run the program
  - `DICOM_SERIES_TO_PREDICT`: name of the folder in `dicom-images/` (not the path) to predict. *(ex: PANCREAS_XXXX)*
  - `DOCKER_MODEL_NAME`: name of docker image on Registry *(ex: organ-segmentation-model)*
- `python3 flask_helpers.py`
- **Go back to the console and stop the Compute instance you started to save resources**

## Issues:
- Only one user is able to run predictions on a single compute instance at the same time
- Only one compute instance can exist at a time (this should be easily changeable)
- The variables that have to manually be changed in `flask_helpers.py` will need to come from the frontend, or somewhere else

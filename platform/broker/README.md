# Google Cloud Functionality
Implements the ability to upload Dockerized models to Artifact Registry and make predictions on Compute.

## Setting up Flask Server
### Google Cloud Setup
Install the [gcloud CLI](https://cloud.google.com/sdk/docs/install).

Create a Google Cloud Project with the following APIs activated:
- Compute Engine
- Artifact Registry

Create a Google Cloud Service Account. The instructions for doing so is [here](https://cloud.google.com/iam/docs/service-accounts-create#iam-service-accounts-create-console), and how to get the key file is [here](https://cloud.google.com/iam/docs/keys-create-delete#iam-service-account-keys-create-console). 
The service account must have the following permissions:
- Service Account User
- Compute Admin	
- Artifact Registry Repository Administrator
 
Download the service account's key json file.

In the root directory of the project, create a folder named `secret`. Place the service account key json file into this
folder and name it `service_account.json`.

Create a new file named `service_configuration.json` and paste the following into it:
```json
{
    "zone": "us-east4-b",
    "backupZones": [],
    "machineType": "c2-standard-8",
    "repository": "models",
    "instanceLimit": 1,
    "allowRunWithoutGoogleCloud": false
}
```
Replace these variables as needed:
- `zone: string`:  [zone to create Compute Instance in](https://cloud.google.com/compute/docs/regions-zones)
- `backupZones: string[]`: list of zones to check if original zone is out of resources
- `machineType: string`: [machine type to create Instance from](https://cloud.google.com/compute/docs/machine-resource)
- `repository: string`: name of Artifact Registry repository for model Docker images
- `instanceLimit: int`: maximum number of Compute Instances that can exist at once. **Recommended value=1**
- `allowRunWithoutGoogleCloud: boolean`: whether or not to continue running Flask server even if Google Cloud Services is down

An `.env` file is required with the following entries. The *values* in the parentheses are the recommended/placeholder values
- PROJECT_ID=`<your Google Cloud project id>` *(radiology-b0759*)
- ZONE=`<compute instance zone>` *(us-east4-b)*
- MACHINE_TYPE=`<type of compute instance you want to create>` *(c2-standard-8)*
- SERVICE_ACCOUNT=`<your Google Cloud service account's email>` *(artifact-compute-service-accou@radiology-b0759.iam.gserviceaccount.com)*
- KEY_FILE=`<path to service account key.json>` *(./serviceAccountKeys.json)*
- REPOSITORY=`<name of artifact registry repo>` *(models)*

### Python Virtual Environment
You should have already created a Python virtual environment and installed the required packages as described [here](/README.md#activate-the-virtual-environment).

### Dockerizing a Model
A Dockerized model `organ-segmentation-model` is already available on radiology-b0759's Google Cloud Artifact Registry. Only follow the below instructions if you do not have access to that project, or if you would like to create your own model.

#### Using the Existing Model
Follow these instructions to use the existing Organ Segmentation model, created by Rahul Pemmaraju and Neehar Peri
in your own Google Cloud project.

Create a Python virtual environment and upload the model:
- `python3 -m venv .venv`
- `source .venv/bin/activate` (MacOS/Linux), or `.venv\Scripts\activate.bat` (Windows)
- `pip install -r ./platform/broker/src/upload_requirements.txt`

If you have a .tar file:
- `python3 ./platform/broker/src/upload_model.py --tarball-path <tarball-path>`

Or, if you want to build the image from the `organ_seg_model` branch:
- Navigate into a directory *outside* of this project's root directory
- `git clone -b organ_seg_model gitlab@para.cs.umd.edu:purtilo/radiology.git`
- `cd` into the project directory
- `docker build -t <image-name>`
- `python3 ./platform/broker/src/upload_model.py --image-name <image-name> --direct-push`

#### Creating a New Model
- Create Dockerfile with an ENTRYPOINT that is that python file ran to make predictions. Ex: `ENTRYPOINT ["python", "predict.py"]`
- `predict.py` should take 1 required command-line argument, which is the name of the DICOM series that will be fed to the model
- `predict.py` **MUST** take in inputs from `./images` and output to `./model_outputs/<dicom-series-name>/<output>.[dcm|npz]`, relative to the directory that `predict.py` is stored (probably `/app/`)
- `docker build -t <image-name> .`

Your image should appear if you run `docker images`. To test it:
- Manually create directories `images/` and `model-outputs/` in your model's root path
- Place a DICOM series into `images/`
- `docker run -v <model-root-path>/images:/app/images -v <model-root-path>/model_outputs:/app/model_outputs <dicom-series-name> [OPTIONAL-ARGS]` 
  
You can push the model directly to Registry:
- `python3 ./platform/broker/src/upload_model.py --image-name <image-name> --direct-push`

Or, if you wish to save the image to a tarball first:
- `docker save -o <image-name>.tar <image-name>`
- `python3 ./platform/broker/src/upload_model.py --tarball-path <tarball-path>`

If you are having issues, double check your service account configuration secret files are correct.
Also ensure the service account has the proper permissions as described [here](README.md#google-cloud-setup)
  
An example Dockerfile and .dockerignore is provided in `/example_docker/`.

---

The Flask server can now be run as described [in the root directory](/README.md#rest-api-server).

## Testing Google Cloud Services without Flask
The cloud code can be tested outside of Flask. Please note this is only for development and is not intended for a production environment. 
- Upload a DICOM series into `dicom-images/`. Do not only upload one single layer. Upload an entire directory of DCM files, for example, `PANCREAS_XXXX/` (keeping all of its subfolders)
- Go to the main function of `flask_helpers.py` and replace these variables as needed:
  - `COMPUTE_INSTANCE_NAME`: name of Google Compute instance. If it is None, a new instance will be created *(ex: myinstance-webserver-20241028191333)*.
  - `DICOM_SERIES_TO_PREDICT`: name of the folder in `dicom-images/` (not the path) to predict. *(ex: PANCREAS_XXXX)*
  - `DOCKER_MODEL_NAME`: name of docker image on Registry *(ex: organ-segmentation-model)*
- `python3 flask_helpers.py`

*Note: after running a prediction, the code will stop the Compute instance, but not delete it. When the Flask server is run, any unused instances will be deleted.*

## Issues
- Only one user is able to run predictions on a single compute instance at the same time
- Only one compute instance can exist at a time (this should be easily changeable)

## In Progress
- Flask should be able to get and send DICOM images to and from orthanc
# Google Cloud Functionality
Implements the ability to upload Dockerized models to Artifact Registry and make predictions on Compute.

## Setting up Flask Server
### Google Cloud Setup
[Create a Google Cloud Project](https://console.cloud.google.com/projectcreate). Choose any name and organization.

After creating a project, near the top of the screen you will see a search box that says "Search (/) for resources, 
docs, products, and more". Search for and enable the following APIs:
- Compute Engine
- Artifact Registry

*You may have to enter your billing information to activate these APIs.*

#### Creating a Service Account
- Open the left sidebar and navigate to `IAM & Admin > Service Accounts` 
- Click "+ Create a Service Account"
- Enter service account details in step 1
- In step 2, grant the service account the following roles (**make sure the roles have these exact names. Roles with similar names will not suffice**):
  - Service Account User
  - Compute Admin	
  - Artifact Registry Administrator
- Finish service account creation

#### Creating a Service Account Key
- After creating the account, open the service account in the Service accounts list
- Navigate to the "Keys" tab
- Click the "Add Key" button, select "JSON". It should download a .json file to your computer

#### Setting up Project Secrets
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

### Uploading an Existing Model
A Dockerized model for organ segmentation is already available on radiology-b0759's Google Cloud Artifact Registry. Follow the below instructions if you [want to use the existing model on a different Cloud project](#using-the-existing-model). If you would like to create your own model, [instructions are here](#creating-a-new-model).

#### Using the Existing Model
Follow these instructions to use the existing Organ Segmentation model, created by Rahul Pemmaraju and Neehar Peri
in your own Google Cloud project.

Install [Python>=3.10](https://www.python.org/downloads/)

Create a Python virtual environment and upload the model:
- `python3 -m venv .venv` (*or python, or py*)
- `source .venv/bin/activate` (MacOS/Linux), or `.venv\Scripts\activate` (Windows)

If you have a .tar file of the Dockerized model:
- `yarn run upload-model:<python3|python|py> -t <tarball-path>` 

(*Usage of python3, python or py depends on your Python installation. ex: `yarn run upload-model:python3 -t c:/Users/me/Downloads/model.tar`*)

---
Or, if you want to build the image from the `organ_seg_model` branch:
- Navigate into a directory *outside* of this project's root directory
- `git clone -b organ_seg_model gitlab@para.cs.umd.edu:purtilo/radiology.git`
- `cd` into the organ_seg_model branch directory
- `docker build -t <image-name> .`
- **`cd` back into original project's root directory**
- `yarn run upload-model:<python3|python|py> -i <image-name>`

### Creating a New Model
- Create Dockerfile with an ENTRYPOINT that is that python file ran to make predictions. Ex: `ENTRYPOINT ["python", "predict.py"]`
- `predict.py` should take 1 required command-line argument, which is the name of the DICOM series that will be fed to the model
- `predict.py` **MUST** take in inputs from `./images` and output to `./model_outputs/<dicom-series-name>/<output>.[dcm|npz]`, relative to the directory that `predict.py` is stored (probably `/app/`)
- `docker build -t <image-name> .`

Your image should appear if you run `docker images`. To test it:
- Manually create directories `images/` and `model-outputs/` in your model's root path
- Place a DICOM series into `images/`
- `docker run -v <model-root-path>/images:/app/images -v <model-root-path>/model_outputs:/app/model_outputs <dicom-series-name> [OPTIONAL-ARGS]` 
  
You can push the model directly to Registry:
- `yarn run upload-model:<python3|python|py> -i <image-name>`

Or, if you wish to save the image to a tarball first:
- `docker save -o <image-name>.tar <image-name>`
- `yarn run upload-model:<python3|python|py> -t <tarball-path>`

If you are having issues, double check your service account configuration secret files are correct.
Also ensure the service account has the proper permissions as described [here](README.md#google-cloud-setup)
  
An example Dockerfile and .dockerignore is provided in `/example_docker/`.

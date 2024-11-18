## Requirements:

- [`Python ^3.10.13`](https://www.python.org/downloads/)
- [`NodeJS ^20.9.0`](https://nodejs.org/en/download/)
- [`Yarn 1.22.x`](https://classic.yarnpkg.com/en/docs/install/)
- [`Docker >=27.3.1`](https://docs.docker.com/engine/install/)

### Environment Setup:

#### Create a Python Virtual Environment

A virutal environment will create will allow for sandboxed installation of packages, avoiding
version conflicts with packages which may have already been installed.

```
> python -m venv .venv
```

Note that some systems may require using `python3` or `py` rather than `python`.

#### Activate the Virtual Environment

This process is dependent on the operating system and shell of the development environment.

##### Linux and MacOS

```
> source .venv/bin/activate
```

##### Windows CMD

```
> .venv\Scripts\activate.bat
```

##### Windows PowerShell

```
> .venv\Scripts\activate.ps1
```

Note that the virtual environment must be activated any time a new shell is created. Some editors
such as Visual Studio Code support automatically activating the environment based on the selected
Python interpreter.

After setting up the virtual environment detailed above, the `python` and `pip` commands should be
available after activating, regardless of whether they are available on the system. All scripts
within the project are configured to use these executables when invoked.

## Setting Up Google Cloud Services

### Google Cloud Project Creation
The radiology Google Cloud project has already been set up. If you do not have access or if you wish to use a 
different Google Cloud project, follow the instructions below.

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
- In step 2, grant the service account the following roles 
(**make sure the roles have these exact names. Roles with similar names will not suffice. You cannot edit these permissions after service account creation, and will have to create another service account if the permissions are incorrect.**):
  - Service Account User
  - Compute Admin	
  - Artifact Registry Administrator
- Finish service account creation

#### Creating a Service Account Key
- After creating the account, open the service account in the Service accounts list
- Navigate to the "Keys" tab
- Click the "Add Key" button, select "JSON". It should download a .json file to your computer

#### Project Authentication
In the root directory of the project, create a folder named `secret`. Place the service account key json file into this
folder and name it `service_account.json`. It should follow the schema below:
```json
// service_account.json

{
  "type": string,
  "project_id": string,
  "private_key_id": string,
  "private_key": string,
  "client_email": string,
  "client_id": string,
  "auth_uri": string,
  "token_uri": string,
  "auth_provider_x509_cert_url": string,
  "client_x509_cert_url": string,
  "universe_domain": string
}
```

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
The default values above will function properly, but if you wish to replace any value:
- `zone: string`:  [zone to create Compute Instance in](https://cloud.google.com/compute/docs/regions-zones)
- `backupZones: string[]`: list of zones to check if original zone is out of resources
- `machineType: string`: [machine type to create Instance from](https://cloud.google.com/compute/docs/machine-resource)
- `repository: string`: name of Artifact Registry repository for model Docker images
- `instanceLimit: int`: maximum number of Compute Instances that can exist at once. **Recommended value=1**
- `allowRunWithoutGoogleCloud: boolean`: whether or not to continue running Flask server even if Google Cloud Services is down
---
The paths in which the build process looks for these files defaults to `secret` but can be overwritten by setting the
`$SERVICE_ACCOUNT` or `$SERVICE_CONFIGURATION` environment variables. These can be prepended to the
Yarn scripts described in [`package.json`](package.json). The path is expected to be absolute or
relative to the `build` directory.

```
> SERVICE_ACCOUNT=/path/to/file SERVICE_CONFIGURATION=/path/to/file yarn run ...
```

### Uploading Models
In order to upload models using the CLI script, several Python libraries are required. Ensure that your 
[virtual environment is activated](#activate-the-virtual-environment).

```
> pip install -r ./platform/broker/src/upload_requirements.txt
```

A Dockerized model for organ segmentation is already available the radiology project's Google Cloud Artifact Registry. Follow the below instructions if you [want to use the existing model on a different Cloud project](#using-the-existing-model). If you would like to create your own model, [instructions are here](#creating-a-new-model).

---

#### Using the Existing Model
Follow these instructions to use the existing Organ Segmentation model, created by Rahul Pemmaraju and Neehar Peri,
in your own Google Cloud project.

If you have a .tar file of the Dockerized model:
- `yarn run manage:upload -t <tarball-path>` 

(*Usage of python3, python or py depends on your Python installation. ex: `yarn run manage:upload -t c:/Users/me/Downloads/model.tar`*)

This will upload the model to Artifact Registry in the repository determined by `service_configuration.json`. If
a repository of the given name does not exist, one will be created.

---
Or, if you want to build the image from the `organ_seg_model` branch:
- Navigate into a directory *outside* of this project's root directory
- `git clone -b organ_seg_model gitlab@para.cs.umd.edu:purtilo/radiology.git`
- `cd` into the organ_seg_model branch directory
- `docker build -t <image-name> .`
- **`cd` back into original project's root directory**
- `yarn run manage:upload -i <image-name>`

---

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
- `yarn run manage:upload -i <image-name>`

Or, if you wish to save the image to a tarball first:
- `docker save -o <image-name>.tar <image-name>`
- `yarn run manage:upload -t <tarball-path>`

If you are having issues, double check your service account configuration secret files are correct.
Also ensure the service account has the proper permissions as described [here](README.md#google-cloud-setup)
  
An example is provided in the `organ_seg_model` branch.

## Deployment

### Docker

A set of Docker Compose definitions has been provided in order to streamline the deployment of this
project. It will create several containers with the necessary tools and modules which all interact
behind a NGINX reverse proxy. Containers are networked to only interact with the necessary sibling
containers.

```
> yarn run build:production
> yarn run start:production
```

By default, the process will bind to ports `8080` and `8443` for HTTP and HTTPS respectively. To
change this behaviour, overwrite the environment variable by prepending assignements to the
`HTTP_PORT` and `HTTPS_PORT` environment variables.

```
> HTTP_PORT=8080 HTTPS_PORT=8443 yarn run ...
```

The process will run in the background until it is manually stopped.

```
> yarn run stop:production
```

## Contributing

### Installing Required Dependencies

#### Python Libraries

Install the necessary Python libraries to the virtual environment.

```
> pip install -r ./platform/broker/requirements.txt
```

#### NodeJS Packages

This project consists of several workspaces which define package dependencies independently. Yarn
provides features to install all required packages together. Installing these dependencies will
allow for partial type checking within the OHIF plugin portion of this project.

```
> yarn run install:nodejs
```

### Development

Simply start up a set of Docker containers which will be spun up in development mode. This allows
for live reloading of both the backend API and OHIF plugins.

```
> yarn run build:development
> yarn run start:development
```

#### REST API Server

The REST API server can be found in `platform/broker`, and is a Flask based backend for the OHIF
Viewer extensions. It interfaces between the OHIF Viewer, Orthanc DICOM server and Google Cloud
Services to provide the necessary functionality.

#### OHIF Viewer Plugins

The OHIF Viewer is the core of this project, providing a framework for viewing DICOM modalities such
as CT scans and segmentations. It provides an interface for extending it's functionality through the
use of extensions and modes. These extensions and modes are stored in `platform/viewer` and are a
set of React based components and configurations to enable them within the OHIF Viewer.

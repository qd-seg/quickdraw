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
python -m venv .venv
```

Note that some systems may require using `python3` or `py` rather than `python`.

#### Activate the Virtual Environment

This process is dependent on the operating system and shell of the development environment.

##### Linux and MacOS

```
source .venv/bin/activate
```

##### Windows CMD

```
.venv\Scripts\activate.bat
```

##### Windows PowerShell

```
.venv\Scripts\activate.ps1
```

Note that the virtual environment must be activated any time a new shell is created. Some editors
such as Visual Studio Code support automatically activating the environment based on the selected
Python interpreter.

After setting up the virtual environment detailed above, the `python` and `pip` commands should be
available after activating, regardless of whether they are available on the system. All scripts
within the project are configured to use these executables when invoked.

## Setting Up Google Cloud Services

### Google Cloud Project Creation

The radiology Google Cloud project has already been set up. If you do not have access or if you wish
to use a different Google Cloud project, follow the instructions below.

[Create a Google Cloud Project](https://console.cloud.google.com/projectcreate). Choose any name and
organization.

After creating a project, near the top of the screen you will see a search box that says "Search (/)
for resources, docs, products, and more". Search for and enable the following APIs:

- Compute Engine
- Artifact Registry

_You may have to enter your billing information to activate these APIs._

#### Creating a Service Account

1. Open the left sidebar and navigate to `IAM & Admin Service Accounts`
2. Click `Create a Service Account`
3. Enter service account details in step 1.
4. In step 2, grant the service account the following roles. _*Make sure the roles have these exact
   names. Roles with similar names will not suffice. You cannot edit these permissions after service
   account creation, and will have to create another service account if the permissions are
   incorrect.*_

   - Service Account User
   - Compute Admin
   - Artifact Registry Administrator

5. Finish service account creation.

#### Creating a Service Account Key

- After creating the account, open the service account in the Service accounts list
- Navigate to the `Keys` tab
- Click the `Add Key` button, select `JSON`. It should download a JSON file to your computer.

#### Project Authentication and Configuration

In the root directory of the project, create a directory named `secret`. Place the service account
key json file into this folder and name it `service_account.json`. It should abide by the following
schema:

```json
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

Create a new file named `service_configuration.json` in the `secret/` directory and paste the
following into it:

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

- `zone: string` - The target zone to create the compute instance in. Details can be found
  [here](https://cloud.google.com/compute/docs/regions-zones).
- `backupZones: string[]` - Potential backup zones to create the compute instance in the case that
  the target zone is unavailable.
- `machineType: string` - The machine type to use when creating the compute instance. Details can be
  found [here](https://cloud.google.com/compute/docs/machine-resource).
- `repository: string` - The name of the Artifact Registry repository for model Docker images.
- `instanceLimit: int`: Maximum number of Compute Instances that can exist at once. **Only a single
  instance is recommended.**
- `allowRunWithoutGoogleCloud: boolean`: Whether or not to continue running the Flask server in the
  case Google Cloud Services is down.

The paths in which the build process looks for these files defaults to `secret/` but can be
overwritten by setting the `$SERVICE_ACCOUNT` or `$SERVICE_CONFIGURATION` environment variables.
These can be prepended to the Yarn scripts described in [`package.json`](package.json). The path is
expected to be absolute or relative to the `build/` directory.

```
SERVICE_ACCOUNT=/path/to/file SERVICE_CONFIGURATION=/path/to/file yarn run ...
```

### Uploading Models

In order to upload models using the CLI script, several Python libraries are required. Ensure that
your [virtual environment is activated](#activate-the-virtual-environment).

```
pip install -r ./platform/broker/src/upload_requirements.txt
```

A Dockerized model for organ segmentation is already available the radiology project's Google Cloud
Artifact Registry. Follow the below instructions if you
[want to use the existing model on a different Cloud project](#using-the-existing-model). If you
would like to create your own model, [instructions are here](#creating-a-new-model).

#### Using the Existing Model

Follow these instructions to use the existing Organ Segmentation model, created by Rahul Pemmaraju
and Neehar Peri, in your own Google Cloud project.

If you have a .tar file of the Dockerized model:

```
yarn run manage:upload -t <tarball_path>
```

This will upload the model to Artifact Registry in the repository determined by
`service_configuration.json`. If a repository of the given name does not exist, one will be created.

Or, if you want to build the image from the `organ_seg_model` branch, navigate into a directory
_*outside*_ of this project's root directory and run the following set of commands.

```
git clone -b organ_seg_model https://para.cs.umd.edu/purtilo/radiology.git
cd organ_seg_model
docker build -t <image_name>
```

The navigate back into the orignal project's root directory and run the next command.

```
yarn run manage:upload -i <image_name>
```

#### Creating a New Model

1. Create Dockerfile with an `ENTRYPOINT` that is that python file ran to make predictions, in the
   form `ENTRYPOINT ["python", "<prediction_script>.py"]`.

2. `predict.py` must take 1 required command-line argument, which is the name of the DICOM series
   that will be fed to the model.

3. `predict.py` must take in inputs from a relative directory `inputs/` and output to a directory of
   the form `model-outputs/<dicom_series_name>/<output>`. Currently, the Flask server only supports model 
   outputs in the form of `.npz` files compressed with `gzip`.

You can then build the image and check to ensure it was created and stored in Docker.

```
docker build -t <image_name>
docker images
```

Next, test the model directly on your machine. Manually create directories `images/` and
`model-outputs/` in your model's root path and place a DICOM series into `images/`. Then run the
image using Docker.

```
docker run -v <model_root_path>/images:/app/images -v <model_root_path>/model_outputs:/app/model_outputs <dicom_series_name>
```

You can then push the model directly to the registry.

```
yarn run manage:upload -i <image_name>
```

Or, save the image to a tarball first.

```
docker save -o <image_name>.tar <image_name>
yarn run manage:upload -t <tarball_path>
```

If you are having issues, double check your service account configuration secret files are correct.
Also ensure the service account has the proper permissions as described
[here](README.md#google-cloud-setup). An example is provided in the `organ_seg_model` branch.

## SSL Encryption

In order to maintain patient privacy, the project is configured to use SSL encryption to secure the
traffic between the client application and server side processes. This requires an SSL certificate
and key, which can self-signed or signed through a trusted authority.

To generate a self-signed certificate and key, run the command below in the root directory of the
project.

```
openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout ./secret/ssl.key -out ./secret/ssl.crt
```

The build process searches for `secret/ssl.crt` and `secret/ssl.key` by default. To specify a custom
location for each of the files, set the `$SSL_CERTIFICATE` and `$SSL_CERTIFICATE_KEY` environment
variables. These can be prepended to the Yarn scripts described in [`package.json`](package.json).
The path is expected to be absolute or relative to the `build/` directory.

```
SSL_CERTIFICATE=/path/to/file SSL_CERTIFICATE_KEY=/path/to/file yarn run ...
```

Note that OpenSSL may not be availble by default within the Windows operating system, but there are
a variety of methods available to install the tool. There are several options listed on the
[OpenSSL Wiki](https://wiki.openssl.org/index.php/Binaries).

## Deployment

### Docker

A set of Docker Compose definitions has been provided in order to streamline the deployment of this
project. It will create several containers with the necessary tools and modules which all interact
behind a NGINX reverse proxy. Containers are networked to only interact with the necessary sibling
containers.

```
yarn run build:production
yarn run start:production
```

If you run into issues during this process, consult the [possible setup issues section](#possible-setup-issues).

By default, the process will bind to ports `8080` and `8443` for HTTP and HTTPS respectively. 
This means you can access the project at `localhost:8080` or `localhost:8443` by default.
To change this behaviour, overwrite the environment variable by prepending assignments to the
`HTTP_PORT` and `HTTPS_PORT` environment variables.

```
HTTP_PORT=8080 HTTPS_PORT=8443 yarn run ...
```

The process will run in the background until it is manually stopped.

```
yarn run stop:production
```

## Contributing

### Installing Required Dependencies

#### Python Libraries

Install the necessary Python libraries to the virtual environment.

```
pip install -r ./platform/broker/requirements.txt
```

#### NodeJS Packages

This project consists of several workspaces which define package dependencies independently. Yarn
provides features to install all required packages together. Installing these dependencies will
allow for partial type checking within the OHIF plugin portion of this project.

```
yarn install
```

### Development

Simply start up a set of Docker containers which will be spun up in development mode. This allows
for live reloading of both the backend API and OHIF plugins.

```
yarn run build:development
yarn run start:development
```

As described above in the [production deployment instructions](#docker), the application can be accessed at 
`localhost:<port>`. The Orthanc DICOM server can be viewed directly at `localhost:<port>/store`.

#### REST API Server

The REST API server can be found in `platform/broker/`, and is a Flask based backend for the OHIF
Viewer extensions. It interfaces between the OHIF Viewer, Orthanc DICOM server and Google Cloud
Services to provide the necessary functionality.

#### OHIF Viewer Plugins

The OHIF Viewer is the core of this project, providing a framework for viewing DICOM modalities such
as CT scans and segmentations. It provides an interface for extending it's functionality through the
use of extensions and modes. These extensions and modes are stored in `platform/viewer/` and are a
set of React based components and configurations to enable them within the OHIF Viewer.

### Possible Setup Issues
#### Docker Not Running
If Docker is not currently running you recieve the following error: 
`error during connect: Get [...] The system cannot find the file specified.`

Ensure that Docker is running on your device and run the start or build command again. 

#### Docker Out of Memory
The Docker build or compose process may fail with exit code 137. This means Docker does not have sufficient
memory allocated to complete the build or compose process. 

Clear the build cache.

```
docker buildx prune
```

Allocate more memory for Docker. 
It is recommended to have at least **6GB** of memory and **2GB** of swap space.

On Linux and MacOS, this is done through the Docker user interface. 
Click the gear icon on the top navbar and navigate to `Settings > Resources > Advanced`.

On Windows,
you must allocate more memory for WSL by [editing `.wslconfig`](https://learn.microsoft.com/en-us/windows/wsl/wsl-config).


#### Google Cloud Compute
Occasionally, Google Cloud will run out of resources in a specific zone and be unable to create an instance. Consult 
the [configuration section](#project-authentication-and-configuration) to choose a different zone within the same region,
or wait until resources are available. 
More details on this issue can be found on [Google Cloud Compute's documentation](https://cloud.google.com/compute/docs/troubleshooting/troubleshooting-resource-availability).
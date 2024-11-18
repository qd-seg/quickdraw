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

Note that some systems may require using `python3` rather than `python`.

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

_**Put Google Cloud Setup README Here**_

### Authentication

By default, the build process will look for `secrets/service_account.json` and
`secrets/service_configuration.json` for authentication credentials and service configurations. The
schemas for the two files are described below.

##### `service_account.json`

```json
{
  "type": <string>,
  "project_id": <string>,
  "private_key_id": <string>,
  "private_key": <string>,
  "client_email": <string>,
  "client_id": <string>,
  "auth_uri": <string>,
  "token_uri": <string>,
  "auth_provider_x509_cert_url": <string>,
  "client_x509_cert_url": <string>,
  "universe_domain": <string>
}
```

##### `service_configuration.json`

```json

{
  "zone": <string>,
  "machineType": <string>,
  "repository": <string>
}
```

The paths in which the build process looks for these files can be overwritten by setting the
`$SERVICE_ACCOUNT` or `$SERVICE_CONFIGURATION` environment variables. These can be prepended to the
Yarn scripts described in [`package.json`](package.json). The path is expected to be absolute or
relative to the `build/` directory.

```
> SERVICE_ACCOUNT=/path/to/file SERVICE_CONFIGURATION=/path/to/file yarn run ...
```

### Uploading Models

In order to upload models using the CLI script, several Python libraries are required.

```
> pip install -r ./platform/broker/src/upload_requirements.txt
```

_**Put Model Upload Information Here**_

```
> yarn run manage:upload ...
```

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
> yarn install
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

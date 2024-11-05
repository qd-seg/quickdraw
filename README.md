## Contributing

### Requirements:

- [Python 3.10.13](https://www.python.org/downloads/)
- [Node 20.9.0](https://nodejs.org/en/download/)
- [Yarn 1.22.22](https://classic.yarnpkg.com/en/docs/install/)
- [Docker 27.2.0](https://docs.docker.com/engine/install/)

While the necessary tooling can be installed manually, it is recommended to simply install these
tools with similar versions in order to streamline both the development and deployment processes.

### Environment Setup:

#### Create a Python Virtual Environment

A virutal environment will create will allow for sandboxed installation of packages, avoiding
version conflicts with packages which may have already been installed.

```
> python3 -m venv .venv
```

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

Note that the virtual environment must be activated any time a new shell is created.

#### Install Python Libraries

Install the necessary Python libraries to the virtual environment.

```
> yarn run install:python
```

#### Install NodeJS Packages

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

##### REST API Server

The REST API server can be found in `platform/broker`, and is a Flask based backend for the OHIF
Viewer extensions. It interfaces between the OHIF Viewer, Orthanc DICOM server and Google Cloud
Services to provide the necessary functionality.

Additional setup is required to interact with Google Cloud Services. The instructions can be found
in this [README.md](/platform/broker/README.md).

##### OHIF Viewer Plugins

The OHIF Viewer is the core of this project, providing a framework for viewing DICOM modalities such
as CT scans and segmentations. It provides an interface for extending it's functionality through the
use of extensions and modes. These extensions and modes are stored in `platform/viewer` and are
mainly a set of React based components and configurations to enable them within the OHIF Viewer.

## Deploying

### Docker

A set of Docker Compose definitions has been provided in order to streamline the deployment of this
project. It will create several containers with the necessary tools and modules which all interact
behind a NGINX reverse proxy. Containers are networked to only interact with the necessary sibling
containers.

```
> yarn run build:production
> yarn run start:production
```

The user should have permissions to bind to both port 80 and 443. This will start the containers in
a background process which will run until it is stopped.

```
> yarn run stop:production
```

### Configuring for Production

##### OHIF Viewer Application

The OHIF Viewer accepts a variety of configuration options which allows defining a remote DICOM-Web
server to pull data from. This project has implemented functionality using the Orthanc DICOM Server,
which exposes the DICOM-Web endpoint through configuration options. For an example configuration,
see the [`default.js`](.docker/app/default.js) file.

##### Google Cloud Services

By default, the build process will look for `secrets/service_account.json` and
`secrets/service_configuration.json` for authentication credentials and service configurations. The
schemas for the two files are described below.

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

```json
// service_configuration.json

{
  "zone": string,
  "machineType": string,
  "repository": string
}
```

The paths in which the build process looks for these files can be overwritten by setting the
`$SERVICE_ACCOUNT` or `$SERVICE_CONFIGURATION` environment variables. These can be prepended to the
Yarn scripts described in [`package.json`](package.json). The path is expected to be absolute or
relative to the `build` directory.

```
> SERVICE_ACCOUNT=/path/to/file SERVICE_CONFIGURATION=/path/to/file yarn run ...
```

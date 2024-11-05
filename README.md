## Contributing

### Requirements:

- [Yarn 1.22.22](https://classic.yarnpkg.com/en/docs/install/)
- [Docker 27.2.0]("https://docs.docker.com/engine/install/")

While the necessary tooling can be installed manually, it is recommended to simply install these
tools with similar versions in order to streamline both the development and deployment processes.

### Environment Setup:

#### Install NodeJS Packages

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

TODO: Write subsection on how setup the service account and configuration in the propper directory.

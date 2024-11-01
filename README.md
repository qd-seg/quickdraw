## Contributing

### Requirements:

- [Python 3.10.13](https://www.python.org/downloads/)
- [Node 20.9.0](https://nodejs.org/en/download/)
- [Yarn 1.22.22](https://classic.yarnpkg.com/en/docs/install/)

### Environment Setup:

#### Initialize the OHIF Viewer Submodule

The submodule needs to be initialized and updated before linking extensions and modes.

```
> yarn run init:submodules
```

#### Create a Python Virtual Environment

A virutal environment will create will allow for sandboxed installation of packages, avoiding
version conflicts with packages which may have already been installed.

```
> yarn run init:venv
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
provides features to install all required packages together. This will also install dependencies
within the OHIF Viewer submodule.

```
> yarn run install:node
```

#### Generate Type Declarations

Unfortunately, the OHIF Viewer does not natively provide type declarations when installing modules
of the parent project such as `@ohif/core` from NPM. These can be generated from the OHIF Viewer
source, which is provided as a Git submodule within this project.

```
> yarn run init:declarations
```

This will create the `types/app` directory and allow OHIF Viewer extensions and modes to reference
interfaces declared in the OHIF Viewer without the need to reference a local clone of the parent
repository.

#### Link OHIF Viewer Extensions and Modes

The OHIF Viewer needs to be made aware of the extensions and modes that live within this project.
Linking them will modify a few files in the `lib/app` directory. These changes should be ignored and
remain uncommited.

```
> yarn run link:modes
> yarn run link:extensions
```

### Development

Various scripts have been provided to start up development servers for each module of the project.
These servers allow for quick iteration, avoiding lengthy build processes and deployment procedures.

##### REST API Server

The REST API server can be found in `src/api`, and is a Flask based backend for both the OHIF Viewer
extension, and the management dashboard.

Additional setup is required to interact with Google Cloud Services. The instructions can be found [here](/src/api/README.md).

```
> yarn run dev:api
```

##### Management Dashboard

The management dashboard can be found in `src/dashboard`. It is a React based SPA which provides a
method of uploading custom models to Google Cloud Services.

```
> yarn run dev:dashboard
```

##### OHIF Viewer Application

The OHIF Viewer is the core of this project, providing a framework for viewing DICOM modalities such
as CT scans and segmentations. It provides an interface for extending it's functionality through the
use of extensions and modes. These extensions and modes are stored in `src/app` and are mainly a set
of React based components and configurations to enable them within the OHIF Viewer.

```
> yarn run dev:app
```

## Deploying

### Docker

A [`docker-compose.yml`](docker-compose.yml) has been provided in order to streamline the deployment
of this project. It will create several containers with the necessary tools and modules which all
interact behind a NGINX reverse proxy. Containers are networked to only interact with the necessary
sibling containers.

An installation of either [Docker Engine]("https://docs.docker.com/engine/install/") or
[Docker Desktop]("https://www.docker.com/products/docker-desktop/") is required to use this
deployment method.

```
> docker compose up
```

#### Rebuilding

Since Docker will not automatically rebuild the images it uses to create containers when the source
inputs are modified, it may be necessary to manually rebuild the project.

```
> docker compose build
```

This will rebuild images using a cache, which will only be invalidated when a modified line in the
corresponding `Dockerfile` has been reached, or files copied from a directory on the host machine
have been modified. It is also possible to entirely bypass cached build steps and rebuild from
scratch.

```
> docker compose build --no-cache
```

### Building for Production

#### Generating Static Resources

The React based modules can be built from the source code for a custom deployment solution. This
will create static resources which can be served by any HTTP server. These resources will be
available in the `dist` directory after the build is complete.

##### Management Dashboard

```
> yarn run build:dashboard
```

##### OHIF Viewer Application

When serving the OHIF Viewers static resources, ensure that Cross Orgin Isolations is properly
configured on the HTTP server. See the
[OHIF documentation page]("https://docs.ohif.org/deployment/cors/") for reference.

```
> yarn run build:app
```

The OHIF Viewer also accepts a variety of configuration options which allows defining a remote
DICOM-Web server to pull data from. This project has implemented functionality using the Orthanc
DICOM Server, which exposes the DICOM-Web endpoint through configuration options. For an example
configuration, see the [`default.js`](.docker/app/default.js) file.

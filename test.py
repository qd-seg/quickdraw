# Test Google Cloud upload to Artifact Registry and run with Compute Engine
import os
from dotenv import load_dotenv
from google.cloud import compute_v1, artifactregistry
from google.api_core.extended_operation import ExtendedOperation
from google.auth import compute_engine
from google.auth.transport.requests import Request
from google.oauth2 import service_account
from datetime import datetime
import subprocess
import time

# pip install -r requirements.txt

# What this code does:
# - Upload Docker image to Artifact Registry
# - Pull Docker image from registry to Compute VM
# - Copy DICOM images to Compute VM
# - Run predictions on images

# Might be needed:
# - Add ssh key in Compute Engine / Settings / Metadata

# Current test steps before running this file:
# - Add service-account-admin permission to service account
# - Pull test docker image: docker pull us-docker.pkg.dev/google-samples/containers/gke/hello-app:1.0
#   - This is supposed to import from .tar
# - Run this python script
# - Go to Cloud console, SSH to the compute instance, and run 'sudo google_metadata_script_runner startup'

## TODO:
# (?) - scp keys.json file to instance
# - change vm config to be exact same as prev group
#   - should allow docker auth (which is failing now bc of lack of network conn?)
# - scp dicom images to instance. Just use gcloud in sh file or run it directly
# - scp works, just dont include user in user@machine
# Dockerize the model !!

load_dotenv(override=True)
_INSTANCE_LIMIT = 1
_PROJECT_ID = os.getenv('PROJECT_ID') # "empyrean-box-416401"
_ZONE = os.getenv('ZONE') # "us-east1-b"
_REGION = '-'.join(_ZONE.split('-')[:2])
_MACHINE_TYPE = os.getenv('MACHINE_TYPE') # "c2-standard-8"
_SERVICE_ACCOUNT = os.getenv('SERVICE_ACCOUNT') # "service-account1@empyrean-box-416401.iam.gserviceaccount.com"
_CLOUD_USER = os.getenv('CLOUD_USER') # "njohe"
_KEY_FILE = os.getenv('KEY_FILE') # "./ninaServiceKey2.json"
_INSTANCE_EXISTS = False # os.getenv('INSTANCE_EXISTS')
_INSTANCE_NAME = None # os.getenv('INSTANCE_NAME')
_REPOSITORY = os.getenv('REPOSITORY') # "model-repo"

def generate_instance_name(prefix="myinstance", description="webserver"):
    # Generate a unique identifier using a timestamp
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    # Alternatively, use a UUID for a shorter unique identifier
    # unique_id = str(uuid.uuid4())[:8]
    print(timestamp)
    # Construct the instance name
    instance_name = f"{prefix}-{description}-{timestamp}"

    return instance_name

def count_instances(compute_client: compute_v1.InstancesClient, project_id, zone):
    request = compute_v1.ListInstancesRequest(project=project_id, zone=zone)
    response = compute_client.list(request=request)
    instances = list(response)
    return len(instances)

def list_instances(compute_client: compute_v1.InstancesClient, project_id, zone):
    request = compute_v1.ListInstancesRequest(project=project_id, zone=zone)
    response = compute_client.list(request=request)
    instances = list(response)
    return instances

def get_instance(compute_client: compute_v1.InstancesClient, project_id, zone, instance_name):
    request = compute_v1.GetInstanceRequest(instance=instance_name, project=project_id, zone=zone)
    try:
        response = compute_client.get(request)
        return response
    except:
        print('Could not get instance of name', instance_name)
        return None

def list_docker_images(registry_client: artifactregistry.ArtifactRegistryClient):
    request = artifactregistry.ListDockerImagesRequest(parent=f'projects/{_PROJECT_ID}/locations/{_REGION}/repositories/models')
    response = registry_client.list_docker_images(request)
    return list(response)

def get_docker_image(registry_client: artifactregistry.ArtifactRegistryClient, image_name: str):
    request = artifactregistry.GetDockerImageRequest(name=f'projects/{_PROJECT_ID}/locations/{_REGION}/repositories/models/dockerImages/{image_name}:latest')
    try:
        response = registry_client.get_docker_image(request)
        artifactregistry.GetTagRequest()
        return response
    except Exception as e:
        print('Could not get docker image of name', image_name)
        print(e)
        return None
    
def get_credentials():
    """Authenticate using a service account JSON file."""
    print('Authenticating with service account from', _KEY_FILE)
    credentials = service_account.Credentials.from_service_account_file(_KEY_FILE)
    scoped_credentials = credentials.with_scopes(['https://www.googleapis.com/auth/cloud-platform'])
    
    scoped_credentials.refresh(Request())
    print('Successfully authenticated.')
    return scoped_credentials

def get_compute_client(credentials):
    return compute_v1.InstancesClient(credentials=credentials)

def create(
        compute_client: compute_v1.InstancesClient,
        project_id: str,
        zone: str,
        instance_name: str,
        machine_type: str,
        disk_type: str,
        source_image: str,
        disk_size: int
        ):


    params = compute_v1.AttachedDiskInitializeParams(disk_size_gb=disk_size, disk_type=disk_type, source_image=source_image)
    disk = compute_v1.AttachedDisk(auto_delete=True, boot=True, initialize_params=params)
    access_config = compute_v1.AccessConfig(network_tier='PREMIUM')
    network = compute_v1.NetworkInterface(access_configs=[access_config], subnetwork=f'/regions/{_REGION}/subnetworks/default')
    service_account = compute_v1.ServiceAccount(email=_SERVICE_ACCOUNT, scopes=['https://www.googleapis.com/auth/compute', 'https://www.googleapis.com/auth/devstorage.read_write'])
    tags = compute_v1.Tags(items=['http-server', 'https-server'])
    shielded_config = compute_v1.ShieldedInstanceConfig(enable_integrity_monitoring=True, enable_vtpm=True, enable_secure_boot=False)
    # compute_v1.ShieldedInstanceIntegrityPolicy(update_auto_learn_policy=True)
    instance = compute_v1.Instance(
        disks=[disk], 
        machine_type=f'zones/{zone}/machineTypes/{machine_type}', 
        name=instance_name, 
        network_interfaces=[network],
        service_accounts=[service_account],
        tags=tags,
        shielded_instance_config=shielded_config
    )
    request = compute_v1.InsertInstanceRequest(instance_resource=instance, project=project_id, zone=zone)
    response = compute_client.insert(request)
    print('Sent request')
    return response

# starts the run by calling create function and passing in configs
def create_new_instance(compute_client, instance_name, project_id, zone, machine_type, instance_limit):
    # compute_client = compute_v1.InstancesClient()
    instance_count = count_instances(compute_client, project_id, zone)
    print(instance_count, 'instances running.')
    if instance_count >= instance_limit:
        return "Google Cloud is at its limit, please wait.", 500
    
    if instance_count == 0:
        global _INSTANCE_NAME
        instance_name = generate_instance_name()
        _INSTANCE_NAME = instance_name
        
        vm_instance = create(
            compute_client=compute_client,
            project_id=project_id,
            zone=zone,
            instance_name=instance_name,
            machine_type=machine_type,
            disk_type=f'projects/{project_id}/zones/{zone}/diskTypes/pd-standard',
            source_image='projects/cos-cloud/global/images/cos-101-17162-386-59', # NOTE: replace this?
            disk_size=50
        )
        
        return vm_instance

def get_registry_client(credentials):
    return artifactregistry.ArtifactRegistryClient(credentials=credentials)

# def upload_docker_to_registry(registry_client: artifactregistry.ArtifactRegistryClient):
def upload_docker_to_registry(service_account_access_token: str):
    # print(service_account_access_token)
    # Log in to service account
    # print('Logging into service account')
    # try:
    #     subprocess.run(['gcloud', 'auth', 'activate-service-account', f'--key-file={_KEY_FILE}']).check_returncode()
    # except subprocess.CalledProcessError as e:
    #     print('Could not log in with keyfile', e)
    #     return
    
    subprocess.run(['docker', 'login', '-u oauth2accesstoken', f'-p "{service_account_access_token}"', f'"https://{_REGION}-docker.pkg.dev/"'])
    
    _IMAGE_NAME = 'hello-app'
    _TAG = 'latest'
    _TO_PUSH = f'us-docker.pkg.dev/google-samples/containers/gke/hello-app:1.0'
    docker_tag = f'{_REGION}-docker.pkg.dev/{_PROJECT_ID}/{_REPOSITORY}/{_IMAGE_NAME}:{_TAG}'
    # artifactregistry.DockerImage()

    print('running tag')
    subprocess.run(['docker', 'tag', _TO_PUSH, docker_tag])
    print('running push')
    subprocess.run(['docker', 'push', docker_tag])
    
    # registry_client
    # artifactregistry.CreateTagRequest(
    #     parent=f'us-east4-docker.pkg.dev/{_PROJECT_ID}/${_REPOSITORY}/{_IMAGE_NAME}',
    #     tag_id=_TAG
    #     )
    # artifactregistry.Tag(name='',version=_TAG)
    # registry_client.create_tag()

def pull_docker_to_compute(compute_client: compute_v1.InstancesClient, image_name, instance: compute_v1.Instance):
    docker_image_metadata = compute_v1.Items(key='image-name', value=f'{_REGION}-docker.pkg.dev/{_PROJECT_ID}/{_REPOSITORY}/{image_name}')
    dicom_image_metadata = compute_v1.Items(key='dicom-image', value='1-009.dcm')
      
    setup_script = '''#! /bin/bash
    echo "Script is starting"
    export DOCKER_CONFIG=/home/${USER}/.docker
    mkdir -p ${DOCKER_CONFIG}
    chmod 700 ${DOCKER_CONFIG}
    
    echo "Running startup script" > /var/log/startup_status.log

    docker-credential-gcr configure-docker --registries=''' + _REGION + '''-docker.pkg.dev
    if [ $? -ne 0 ]; then
        echo "Failed to configure Docker"
        exit 1
    fi
    
    echo "Docker configured"

    DOCKER_IMAGE_NAME=$(curl -f "http://metadata.google.internal/computeMetadata/v1/instance/attributes/image-name" -H "Metadata-Flavor: Google")
    if [ $? -ne 0 ]; then
        echo "Failed to retrieve Docker image from registry" > /var/log/startup_status.log
        exit 1
    fi

    DICOM_IMAGE=$(curl -f "http://metadata.google.internal/computeMetadata/v1/instance/attributes/dicom-image" -H "Metadata-Flavor: Google")
    if [ $? -ne 0 ]; then
        echo "Failed to retrieve DICOM image" > /var/log/startup_status.log
        exit 1
    fi
    
    echo "Pulling docker image..."

    docker pull ${DOCKER_IMAGE_NAME}
    if [ $? -ne 0 ]; then
        echo "Failed to pull Docker image"
        exit 1
    fi
    
    echo "Pull success"
    echo "Running docker image"

    CONTAINER_ID=$(docker run -d ${DOCKER_IMAGE_NAME})
    if [ -z "${CONTAINER_ID}" ]; then
        echo "Failed to start container" > /var/log/startup_status.log
        exit 1
    fi
    
    echo "Docker image running on container $CONTAINER_ID"
    echo "Copying dicom images to container"

    docker cp /home/''' + _CLOUD_USER + '''/${DICOM_IMAGE} ${CONTAINER_ID}:/app/${DICOM_IMAGE}
    if [ $? -ne 0 ]; then
        echo "Failed to copy DICOM image to container" > /var/log/startup_status.log
        exit 1
    fi
    
    echo "Dicom image copied"


    while true; do
        output=$(docker container diff ${CONTAINER_ID})
        if echo "$output" | grep -q "A /app/${DICOM_IMAGE}-multiorgan-segmentation.dcm"; then
            docker cp ${CONTAINER_ID}:/app /home/''' + _CLOUD_USER +'''
            break
        fi
        sleep 2
    done

    echo "script has finished running"
    '''
    # compute_client.get()
    startup_script_metadata = compute_v1.Items(key='startup-script', value=setup_script)
    
    metadata = compute_v1.Metadata(items=[docker_image_metadata, dicom_image_metadata, startup_script_metadata], fingerprint=instance.metadata.fingerprint)
    request = compute_v1.SetMetadataInstanceRequest(instance=instance.name, metadata_resource=metadata, project=_PROJECT_ID, zone=_ZONE)
    # request = compute_v1.SetCommonInstanceMetadataProjectRequest(metadata_resource=metadata, project=_PROJECT_ID)
    first_metadata_request = compute_client.set_metadata(request)  
    # startup_script_metadata = compute_v1.Items(key='startup-script', value=setup_script)
    # startup_metadata = compute_v1.Metadata(items=[startup_script_metadata], fingerprint=instance.metadata.fingerprint)
    # startup_request = compute_v1.SetMetadataInstanceRequest(instance=instance.name, metadata_resource=startup_metadata, project=_PROJECT_ID, zone=_ZONE)
    
    def on_metadata_added(_):
        print('done')
        ## TODO: use paramiko to ssh (or just use gcloud ssh)
        
    first_metadata_request.add_done_callback(lambda _: on_metadata_added)
    print('adding startup script')
    ## TODO: need to actually ssh and run the startup script
    # NOTE: this func only run when predicting. Uploading the DICOM images is separate and comes FIRST
    # sudo google_metadata_script_runner startup
    # Creating the instance happens model is uploaded (in old code. Probably better to create when predicting instead?)
    # first_metadata_request.add_done_callback(lambda _: compute_client.set_metadata(startup_request).add_done_callback(on_metadata_added))
# def load_dicom(filepath: str):

if __name__ == '__main__':
    print('get...')
    credentials = get_credentials()
    registry_client = get_registry_client(credentials) 
    # print(credentials.token)

    # print(list_docker_images(registry_client))
    # print(credentials)
    # upload_docker_to_registry(credentials.token)
    
    # compute_client = (get_compute_client(credentials))
    # print(list_instances(compute_client, _PROJECT_ID, _ZONE))
    # print(_INSTANCE_NAME, _PROJECT_ID, _ZONE)
    # # new_instance = create_new_instance(client, _INSTANCE_NAME, _PROJECT_ID, _ZONE, _MACHINE_TYPE, _INSTANCE_LIMIT)
    # # print(new_instance)
    # pull_docker_to_compute(compute_client)
    
    def handle_instance(compute_client, instance, image_name):
        print('Instance id:', instance.id)
        pull_docker_to_compute(compute_client, image_name, instance)
    
    CREATE_NEW_INSTANCE = False
    DOCKER_IMAGE_NAME = 'hello-app'
    compute_client = get_compute_client(credentials)
    # docker_image = get_docker_image(registry_client, DOCKER_IMAGE_NAME)
    # if docker_image is None and CREATE_NEW_INSTANCE and False:
    if CREATE_NEW_INSTANCE:
        # print(list_instances(compute_client, _PROJECT_ID, _ZONE))
        print('Creating new instance...')
        new_instance = create_new_instance(compute_client, _INSTANCE_NAME, _PROJECT_ID, _ZONE, _MACHINE_TYPE, _INSTANCE_LIMIT)
        if isinstance(new_instance, ExtendedOperation):
            CURR_INSTANCE = None
            def update_curr_instance(x):
                global CURR_INSTANCE
                CURR_INSTANCE = x
            # new_instance.add_done_callback(lambda x: handle_instance(compute_client, x, DOCKER_IMAGE_NAME))
            new_instance.add_done_callback(update_curr_instance)
            while not new_instance.done():
                print('Waiting...')
                time.sleep(2)
                print(new_instance.status)
            print(new_instance.result(), new_instance.status)
            # new_instance.
            time.sleep(0.5)
            handle_instance(compute_client, CURR_INSTANCE, DOCKER_IMAGE_NAME)
        else: 
            print('Something went wrong:')
            print(new_instance)
    else:
        # TODO: this should come from somewhere. I don't know where
        COMPUTE_INSTANCE_NAME = 'myinstance-webserver-20241022145454' # 'myinstance-webserver-20241017160547'
        compute_instance = get_instance(compute_client, _PROJECT_ID, _ZONE, COMPUTE_INSTANCE_NAME)
        
        # pull_docker_to_compute(compute_client, DOCKER_IMAGE_NAME)
        handle_instance(compute_client, compute_instance, DOCKER_IMAGE_NAME)
        
    ## TODO: need script to create ubuntu docker image from model
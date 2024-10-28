import os
from gcloud_auth import get_compute_client, get_credentials
from dotenv import load_dotenv
from google.cloud import compute_v1, artifactregistry
from google.api_core.extended_operation import ExtendedOperation
from google.auth import compute_engine
from google.auth.transport.requests import Request
from google.oauth2 import service_account
from datetime import datetime
import subprocess
import time
from enum import Enum
from typing import List

load_dotenv(override=True)
_INSTANCE_LIMIT = 1
_PROJECT_ID = os.getenv('PROJECT_ID')
_ZONE = os.getenv('ZONE')
_REGION = '-'.join(_ZONE.split('-')[:2])
_MACHINE_TYPE = os.getenv('MACHINE_TYPE')
_SERVICE_ACCOUNT = os.getenv('SERVICE_ACCOUNT')
_KEY_FILE = os.getenv('KEY_FILE')
_INSTANCE_EXISTS = False
_INSTANCE_NAME = None
_REPOSITORY = os.getenv('REPOSITORY')
_USERNAME = os.environ.get('USER')

## Functions for Compute Instances
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
    
class IPType(Enum):
    INTERNAL = "internal"
    EXTERNAL = "external"
    IP_V6 = "ipv6"

# https://cloud.google.com/compute/docs/instances/view-ip-address#python
def get_instance_ip_address(
    instance: compute_v1.Instance, ip_type: IPType
) -> List[str]:
    """
    Retrieves the specified type of IP address (ipv6, internal or external) of a specified Compute Engine instance.

    Args:
        instance (compute_v1.Instance): instance to get
        ip_type (IPType): The type of IP address to retrieve (ipv6, internal or external).

    Returns:
        List[str]: Requested type IP addresses of the instance.
    """
    ips = []
    if not instance.network_interfaces:
        return ips
    for interface in instance.network_interfaces:
        if ip_type == IPType.EXTERNAL:
            for config in interface.access_configs:
                if config.type_ == "ONE_TO_ONE_NAT":
                    ips.append(config.nat_i_p)
        elif ip_type == IPType.IP_V6:
            for ipv6_config in getattr(interface, "ipv6_access_configs", []):
                if ipv6_config.type_ == "DIRECT_IPV6":
                    ips.append(ipv6_config.external_ipv6)

        elif ip_type == IPType.INTERNAL:
            # Internal IP is directly available in the network interface
            ips.append(interface.network_i_p)
    return ips
    
def create_instance_helper(
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
    print('Sent create instance request')
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
        
        vm_instance = create_instance_helper(
            compute_client=compute_client,
            project_id=project_id,
            zone=zone,
            instance_name=instance_name,
            machine_type=machine_type,
            disk_type=f'projects/{project_id}/zones/{zone}/diskTypes/pd-standard',
            source_image='projects/cos-cloud/global/images/cos-101-17162-386-59',
            disk_size=50
        )
        
        return vm_instance

## Docker Images and Artifact Registry
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
    
def upload_docker_image_to_artifact_registry_helper(service_account_access_token: str, image_name: str, tarball_path: str, LOG=False, skip_push=False, override_existing=False, direct_push=False):
    if LOG:
        print('Logging into docker with service account')
    subprocess.run(['docker', 'login', '-u', 'oauth2accesstoken', '--password-stdin', f'https://{_REGION}-docker.pkg.dev'], check=True, input=service_account_access_token, text=True)
    
    _IMAGE_NAME = image_name
    _TAG = 'latest'
    docker_tag = f'{_REGION}-docker.pkg.dev/{_PROJECT_ID}/{_REPOSITORY}/{_IMAGE_NAME}:{_TAG}'
    
    docker_img_exists_output = subprocess.check_output(['docker', 'images', '-q', f'{_IMAGE_NAME}:{_TAG}'], text=True)
    
    if not direct_push and (override_existing or docker_img_exists_output.strip() == ''):
        if LOG:
            print('Loading docker image. This may take a while...')
        try:
            # TODO: instead of import use load? or just put entrypoint in docker run
            # subprocess.run(f'docker import "{tarball_path}" "{_IMAGE_NAME}:{_TAG}"', check=True, shell=True, cwd='.')
            subprocess.run(f'docker load -i "{tarball_path}"', check=True, shell=True, cwd='.')
        except Exception as e:
            print('Could not load docker image from tarball')
            # print(e)
            exit()
    else: 
        print(f'Docker image of name {_IMAGE_NAME} already exists')
    
    if LOG:
        print('running tag')
    subprocess.run(['docker', 'tag', f'{_IMAGE_NAME}:{_TAG}', docker_tag])
    
    if skip_push:
        return
    
    if LOG:
        print('running push')
    subprocess.run(['docker', 'push', docker_tag])
    
# Uploads a Dockerized ML model to Google Artifact Registry
# NOTE: image_name MUST be the same as the name used for docker build + docker save
def upload_docker_image_to_artifact_registry(image_name: str, tarball_path: str, LOG=False, skip_push=False, override_existing=False, direct_push=False):
    credentials = get_credentials(_KEY_FILE)
    return upload_docker_image_to_artifact_registry_helper(credentials.token, image_name, tarball_path, LOG=LOG, skip_push=skip_push, override_existing=override_existing, direct_push=direct_push)
    
## Connecting Compute and Registry
# Put setup script and other metadata into instance
def setup_instance_metadata(compute_client: compute_v1.InstancesClient, image_name, instance: compute_v1.Instance):
    docker_image_metadata = compute_v1.Items(key='image-name', value=f'{_REGION}-docker.pkg.dev/{_PROJECT_ID}/{_REPOSITORY}/{image_name}')
    # dicom_image_metadata = compute_v1.Items(key='dicom-image', value='1-009.dcm')
    
    with open('./compute-setup-script.sh', 'r') as f:
        setup_script = f.read().replace('{_REGION}', _REGION)
       
    startup_script_metadata = compute_v1.Items(key='startup-script', value=setup_script)
    
    # metadata = compute_v1.Metadata(items=[docker_image_metadata, dicom_image_metadata, startup_script_metadata], fingerprint=instance.metadata.fingerprint)
    metadata = compute_v1.Metadata(items=[docker_image_metadata, startup_script_metadata], fingerprint=instance.metadata.fingerprint)
    request = compute_v1.SetMetadataInstanceRequest(instance=instance.name, metadata_resource=metadata, project=_PROJECT_ID, zone=_ZONE)
    # request = compute_v1.SetCommonInstanceMetadataProjectRequest(metadata_resource=metadata, project=_PROJECT_ID)
    print('Setting up startup script on instance...')
    first_metadata_request = compute_client.set_metadata(request) 
    first_metadata_request.add_done_callback(lambda _: print('Done setting up startup script')) 
    # startup_script_metadata = compute_v1.Items(key='startup-script', value=setup_script)
    # startup_metadata = compute_v1.Metadata(items=[startup_script_metadata], fingerprint=instance.metadata.fingerprint)
    # startup_request = compute_v1.SetMetadataInstanceRequest(instance=instance.name, metadata_resource=startup_metadata, project=_PROJECT_ID, zone=_ZONE)

def upload_dicom_to_instance(dicom_image_directory: str, dicom_series_name: str, instance_name: str, run_auth=True) -> bool:
    if run_auth:
        try:
            # Log into service account with gcloud
            subprocess.run(['gcloud', 'auth', 'activate-service-account', _SERVICE_ACCOUNT, f'--key-file={_KEY_FILE}'], check=True)
        except Exception as e:
            print('Authenticating with service account failed')
            return False
     
    try:
        username = _USERNAME
        # Create images/ directory
        subprocess.run(['gcloud', 'compute', 'ssh', f'{username}@{instance_name}', 
                        f'--project={_PROJECT_ID}', 
                        f'--zone={_ZONE}',
                        f'--command=mkdir -p /home/{username}/images && mkdir -p /home/{username}/model_outputs && rm -rf /home/{username}/images/{dicom_series_name}'], check=True, input='\n', text=True)
        # Upload
        subprocess.run(['gcloud', 'compute', 'scp',
                        f'--project={_PROJECT_ID}', 
                        f'--zone={_ZONE}',
                        '--recurse',
                        dicom_image_directory,
                        f'{username}@{instance_name}:/home/{username}/images/{dicom_series_name}'], check=True)
    except Exception as e:
        print('DICOM upload failed')
        return False
    
    return True

# Creates an instance and pulls the model from registry to it. Returns if successfully created or not
def setup_compute(image_name: str, use_existing_instance_name: str = None, skip_metadata=False) -> bool:
    credentials = get_credentials(_KEY_FILE)
    compute_client = get_compute_client(credentials)
    CURR_INSTANCE = None
    if use_existing_instance_name is None:
        instance = create_new_instance(compute_client, generate_instance_name(), _PROJECT_ID, _ZONE, _MACHINE_TYPE, _INSTANCE_LIMIT)
        
        # If instance was not created successfully
        if not isinstance(instance, ExtendedOperation):
            # TODO: return error code as response to frontend
            print(instance)
            return False
        
        # TODO: in the flask server we will handle everything async with:
        #   instance.add_done_callback(...)
        
        ## But for testing, just do it synchronously:
        def update_curr_instance(x):
            # Update the global variable for the current instance
            global CURR_INSTANCE
            CURR_INSTANCE = x
            
        instance.add_done_callback(update_curr_instance)
        print('Waiting for compute instance to be created...')
        while not instance.done():
            time.sleep(2)
            # print(instance.status)
        print(instance.result(), instance.status)
        time.sleep(0.5)
        ##
    else:
        CURR_INSTANCE = get_instance(compute_client, _PROJECT_ID, _ZONE, use_existing_instance_name)
        global _INSTANCE_NAME
        
    _INSTANCE_NAME = CURR_INSTANCE.name
    if not skip_metadata:
        setup_instance_metadata(compute_client, image_name, CURR_INSTANCE)
    return True

# Run predictions on existing compute instance. Assumes DICOM images have already been uploaded to ./dicom-images/
def run_predictions(dicom_series_name: str, instance_name: str, skip_predictions: bool = False) -> bool:
    print('Predicting', dicom_series_name)
    try:
        username = _USERNAME
        
        # Log into service account with gcloud
        subprocess.run(['gcloud', 'auth', 'activate-service-account', _SERVICE_ACCOUNT, f'--key-file={_KEY_FILE}'], check=True)
        if not skip_predictions:
            # Set the directory on instance where DICOM images will be pulled from
            subprocess.run(['gcloud', 'compute', 'instances', 'add-metadata', instance_name, 
                            f'--project={_PROJECT_ID}', 
                            f'--zone={_ZONE}',
                            f'--metadata=dicom-image={dicom_series_name},username={username}'], check=True)
            
            # Copy over DICOM images from server to instance
            if not upload_dicom_to_instance(f'./dicom-images/{dicom_series_name}', dicom_series_name, instance_name, run_auth=False):
                raise Exception()
            
            # Run startup script (compute-setup-script.sh). This blocks until predictions are made
            subprocess.run(['gcloud', 'compute', 'ssh', f'{username}@{instance_name}', 
                            f'--project={_PROJECT_ID}', 
                            f'--zone={_ZONE}',
                            '--command=sudo google_metadata_script_runner startup'], check=True, input='\n', text=True)
            
        # Copy over DICOM images (predictions) from instance to server
        subprocess.run(['mkdir', '-p', './dcm-prediction/'])
        subprocess.run(['gcloud', 'compute', 'scp',
                        f'--project={_PROJECT_ID}', 
                        f'--zone={_ZONE}',
                        f'{username}@{instance_name}:/home/{username}/model_outputs/{dicom_series_name}-multiorgan-segmentation.dcm',
                        './dcm-prediction/'])
        
        # TODO: upload predictions to Orthanc
    except Exception as e:
        print('Something went wrong with running predictions:')
        print(e)
        return False
    
    return True

if __name__ == '__main__':
    # credentials = get_credentials(_KEY_FILE)
    # compute_client = get_compute_client(credentials)
    # setup_model_compute('asdf', None)
    
    # TODO: these variables will have to come from somewhere, likely the frontend API requests
    COMPUTE_INSTANCE_NAME = 'myinstance-webserver-20241028191333' # set this to None to create a new instance. (you might have to re-run the program after doing this. It's a little bugged)
    DICOM_SERIES_TO_PREDICT = 'PANCREAS_0005'
    DOCKER_MODEL_NAME = 'organ-segmentation-model'
    
    # instance = get_instance(compute_client, _PROJECT_ID, _ZONE, COMPUTE_INSTANCE_NAME)
    
    if not setup_compute(DOCKER_MODEL_NAME, use_existing_instance_name=COMPUTE_INSTANCE_NAME):
        print('error')
        exit()
        
    COMPUTE_INSTANCE_NAME = _INSTANCE_NAME
    print(COMPUTE_INSTANCE_NAME)
        
    run_predictions(f'{DICOM_SERIES_TO_PREDICT}', COMPUTE_INSTANCE_NAME, skip_predictions=False)
    
    # print(get_instance_ip_address(instance, IPType.EXTERNAL))

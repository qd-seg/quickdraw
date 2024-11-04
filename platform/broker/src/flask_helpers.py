import os
from gcloud_auth import get_compute_client, get_credentials, auth_with_key_file_json, get_registry_client
from dotenv import load_dotenv
from google.cloud import compute_v1, artifactregistry
from google.api_core.extended_operation import ExtendedOperation
from datetime import datetime
import subprocess
import time
from enum import Enum
from typing import List, Union
import json 
from google.api_core.datetime_helpers import DatetimeWithNanoseconds

# _USERNAME = os.environ.get('USER')
_USERNAME = 'cmsc435'
_MAX_TIMEOUT_NORMAL_REQUEST = 60
_MAX_TIMEOUT_COMPUTE_REQUEST = 360

def read_json(filename, default_as_dict=True) -> Union[List, dict]:
    """Reads a JSON file and returns its content."""
    try:
        with open(filename, 'r') as file:
            return json.load(file)
    except FileNotFoundError:
        return {} if default_as_dict else []

def write_json(filename, data):
    """Writes data to a JSON file."""
    with open(filename, 'w') as file:
        json.dump(data, file)

def get_region_name(zone: str):
    return '-'.join(zone.split('-')[:-1])

## Functions for Compute Instances
def generate_instance_name(prefix="myinstance", description="webserver"):
    # Generate a unique identifier using a timestamp
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    # Alternatively, use a UUID for a shorter unique identifier
    # unique_id = str(uuid.uuid4())[:8]
    print('Generated instance name at:', timestamp)
    # Construct the instance name
    instance_name = f"{prefix}-{description}-{timestamp}"

    return instance_name

def count_instances(project_id, zone):    
    request = compute_v1.ListInstancesRequest(project=project_id, zone=zone)
    response = get_compute_client().list(request=request)
    instances = list(response)
    return len(instances)

def list_instances(project_id, zone):
    request = compute_v1.ListInstancesRequest(project=project_id, zone=zone)
    response = get_compute_client().list(request=request)
    instances = list(response)
    return instances

def start_instance(project_id, zone, instance_name):
    request = compute_v1.StartInstanceRequest(project=project_id, zone=zone, instance=instance_name)
    response = get_compute_client().start(request)
    return response.result(timeout=_MAX_TIMEOUT_COMPUTE_REQUEST)

def stop_instance(project_id, zone, instance_name):
    request = compute_v1.StopInstanceRequest(discard_local_ssd=False, project=project_id, zone=zone, instance=instance_name)
    response = get_compute_client().stop(request)
    return response.result(timeout=_MAX_TIMEOUT_COMPUTE_REQUEST)

def get_instance(project_id, zone, instance_name):    
    request = compute_v1.GetInstanceRequest(instance=instance_name, project=project_id, zone=zone)
    try:
        response = get_compute_client().get(request)
        return response
    except Exception as e:
        # print(e)
        print('Could not get instance of name', instance_name)
        return None
    
def delete_instance(project_id, zone, instance_name):
    print('Deleting instance:', instance_name)
    request = compute_v1.DeleteInstanceRequest(project=project_id, zone=zone, instance=instance_name)
    response = get_compute_client().delete(request)
    return response.result(timeout=_MAX_TIMEOUT_COMPUTE_REQUEST)
    
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
        project_id: str,
        zone: str,
        instance_name: str,
        machine_type: str,
        disk_type: str,
        source_image: str,
        disk_size: int,
        service_account: str,
        ):
    params = compute_v1.AttachedDiskInitializeParams(disk_size_gb=disk_size, disk_type=disk_type, source_image=source_image)
    disk = compute_v1.AttachedDisk(auto_delete=True, boot=True, initialize_params=params)
    access_config = compute_v1.AccessConfig(network_tier='PREMIUM')
    network = compute_v1.NetworkInterface(access_configs=[access_config], subnetwork=f'/regions/{get_region_name(zone)}/subnetworks/default')
    service_account = compute_v1.ServiceAccount(email=service_account, scopes=['https://www.googleapis.com/auth/compute', 'https://www.googleapis.com/auth/devstorage.read_write'])
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
    response = get_compute_client().insert(request)
    print('Sent create instance request')
    return response.result(timeout=_MAX_TIMEOUT_COMPUTE_REQUEST)

## NOTE: should probably change this name. This is only a helper function. Use setup_compute_instance() instead
def create_new_instance(instance_name, project_id, zone, machine_type, instance_limit, service_account_email):
    # compute_client = compute_v1.InstancesClient()
    instance_count = count_instances(project_id, zone)
    print(instance_count, 'instances running.')
    if instance_count >= instance_limit:
        return "Google Cloud is at its limit, please wait.", 500
    
    if instance_count == 0:        
        vm_instance = create_instance_helper(
            project_id=project_id,
            zone=zone,
            instance_name=instance_name,
            machine_type=machine_type,
            disk_type=f'projects/{project_id}/zones/{zone}/diskTypes/pd-standard',
            source_image='projects/cos-cloud/global/images/cos-101-17162-386-59',
            disk_size=50,
            service_account=service_account_email
        )
        
        return vm_instance

## Docker Images and Artifact Registry
def list_docker_images(project_id: str, zone: str, models_repo: str, specific_tags: bool = False):
    '''Lists all Docker images. If specific_tags, list all tags. Otherwise, list all packages.'''
    if specific_tags:
        request = artifactregistry.ListDockerImagesRequest(parent=f'projects/{project_id}/locations/{get_region_name(zone)}/repositories/{models_repo}')
        response = get_registry_client().list_docker_images(request)
        return list(response)

    else:
        request = artifactregistry.ListPackagesRequest(parent=f'projects/{project_id}/locations/{get_region_name(zone)}/repositories/{models_repo}')
        response = get_registry_client().list_packages(request)
        return list(response)
    
def get_docker_image(project_id: str, zone: str, models_repo: str, image_name: str):
    request = artifactregistry.GetDockerImageRequest(name=f'projects/{project_id}/locations/{get_region_name(zone)}/repositories/{models_repo}/dockerImages/{image_name}:latest')
    try:
        response = get_registry_client().get_docker_image(request)
        artifactregistry.GetTagRequest()
        return response
    except Exception as e:
        print('Could not get docker image of name', image_name)
        print(e)
        return None
    
def delete_docker_image(project_id: str, zone: str, models_repo: str, image_name: str):
    request = artifactregistry.DeletePackageRequest(name=f'projects/{project_id}/locations/{get_region_name(zone)}/repositories/{models_repo}/packages/{image_name}')
    try:
        response = get_registry_client().delete_package(request)
        return response.result(timeout=_MAX_TIMEOUT_COMPUTE_REQUEST)
    except Exception as e:
        print('Could not get docker image of name', image_name)
        print(e)
        return None
    
def upload_docker_image_to_artifact_registry_helper(project_id: str, zone: str, models_repo: str, service_account_access_token: str, image_name: str, tarball_path: str, LOG=False, skip_push=False, override_existing=False, direct_push=False):
    region = get_region_name(zone)
    if LOG:
        print('Logging into docker with service account')
    subprocess.run(['docker', 'login', '-u', 'oauth2accesstoken', '--password-stdin', f'https://{region}-docker.pkg.dev'], check=True, input=service_account_access_token, text=True)
    
    _IMAGE_NAME = image_name
    _TAG = 'latest'
    docker_tag = f'{region}-docker.pkg.dev/{project_id}/{models_repo}/{_IMAGE_NAME}:{_TAG}'
    
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
def upload_docker_image_to_artifact_registry(project_id: str, zone: str, models_repo: str, image_name: str, tarball_path: str, LOG=False, skip_push=False, override_existing=False, direct_push=False):
    credentials = get_credentials()
    return upload_docker_image_to_artifact_registry_helper(project_id, zone, models_repo, credentials.token, image_name, tarball_path, LOG=LOG, skip_push=skip_push, override_existing=override_existing, direct_push=direct_push)
    
## Connecting Compute and Registry
# Put setup script and other metadata into instance
def setup_instance_metadata(project_id: str, zone: str, models_repo: str, image_name: str, instance: compute_v1.Instance):
    region = get_region_name(zone)
    docker_image_metadata = compute_v1.Items(key='image-name', value=f'{region}-docker.pkg.dev/{project_id}/{models_repo}/{image_name}')
    # dicom_image_metadata = compute_v1.Items(key='dicom-image', value='1-009.dcm')
    
    with open('./compute-setup-script.sh', 'r') as f:
        setup_script = f.read().replace('{_REGION}', region)
       
    startup_script_metadata = compute_v1.Items(key='startup-script', value=setup_script)
    
    # metadata = compute_v1.Metadata(items=[docker_image_metadata, dicom_image_metadata, startup_script_metadata], fingerprint=instance.metadata.fingerprint)
    metadata = compute_v1.Metadata(items=[docker_image_metadata, startup_script_metadata], fingerprint=instance.metadata.fingerprint)
    request = compute_v1.SetMetadataInstanceRequest(instance=instance.name, metadata_resource=metadata, project=project_id, zone=zone)
    # request = compute_v1.SetCommonInstanceMetadataProjectRequest(metadata_resource=metadata, project=_PROJECT_ID)
    print('Setting up startup script on instance...')
    first_metadata_request = get_compute_client().set_metadata(request) 
    first_metadata_request.add_done_callback(lambda _: print('Done setting up startup script')) 
    # startup_script_metadata = compute_v1.Items(key='startup-script', value=setup_script)
    # startup_metadata = compute_v1.Metadata(items=[startup_script_metadata], fingerprint=instance.metadata.fingerprint)
    # startup_request = compute_v1.SetMetadataInstanceRequest(instance=instance.name, metadata_resource=startup_metadata, project=_PROJECT_ID, zone=_ZONE)
    return first_metadata_request.result(timeout=_MAX_TIMEOUT_NORMAL_REQUEST)

def upload_dicom_to_instance(project_id: str, zone: str, service_account: str, key_filepath: str, dicom_image_directory: str, dicom_series_name: str, instance_name: str, run_auth=True) -> bool:
    if run_auth:
        try:
            # Log into service account with gcloud
            subprocess.run(['gcloud', 'auth', 'activate-service-account', service_account, f'--key-file={key_filepath}'], check=True)
        except Exception as e:
            print('Authenticating with service account failed')
            return False
     
    try:
        username = _USERNAME
        # Create images/ directory
        subprocess.run(['gcloud', 'compute', 'ssh', f'{username}@{instance_name}', 
                        f'--project={project_id}', 
                        f'--zone={zone}',
                        f'--command=mkdir -p /home/{username}/images && mkdir -p /home/{username}/model_outputs/{dicom_series_name} && rm -rf /home/{username}/images/{dicom_series_name}'], check=True, input='\n', text=True)
        # Upload
        subprocess.run(['gcloud', 'compute', 'scp',
                        f'--project={project_id}', 
                        f'--zone={zone}',
                        '--recurse',
                        dicom_image_directory,
                        f'{username}@{instance_name}:/home/{username}/images/{dicom_series_name}'], check=True)
    except Exception as e:
        print('DICOM upload failed')
        return False
    
    return True

# Creates an instance and pulls the model from registry to it. Returns if successfully created or not
def setup_compute_instance(project_id: str, zone: str, instance_name: str | None, machine_type: str, instance_limit: int, service_account_email: str, image_name: str, models_repo: str = None, skip_metadata=False) -> compute_v1.Instance | None:
    instance = get_instance(project_id, zone, instance_name)
    if instance is None:
        create_new_instance(instance_name, project_id, zone, machine_type, instance_limit, service_account_email)
        instance = get_instance(project_id, zone, instance_name)

    if not skip_metadata:
        if models_repo is None:
            print('Please provide model repository path')
            exit(1)
            
        setup_instance_metadata(project_id, zone, models_repo, image_name, instance)
        
    return instance

# Run predictions on existing compute instance. Assumes DICOM images have already been uploaded to ./dicom-images/
def run_predictions(project_id: str, zone: str, service_account: str, key_filepath: str, dicom_series_name: str, instance_name: str, skip_predictions: bool = False, progress_bar_update_callback = None) -> bool:
    print('Predicting', dicom_series_name)
    try:
        username = _USERNAME
        
        # Start the instance
        start_instance(project_id, zone, instance_name)
        time.sleep(1)
        
        # Log into service account with gcloud
        subprocess.run(['gcloud', 'auth', 'activate-service-account', service_account, f'--key-file={key_filepath}'], check=True)
        if not skip_predictions:
            # Set the directory on instance where DICOM images will be pulled from
            subprocess.run(['gcloud', 'compute', 'instances', 'add-metadata', instance_name, 
                            f'--project={project_id}', 
                            f'--zone={zone}',
                            f'--metadata=dicom-image={dicom_series_name},username={username}'], check=True)
            
            # Copy over DICOM images from server to instance
            if progress_bar_update_callback is not None:
                progress_bar_update_callback(45)
            if not upload_dicom_to_instance(project_id, zone, service_account, key_filepath, f'./dicom-images/{dicom_series_name}', dicom_series_name, instance_name, run_auth=False):
                raise Exception()
            
            if progress_bar_update_callback is not None:
                progress_bar_update_callback(60)
            # Run startup script (compute-setup-script.sh), which makes predictions. This blocks until predictions are made
            subprocess.run(['gcloud', 'compute', 'ssh', f'{username}@{instance_name}', 
                            f'--project={project_id}', 
                            f'--zone={zone}',
                            '--command=sudo google_metadata_script_runner startup'], check=True, input='\n', text=True)
            
        # NOTE: in the future, this may require a separate check to see if the service account is still authorized
        # If the prediction takes too long and the access token expires, that may cause an issue.
        # Copy over DICOM images (predictions) from instance to server
        # subprocess.run(['mkdir', '-p', './dcm-prediction/'])
        if progress_bar_update_callback is not None:
                progress_bar_update_callback(85)
        os.makedirs(f'dcm-prediction/{dicom_series_name}', exist_ok=True)
        subprocess.run(['gcloud', 'compute', 'scp',
                        f'--project={project_id}', 
                        f'--zone={zone}',
                        '--recurse',
                        f'{username}@{instance_name}:/home/{username}/model_outputs/{dicom_series_name}/',
                        f'./dcm-prediction/'])
        
        # Delete files on Instance
        print('Deleting unnecessary files on VM')
        subprocess.run(['gcloud', 'compute', 'ssh', f'{username}@{instance_name}', 
                        f'--project={project_id}', 
                        f'--zone={zone}',
                        f'--command=rm -rf /home/{username}/images && rm -rf /home/{username}/model_outputs'], check=True, input='\n', text=True)
        
        # Stop the instance
        print('Stopping Instance')
        stop_instance(project_id, zone, instance_name)
        
        # TODO: upload predictions to Orthanc
    except Exception as e:
        print('Something went wrong with running predictions:')
        print(e)
        stop_instance(project_id, zone, instance_name)
        return False
    
    return True

if __name__ == '__main__':
    # credentials = get_credentials(_KEY_FILE)
    # compute_client = get_compute_client(credentials)
    # setup_model_compute('asdf', None)
    load_dotenv(override=True)
    _INSTANCE_LIMIT = 1
    _PROJECT_ID = os.getenv('PROJECT_ID')
    _ZONE = os.getenv('ZONE')
    _REGION = '-'.join(_ZONE.split('-')[:-1])
    _MACHINE_TYPE = os.getenv('MACHINE_TYPE')
    _SERVICE_ACCOUNT = os.getenv('SERVICE_ACCOUNT')
    _KEY_FILE = os.getenv('KEY_FILE')
    _REPOSITORY = os.getenv('REPOSITORY')

    auth_with_key_file_json(_KEY_FILE)
    
    # docker_packages = list_docker_images(_PROJECT_ID, _ZONE, _REPOSITORY, specific_tags=False)
    # print({'models': [
    #     {
    #         'name': d.name.split('/')[-1],
    #         'updateTime': d.update_time.rfc3339(),
    #     } for d in docker_packages]})
    # exit()
    
    # TODO: these variables will have to come from somewhere, likely the frontend API requests
    COMPUTE_INSTANCE_NAME = 'myinstance-webserver-20241028191333' # set this to None to create a new instance. (you might have to re-run the program after doing this. It's a little bugged)
    DICOM_SERIES_TO_PREDICT = 'PANCREAS_0005'
    DOCKER_MODEL_NAME = 'organ-segmentation-model'
    
    # instance = get_instance(compute_client, _PROJECT_ID, _ZONE, COMPUTE_INSTANCE_NAME)
    
    instance = setup_compute_instance(_PROJECT_ID, _ZONE, COMPUTE_INSTANCE_NAME, _MACHINE_TYPE, _INSTANCE_LIMIT, DOCKER_MODEL_NAME, _REPOSITORY)
        
    if instance is None:
        print('error')
        exit()
        
    COMPUTE_INSTANCE_NAME = instance.name
    print(COMPUTE_INSTANCE_NAME)
    
    run_predictions(_PROJECT_ID, _ZONE, _SERVICE_ACCOUNT, _KEY_FILE, f'{DICOM_SERIES_TO_PREDICT}', COMPUTE_INSTANCE_NAME, skip_predictions=False)
    
    # print(get_instance_ip_address(instance, IPType.EXTERNAL))

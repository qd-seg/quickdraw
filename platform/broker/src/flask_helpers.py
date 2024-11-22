import os
from gcloud_auth import get_compute_client, get_credentials, auth_with_key_file_json, get_registry_client, read_env_vars
from google.cloud import compute_v1, artifactregistry
from google.api_core.extended_operation import ExtendedOperation
from datetime import datetime
import subprocess
import time
from enum import Enum
from typing import List, Union
import json 
from google.api_core.datetime_helpers import DatetimeWithNanoseconds
from orthanc_functions import get_dicom_series_by_id

# _USERNAME = os.environ.get('USER')
_USERNAME = 'cmsc435'
_MAX_TIMEOUT_NORMAL_REQUEST = 90
_MAX_TIMEOUT_COMPUTE_REQUEST = 640

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
    # if zone == 'us-east4-b': # TEMP
    #     raise Exception('503 SERVICE UNAVAILABLE asdfasdfasdf')
    try:
        request = compute_v1.ListInstancesRequest(project=project_id, zone=zone)
        response = get_compute_client().list(request=request)
        instances = list(response)
        return instances
    except Exception as e:
        print(e)
        return None

def start_instance(project_id, zone, instance_name, block=True):
    request = compute_v1.StartInstanceRequest(project=project_id, zone=zone, instance=instance_name)
    response = get_compute_client().start(request)
    return response.result(timeout=_MAX_TIMEOUT_COMPUTE_REQUEST) if block else response

def stop_instance(project_id, zone, instance_name, block=True):
    request = compute_v1.StopInstanceRequest(discard_local_ssd=False, project=project_id, zone=zone, instance=instance_name)
    response = get_compute_client().stop(request)
    return response.result(timeout=_MAX_TIMEOUT_COMPUTE_REQUEST) if block else response

def resume_instance(project_id, zone, instance_name, block=True):
    request = compute_v1.ResumeInstanceRequest(project=project_id, zone=zone, instance=instance_name)
    response = get_compute_client().resume(request)
    return response.result(timeout=_MAX_TIMEOUT_COMPUTE_REQUEST) if block else response

def suspend_instance(project_id, zone, instance_name, block=True):
    request = compute_v1.SuspendInstanceRequest(discard_local_ssd=False, project=project_id, zone=zone, instance=instance_name)
    response = get_compute_client().suspend(request)
    return response.result(timeout=_MAX_TIMEOUT_COMPUTE_REQUEST) if block else response

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
        removed_instance = False
        for instance in list_instances(project_id, zone):
            if instance.status == 'TERMINATED':
                delete_instance(project_id, zone, instance.name)
                removed_instance = True
                break
        
        if not removed_instance:
            raise Exception("Google Cloud is at its limit, please wait.")
           
    disk_type = 'hyperdisk-balanced' if machine_type.split('-')[0] == 'c4' else 'pd-standard'
    vm_instance = create_instance_helper(
        project_id=project_id,
        zone=zone,
        instance_name=instance_name,
        machine_type=machine_type,
        disk_type=f'projects/{project_id}/zones/{zone}/diskTypes/{disk_type}',
        source_image='projects/cos-cloud/global/images/cos-101-17162-386-59',
        disk_size=50,
        service_account=service_account_email
    )
    
    retry_max = 60
    retry_delay = 5
    retry_total = 0
    instance = get_instance(project_id, zone, instance_name)
    while retry_total <= retry_max and instance is None or instance.status != 'RUNNING':
        print('Instance is not ready yet. Waiting...')
        time.sleep(retry_delay)
        retry_total += retry_delay
        instance = get_instance(project_id, zone, instance_name)
    
    return instance
  
## Connecting Compute and Registry
# Put setup script and other metadata into instance
def setup_instance_metadata(project_id: str, zone: str, models_repo: str, image_name: str, instance: compute_v1.Instance, dicom_series_id: str = None):
    region = get_region_name(zone)
    docker_image_metadata = compute_v1.Items(key='image-name', value=f'{region}-docker.pkg.dev/{project_id}/{models_repo}/{image_name}')
    docker_image_model_displayname_metadata = compute_v1.Items(key='model-displayname', value=image_name)
    if dicom_series_id is not None:
        dicom_series_metadata = compute_v1.Items(key='dicom-image', value=dicom_series_id)
    
    with open('./compute-setup-script.sh', 'r') as f:
        setup_script = f.read().replace('{_REGION}', region)
       
    startup_script_metadata = compute_v1.Items(key='startup-script', value=setup_script)
    
    # metadata = compute_v1.Metadata(items=[docker_image_metadata, dicom_image_metadata, startup_script_metadata], fingerprint=instance.metadata.fingerprint)
    metadata = compute_v1.Metadata(items=[docker_image_metadata, docker_image_model_displayname_metadata, startup_script_metadata, dicom_series_metadata], fingerprint=instance.metadata.fingerprint)
    request = compute_v1.SetMetadataInstanceRequest(instance=instance.name, metadata_resource=metadata, project=project_id, zone=zone)
    # request = compute_v1.SetCommonInstanceMetadataProjectRequest(metadata_resource=metadata, project=_PROJECT_ID)
    print('Setting up startup script on instance...')
    # print(metadata)
    first_metadata_request = get_compute_client().set_metadata(request) 
    first_metadata_request.add_done_callback(lambda _: print('Done setting up startup script')) 
    # startup_script_metadata = compute_v1.Items(key='startup-script', value=setup_script)
    # startup_metadata = compute_v1.Metadata(items=[startup_script_metadata], fingerprint=instance.metadata.fingerprint)
    # startup_request = compute_v1.SetMetadataInstanceRequest(instance=instance.name, metadata_resource=startup_metadata, project=_PROJECT_ID, zone=_ZONE)
    return first_metadata_request.result(timeout=_MAX_TIMEOUT_NORMAL_REQUEST)

def remove_instance_metadata(project_id: str, zone: str, instance: compute_v1.Instance, keys_to_remove: List[str], add_idling=False):
    new_metadata = list(filter(lambda i: i.key not in keys_to_remove, instance.metadata.items))
    if add_idling and not any([m.key == 'idling' for m in new_metadata]):
        new_metadata += [compute_v1.Items(key='idling', value='True')]
        
    latest_metadata = get_instance(project_id, zone, instance.name).metadata
    # print('LATEST',latest_metadata)
    newest_fingerprint = latest_metadata.fingerprint
    metadata = compute_v1.Metadata(items=new_metadata, fingerprint=newest_fingerprint)
    request = compute_v1.SetMetadataInstanceRequest(instance=instance.name, metadata_resource=metadata, project=project_id, zone=zone)
    
    get_compute_client().set_metadata(request).result(timeout=_MAX_TIMEOUT_NORMAL_REQUEST)

def upload_dicom_to_instance(project_id: str, zone: str, service_account: str, key_filepath: str, dicom_image_directory: str, dicom_series_id: str, instance_name: str, run_auth=True) -> bool:
    if run_auth:
        try:
            print('Auth in upload to dicom instance...')
            # Log into service account with gcloud
            subprocess.run(['gcloud', 'auth', 'activate-service-account', service_account, f'--key-file={key_filepath}'], check=True)
        except Exception as e:
            print('Authenticating with service account failed')
            return False
     
    try:
        # if (cache_dir := os.environ.get('CACHE_DIRECTORY')) is not None:
        #     dicom_image_directory = os.path.abspath(os.path.join(cache_dir, dicom_image_directory))
            
        username = _USERNAME
        # Create images/ directory
        print('Creating directory on instance...')
        # subprocess.run(['gcloud', 'compute', 'ssh', f'{username}@{instance_name}', 
        #                 f'--project={project_id}', 
        #                 f'--zone={zone}',
        #                 '--quiet',
        #                 f'--command=mkdir -p /home/{username}/images && mkdir -p /home/{username}/model_outputs/{dicom_series_id} && rm -rf /home/{username}/images/{dicom_series_id}'], check=True, input='\n', text=True)
        subprocess.run(['gcloud', 'compute', 'ssh', f'{username}@{instance_name}', 
                        f'--project={project_id}', 
                        f'--zone={zone}',
                        '--quiet',
                        f'--command=rm -rf /home/{username}/images/ && rm -rf /home/{username}/model_outputs/ && mkdir -p /home/{username}/images/{dicom_series_id} && mkdir -p /home/{username}/model_outputs/{dicom_series_id} && rm -rf /home/{username}/images/{dicom_series_id}/*'], check=True, input='\n', text=True)
        # Upload
        print('Copying over dicom images..')
        # subprocess.run(['gcloud', 'compute', 'scp',
        #                 f'--project={project_id}', 
        #                 f'--zone={zone}',
        #                 '--recurse',
        #                 '--verbosity=debug',
        #                 '--quiet',
        #                 dicom_image_directory,
        #                 f'{username}@{instance_name}:/home/{username}/images/{dicom_series_id}'], check=True)
        try:
            # raise Exception('asdf')
            subprocess.run(['gcloud', 'compute', 'scp',
                            f'--project={project_id}', 
                            f'--zone={zone}',
                            '--verbosity=debug',
                            '--quiet',
                            '--scp-flag=-l 50000',
                            '--scp-flag=-o ServerAliveInterval=15',
                            '--scp-flag=-o ServerAliveCountMax=10',
                            '--scp-flag=-4',
                            dicom_image_directory,
                            f'{username}@{instance_name}:/home/{username}/images/{dicom_series_id}/'], check=True)
        except Exception as e:
            print(e)
            print('Retrying with set ip...')
            dry_run_cmd = subprocess.run(['gcloud', 'compute', 'scp',
                f'--project={project_id}', 
                f'--zone={zone}',
                '--dry-run',
                '--scp-flag=-l 50000',
                '--scp-flag=-o ServerAliveInterval=15',
                '--scp-flag=-o ServerAliveCountMax=10',
                '--scp-flag=-4',
                dicom_image_directory,
                f'{username}@{instance_name}:/home/{username}/images/{dicom_series_id}/'], check=True, capture_output=True, text=True).stdout
            at_index = dry_run_cmd.find("@")
            colon_index = dry_run_cmd.find(":")
            ips = get_instance_ip_address(get_instance(project_id, zone, instance_name), IPType.EXTERNAL)
            print(ips)
            if len(ips) == 0:
                raise Exception('Instance', instance_name, 'does not have external IP. Please delete it and create a new one.')
            ip = ips[0]
            print(ip)
            modified_cmd = dry_run_cmd[:at_index + 1] + ip + dry_run_cmd[colon_index:]
            subprocess.run(modified_cmd, shell=True, check=True)
            
        print('upload ok', flush=True)
    except Exception as e:
        print('DICOM upload failed')
        print(e, flush=True)
        return False
    
    return True

def get_dicom_series_from_orthanc_to_cache(dicom_series_id: str, cache_subdir='dcm-images/', series_obj_out=[], extract_zip=True):
    if (cache_dir := os.environ.get('CACHE_DIRECTORY')) is not None:
        cache_subdir = os.path.abspath(os.path.join(cache_dir, cache_subdir))
    temp_images_path = os.path.join(cache_subdir, dicom_series_id)
    os.makedirs(temp_images_path, exist_ok=True)
    
    # TODO: sometimes there is an out of memory issues and it SIGKILLS the flask process.
    # only happened one time and cannot reproduce
    dicom_series_path = get_dicom_series_by_id(dicom_series_id, temp_images_path, series_obj_out=series_obj_out, extract_zip=extract_zip)
    # dicom_series_path = get_first_dicom_image_series_from_study(patient_id, study_id, temp_images_path)
    print(dicom_series_path)
    return dicom_series_path, temp_images_path

# Creates an instance and pulls the model from registry to it. Returns if successfully created or not
def setup_compute_instance(project_id: str, zone: str, instance_name: str | None, machine_type: str, instance_limit: int, service_account_email: str, image_name: str, models_repo: str = None, skip_metadata=False, dicom_series_id: str = None, docker_zone: str = None) -> compute_v1.Instance | None:
    # if zone == 'us-east4-b': # TEMP
    #     raise Exception('503 SERVICE UNAVAILABLE asdfasdfasdf')
    
    instance = get_instance(project_id, zone, instance_name)
    if instance is None:
        instance = create_new_instance(instance_name, project_id, zone, machine_type, instance_limit, service_account_email)
        # instance = get_instance(project_id, zone, instance_name)
        if instance is None:
            raise Exception('Instance could not be created. Very likely that Google Cloud is temporarily out of resources.')

    if not skip_metadata:
        if models_repo is None:
            print('Please provide model repository path')
            exit(1)
        
        if docker_zone is None:
            docker_zone = zone
        setup_instance_metadata(project_id, docker_zone, models_repo, image_name, instance, dicom_series_id=dicom_series_id)
        instance = get_instance(project_id, zone, instance.name)
    return instance

# Run predictions on existing compute instance. Assumes DICOM images have already been uploaded to ./dicom-images/
def run_predictions(project_id: str, zone: str, service_account: str, key_filepath: str, cached_dicom_series_path: str, dicom_series_id: str, instance_name: str, skip_predictions: bool = False, progress_bar_update_callback = None, stop_instance_at_end: bool = True, pred_cache_dir: str = 'dcm-predictions/', toast_callback=None) -> str | None:
    # Need:
    # where does dicom series come from -> the cache/temp-dcm/study_id/instance_id/...
    # where are images uploaded to -> /home/USER/images/instance_id (uid)
    # need to pass instance_id into setup script through metadata

    print('Predicting', dicom_series_id)
    dcm_prediction_dir = None
    try:
        username = _USERNAME
        
        # Start the instance
        start_instance(project_id, zone, instance_name)
        time.sleep(1)
    except Exception as e:
        print(e)
        resume_instance(project_id, zone, instance_name)
        time.sleep(1)
        
    try:    
        # Log into service account with gcloud
        subprocess.run(['gcloud', 'auth', 'activate-service-account', service_account, f'--key-file={key_filepath}', '--verbosity=debug'], check=True)
        if not skip_predictions:
            print('Set DICOM image directory')
            # Set the directory on instance where DICOM images will be pulled from
            subprocess.run(['gcloud', 'compute', 'instances', 'add-metadata', instance_name, 
                            f'--project={project_id}', 
                            f'--zone={zone}',
                            f'--metadata=dicom-image={dicom_series_id},username={username}'], check=True) 
            
            # Copy over DICOM images from server to instance
            if progress_bar_update_callback is not None:
                progress_bar_update_callback(40)

            print('Uploading DICOM to Compute')
            if not upload_dicom_to_instance(
                project_id, 
                zone, 
                service_account, 
                key_filepath, 
                cached_dicom_series_path,
                dicom_series_id, 
                instance_name, 
                run_auth=False):
                    raise Exception('Upload failed')
            
            if progress_bar_update_callback is not None:
                progress_bar_update_callback(55)
                
            print('Run startup script')
            # Run startup script (compute-setup-script.sh), which makes predictions. This blocks until predictions are made
            subprocess.run(['gcloud', 'compute', 'ssh', f'{username}@{instance_name}', 
                            f'--project={project_id}', 
                            f'--zone={zone}',
                            '--quiet',
                            f'--command=sudo google_metadata_script_runner startup && sudo chmod -R a+rw /home/{username}/model_outputs'], check=True, input='\n', text=True)
            
        # NOTE: in the future, this may require a separate check to see if the service account is still authorized
        # If the prediction takes too long and the access token expires, that may cause an issue.
        # Copy over DICOM images (predictions) from instance to server
        # subprocess.run(['mkdir', '-p', './dcm-prediction/'])
        if progress_bar_update_callback is not None:
                progress_bar_update_callback(80)
                
        dcm_prediction_dir = pred_cache_dir
        if (cache_dir := os.environ.get('CACHE_DIRECTORY')) is not None:
            dcm_prediction_dir = os.path.abspath(os.path.join(cache_dir, dcm_prediction_dir))
            
        os.makedirs(dcm_prediction_dir, exist_ok=True)
        print('Copying over predictions to', dcm_prediction_dir)
        try:
            subprocess.run(['gcloud', 'compute', 'scp',
                            f'--project={project_id}', 
                            f'--zone={zone}',
                            '--recurse',
                            '--verbosity=debug',
                            '--quiet',
                            '--scp-flag=-l 50000',
                            '--scp-flag=-o ServerAliveInterval=15',
                            '--scp-flag=-o ServerAliveCountMax=10',
                            '--scp-flag=-4',
                            f'{username}@{instance_name}:/home/{username}/model_outputs/{dicom_series_id}/',
                            dcm_prediction_dir], check=True)
        except Exception as e:
            print(e)
            print('Retrying with set ip...')
            dry_run_cmd = subprocess.run(['gcloud', 'compute', 'scp',
                f'--project={project_id}', 
                f'--zone={zone}',
                '--dry-run',
                '--scp-flag=-l 50000',
                '--scp-flag=-o ServerAliveInterval=15',
                '--scp-flag=-o ServerAliveCountMax=10',
                '--scp-flag=-4',
                f'{username}@{instance_name}:/home/{username}/model_outputs/{dicom_series_id}/',
                dcm_prediction_dir], check=True, capture_output=True, text=True).stdout
            at_index = dry_run_cmd.find("@")
            colon_index = dry_run_cmd.find(":")
            ips = get_instance_ip_address(get_instance(project_id, zone, instance_name), IPType.EXTERNAL)
            print(ips)
            if len(ips) == 0:
                raise Exception('Instance', instance_name, 'does not have external IP. Please delete it and create a new one.')
            ip = ips[0]
            print(ip)
            modified_cmd = dry_run_cmd[:at_index + 1] + ip + dry_run_cmd[colon_index:]
            subprocess.run(modified_cmd, shell=True, check=True)
        
        # Delete files on Instance
        print('Deleting unnecessary files on VM')
        subprocess.run(['gcloud', 'compute', 'ssh', f'{username}@{instance_name}', 
                        f'--project={project_id}', 
                        f'--zone={zone}',
                        '--quiet',
                        f'--command=rm -rf /home/{username}/images/{dicom_series_id} && rm -rf /home/{username}/model_outputs/{dicom_series_id}'], check=True, input='\n', text=True)
                        # rm -rf /home/{username}/images && rm -rf /home/{username}/model_outputs'
        # Stop the instance
        print('Now idling...')
        subprocess.run(['gcloud', 'compute', 'instances', 'add-metadata', instance_name, 
                        f'--project={project_id}', 
                        f'--zone={zone}',
                        f'--metadata=idling=True'], check=True)
        
        if stop_instance_at_end:
            print('Stopping Instance')
            stop_instance(project_id, zone, instance_name, block=False)
        else:
            print('Suspending Instance')
            suspend_instance(project_id, zone, instance_name, block=False)
            
    except Exception as e:
        print('Something went wrong with running predictions:')
        print(e, flush=True)
        if toast_callback is not None:
            toast_callback(e, type='error')
            
        if stop_instance_at_end:
            stop_instance(project_id, zone, instance_name)
        else:
            suspend_instance(project_id, zone, instance_name)
        print('Now idling...')
        subprocess.run(['gcloud', 'compute', 'instances', 'add-metadata', instance_name, 
                        f'--project={project_id}', 
                        f'--zone={zone}',
                        f'--metadata=idling=True'], check=True)
        return None
    
    dcm_prediction_dir = os.path.join(dcm_prediction_dir, dicom_series_id)
    print('returning', dcm_prediction_dir)
    return dcm_prediction_dir

if __name__ == '__main__':
    # env_vars = read_json('flaskVars.json')
    env_vars = read_env_vars()
    _KEY_FILE = env_vars['key_file']
    _PROJECT_ID = env_vars['project_id']
    _ZONE = env_vars['zone']
    _REGION = env_vars['region']
    _MACHINE_TYPE = env_vars['machine_type']
    _REPOSITORY = env_vars['repository']
    _SERVICE_ACCOUNT_EMAIL = env_vars['service_account_email']
    _INSTANCE_LIMIT = env_vars['instance_limit']
    

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
    
    run_predictions(_PROJECT_ID, _ZONE, _SERVICE_ACCOUNT_EMAIL, _KEY_FILE, f'{DICOM_SERIES_TO_PREDICT}', COMPUTE_INSTANCE_NAME, skip_predictions=False)
    
    # print(get_instance_ip_address(instance, IPType.EXTERNAL))

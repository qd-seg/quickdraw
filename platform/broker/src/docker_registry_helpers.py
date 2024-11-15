from google.cloud import artifactregistry
from gcloud_auth import get_credentials, get_registry_client
import subprocess

_MAX_TIMEOUT_NORMAL_REQUEST = 90
_MAX_TIMEOUT_COMPUTE_REQUEST = 640

def get_region_name(zone: str):
    return '-'.join(zone.split('-')[:-1])

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
  
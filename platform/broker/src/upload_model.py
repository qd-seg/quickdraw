## This is a script for manually uploading the model to artifact registry
# Only meant to be used in the CLI, not with Flask

from docker_registry_helpers import upload_docker_image_to_artifact_registry
from gcloud_auth import auth_with_key_file_json, read_env_vars
import os

if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description="Upload tarball of Dockerized model to Artifact Registry")
    parser.add_argument("-i", "--image-name", dest='image_name', type=str, help="Name of the Docker image")
    parser.add_argument("-t", "--tarball-path", dest='tarball_path', type=str, help="Path to .tar of Docker image")
    parser.add_argument("-s", "--skip-push", dest='skip_push', action='store_true', default=False, help="Whether or not to skip the last push step to Registry")
    # parser.add_argument("--override-existing", dest='override_existing', action='store_true', default=False, help="Whether or not to ignore checking for existing image with the same name")
    # parser.add_argument("-d", "--direct-push", dest='direct_push', action='store_true', default=False, help="Whether or not to push an image directly instead of loading from tar")
    args = parser.parse_args()

    # image_name, tarball_path, skip_push, override_existing, direct_push = args.image_name, args.tarball_path, args.skip_push, args.override_existing, args.direct_push
    image_name, tarball_path, skip_push = args.image_name, args.tarball_path, args.skip_push


    if not image_name and not tarball_path:
        parser.error('Must either provide --tarball-path or --image-name.')

    if image_name and tarball_path:
        parser.error('Cannot use both --tarball-path and --image-name.')

    # if direct_push and not image_name:
    #     parser.error('Please provide --image-name. Ex: python3 upload_model.py --direct-push --image-name seg-model')

    if tarball_path:
        print('tar ball path:', tarball_path)
        if not os.path.isfile(tarball_path):
            parser.error(f'{tarball_path} is not a valid path')
        if image_name:
            parser.error(f'Do not provide image name when uploading from tar file.')

    if skip_push:
        print('Will be skipping push')

    # load_dotenv(override=True)
    # _INSTANCE_LIMIT = 1
    # _PROJECT_ID = os.getenv('PROJECT_ID')
    # _ZONE = os.getenv('ZONE')
    # _REGION = '-'.join(_ZONE.split('-')[:-1])
    # _MACHINE_TYPE = os.getenv('MACHINE_TYPE')
    # _SERVICE_ACCOUNT = os.getenv('SERVICE_ACCOUNT')
    # _KEY_FILE = os.getenv('KEY_FILE')
    # _REPOSITORY = os.getenv('REPOSITORY')
    env_vars = read_env_vars(local=True)
    _KEY_FILE = env_vars['key_file']
    _PROJECT_ID = env_vars['project_id']
    _ZONE = env_vars['zone']
    _REPOSITORY = env_vars['repository']

    auth_with_key_file_json(_KEY_FILE)

    upload_docker_image_to_artifact_registry(_PROJECT_ID, _ZONE, _REPOSITORY, image_name, tarball_path, LOG=True, skip_push=skip_push)
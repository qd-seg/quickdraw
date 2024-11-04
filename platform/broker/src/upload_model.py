## This is a script for manually uploading the model to artifact registry
# Only meant to be used in the CLI, not with Flask

from api.flask_helpers import upload_docker_image_to_artifact_registry

if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description="Upload tarball of Dockerized model to Artifact Registry")
    parser.add_argument("image_name", type=str, help="Name of the Docker image")
    parser.add_argument("--tarball-path", dest='tarball_path', type=str, help="Path to .tar of Docker image")
    parser.add_argument("--skip-push", dest='skip_push', action='store_true', default=False, help="Whether or not to skip the last push step to Registry")
    parser.add_argument("--override-existing", dest='override_existing', action='store_true', default=False, help="Whether or not to ignore checking for existing image with the same name")
    parser.add_argument("--direct-push", dest='direct_push', action='store_true', default=False, help="Whether or not to push an image directly instead of loading from tar")
    args = parser.parse_args()
    
    image_name, tarball_path, skip_push, override_existing, direct_push = args.image_name, args.tarball_path, args.skip_push, args.override_existing, args.direct_push
    # print(image_name, tarball_path, skip_push, override_existing)
    
    if not direct_push and not tarball_path:
        parser.error('Must either provide --tarball_path or use --direct-push.')

    if skip_push:
        print('Will be skipping push')
        
    upload_docker_image_to_artifact_registry(image_name, tarball_path, LOG=True, skip_push=skip_push, override_existing=override_existing, direct_push=direct_push)
## This is a script for manually uploading the model to artifact registry
# Only meant to be used in the CLI, not with Flask

from flask_helpers import upload_docker_image_to_artifact_registry
import sys

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print('usage: python3 upload_model.py <image_name> <tarball_path> [--skip-push]')
        sys.exit(1)
    
    image_name, tarball_path = sys.argv[1], sys.argv[2]
    skip_push = '--skip-push' in sys.argv
    if skip_push:
        print('Will be skipping push')
    upload_docker_image_to_artifact_registry(image_name, tarball_path, LOG=True, skip_push=skip_push)
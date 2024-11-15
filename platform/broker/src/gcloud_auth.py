from google.cloud import compute_v1, artifactregistry
from google.oauth2 import service_account
from google.auth.transport.requests import Request
import json
from typing import Union, List
import os

_CREDENTIALS = None
_COMPUTE_CLIENT = None
_REGISTRY_CLIENT = None
_KEY_FILE_PATH = None

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

def read_env_vars(local=False):
    # print(os.environ.get('SERVICE_CONFIGURATION'), os.environ.get('SERVICE_ACCOUNT'))
    service_config = read_json(os.path.join(os.getcwd(), '../../../secret/service_configuration.json') if local else os.environ.get('SERVICE_CONFIGURATION'))
    service_accnt = read_json(os.path.join(os.getcwd(), '../../../secret/service_account.json') if local else os.environ.get('SERVICE_ACCOUNT'))
    # print(service_config)
    # print(service_accnt, flush=True)
    return {
        'key_file': os.path.join(os.getcwd(), '../../../secret/service_account.json') if local else os.environ.get('SERVICE_ACCOUNT'),
        'project_id': service_accnt['project_id'],
        'zone': service_config['zone'],
        'region': service_config['zone'].split('-')[:-1],
        'backup_zones': service_config['backupZones'],
        'machine_type': service_config['machineType'],
        'repository': service_config['repository'],
        'service_account_email': service_accnt['client_email'],
        'instance_limit': service_config['instanceLimit'] or 1,
    }
    # print(env_vars)
    # _SERVICE_ACCOUNT_KEYS = env_vars['serviceAccountKeys']
    # _KEY_FILE = 'serviceAccountKeys.json'
    # write_json(_KEY_FILE, _SERVICE_ACCOUNT_KEYS)
    # _PROJECT_ID = _SERVICE_ACCOUNT_KEYS['project_id']
    # _ZONE = env_vars['zone']
    # _REGION = '-'.join(_ZONE.split('-')[:-1])
    # _MACHINE_TYPE = env_vars['machineType']
    # _REPOSITORY = env_vars['repository']
    # _SERVICE_ACCOUNT_EMAIL = _SERVICE_ACCOUNT_KEYS['client_email']
    # _INSTANCE_LIMIT = 1

def get_credentials():
    refresh_credentials_if_expired()
    return _CREDENTIALS

def auth_with_key_file_json(key_file_path):
    """Authenticate using a service account JSON file."""
    global _CREDENTIALS
    global _KEY_FILE_PATH
    
    print('Authenticating with service account from', key_file_path)
    credentials = service_account.Credentials.from_service_account_file(key_file_path)
    _KEY_FILE_PATH = key_file_path
    scoped_credentials = credentials.with_scopes(['https://www.googleapis.com/auth/cloud-platform'])
    
    scoped_credentials.refresh(Request())
    print('Successfully authenticated.')
    _CREDENTIALS = scoped_credentials
    return scoped_credentials

def refresh_credentials_if_expired():
    global _COMPUTE_CLIENT, _REGISTRY_CLIENT
    if _CREDENTIALS is not None and _CREDENTIALS.expired:
        print('Credentials were expired, refreshing...')
        _CREDENTIALS.refresh(Request())
        _COMPUTE_CLIENT = None
        _REGISTRY_CLIENT = None
    if _CREDENTIALS is None:
        if _KEY_FILE_PATH is None:
            raise Exception("Something went very wrong: key file path is None")
        auth_with_key_file_json(_KEY_FILE_PATH)

def get_compute_client(credentials: service_account.Credentials = None) -> compute_v1.InstancesClient:
    global _COMPUTE_CLIENT
    
    if credentials is None:
        credentials = get_credentials()
    if _COMPUTE_CLIENT is None:
        _COMPUTE_CLIENT = compute_v1.InstancesClient(credentials=(get_credentials() if credentials is None else credentials))
        
    return _COMPUTE_CLIENT

def get_registry_client(credentials: service_account.Credentials = None) -> artifactregistry.ArtifactRegistryClient:
    global _REGISTRY_CLIENT
    
    if credentials is None:
        credentials = get_credentials()
    if _REGISTRY_CLIENT is None:
        _REGISTRY_CLIENT = artifactregistry.ArtifactRegistryClient(credentials=(get_credentials() if credentials is None else credentials))
        
    return _REGISTRY_CLIENT
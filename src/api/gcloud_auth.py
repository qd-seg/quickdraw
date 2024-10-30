from google.cloud import compute_v1, artifactregistry
from google.oauth2 import service_account
from google.auth.transport.requests import Request

_CREDENTIALS = None
_COMPUTE_CLIENT = None
_REGISTRY_CLIENT = None

def get_credentials():
    refresh_credentials_if_expired()
    return _CREDENTIALS

def auth_with_key_file_json(key_file_path):
    """Authenticate using a service account JSON file."""
    global _CREDENTIALS
    
    print('Authenticating with service account from', key_file_path)
    credentials = service_account.Credentials.from_service_account_file(key_file_path)
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

def get_compute_client(credentials: service_account.Credentials = None):
    global _COMPUTE_CLIENT
    
    if credentials is None:
        credentials = get_credentials()
    if _COMPUTE_CLIENT is None:
        _COMPUTE_CLIENT = compute_v1.InstancesClient(credentials=(get_credentials() if credentials is None else credentials))
        
    return _COMPUTE_CLIENT

def get_registry_client(credentials: service_account.Credentials = None):
    global _REGISTRY_CLIENT
    
    if credentials is None:
        credentials = get_credentials()
    if _REGISTRY_CLIENT is None:
        _REGISTRY_CLIENT = artifactregistry.ArtifactRegistryClient(credentials=(get_credentials() if credentials is None else credentials))
        
    return _REGISTRY_CLIENT
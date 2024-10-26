from google.cloud import compute_v1, artifactregistry
from google.oauth2 import service_account
from google.auth.transport.requests import Request

def get_credentials(key_file_path):
    """Authenticate using a service account JSON file."""
    print('Authenticating with service account from', key_file_path)
    credentials = service_account.Credentials.from_service_account_file(key_file_path)
    scoped_credentials = credentials.with_scopes(['https://www.googleapis.com/auth/cloud-platform'])
    
    scoped_credentials.refresh(Request())
    print('Successfully authenticated.')
    return scoped_credentials

def get_compute_client(credentials: service_account.Credentials):
    return compute_v1.InstancesClient(credentials=credentials)

def get_registry_client(credentials: service_account.Credentials):
    return artifactregistry.ArtifactRegistryClient(credentials=credentials)
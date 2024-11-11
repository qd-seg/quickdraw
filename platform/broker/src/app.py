from flask import Flask, send_from_directory, request, jsonify, url_for, Blueprint
from flask_cors import CORS, cross_origin
from werkzeug.utils import secure_filename
import os
import sys
from flask_socketio import SocketIO  # Import SocketIO
import math as Math
from dotenv import load_dotenv
from flask_helpers import (
    read_env_vars,
    list_instances, get_instance, delete_instance,
    remove_instance_metadata,
    list_docker_images,
    generate_instance_name,
    setup_compute_instance, start_instance, stop_instance,
    run_predictions,
    read_json, write_json,
    delete_docker_image,
    get_dicom_series_from_orthanc_to_cache
)
from gcloud_auth import auth_with_key_file_json
from werkzeug.middleware.proxy_fix import ProxyFix
from orthanc_get import get_files_and_dice_score
from orthanc_functions import change_tags, get_tags, get_dicom_series_by_id, get_first_dicom_image_series_from_study, uploadSegFile, get_modality_of_series
from seg_converter_main_func import process_conversion
from getRTStructWithoutDICEDict import getRTStructWithoutDICEDict
from rtstruct_to_seg_conversion import convert_3d_numpy_array_to_dicom_seg, load_dicom_series, convert_mask_to_dicom_seg, get_non_intersection_mask_to_seg
from seg_mask_dice import seg_to_mask
import numpy as np
import threading
import shutil
import traceback
from typing import Union
from google.cloud.compute_v1.types import Instance
import json

app = Flask(__name__)

# @bp.route("/")
# def index():
#     return ({}, 200)

env_vars = read_env_vars()
_KEY_FILE = env_vars['key_file']
_PROJECT_ID = env_vars['project_id']
_ZONE = env_vars['zone']
_BASE_ZONE = _ZONE # this is used for artifact registry regardless of google's issues since it's through docker (?)
_REGION = env_vars['region']
_BACKUP_ZONES = env_vars['backup_zones'] # in case of 503 service unavailable zone_resource_pool_exhausted
_CURRENT_BACKUP_ZONE_INDEX = -1
_MACHINE_TYPE = env_vars['machine_type']
_REPOSITORY = env_vars['repository']
_SERVICE_ACCOUNT_EMAIL = env_vars['service_account_email']
_INSTANCE_LIMIT = env_vars['instance_limit']

# load_dotenv(override=True)
# _INSTANCE_LIMIT = 1
# _PROJECT_ID = os.getenv('PROJECT_ID')
# _ZONE = os.getenv('ZONE')
# _REGION = '-'.join(_ZONE.split('-')[:-1])
# _MACHINE_TYPE = os.getenv('MACHINE_TYPE')
# _SERVICE_ACCOUNT = os.getenv('SERVICE_ACCOUNT')
# _KEY_FILE = os.getenv('KEY_FILE')
# _REPOSITORY = os.getenv('REPOSITORY')

_MODEL_INSTANCES_FILEPATH = 'model_instances/model_instances.json'
_NO_GOOGLE_CLOUD = False

try:
    auth_with_key_file_json(_KEY_FILE)
except Exception as e:
    print('An error occurred in authentication. It is likely that you did ' +
          'not provide a valid service account key file, or you are not connected to the internet. ' +
          'The Flask server will continue to run, but no Google Cloud functionality will be available.')
    print(e)
    _NO_GOOGLE_CLOUD = True

app = Flask(__name__, static_folder="./Viewers-master/platform/app/dist")
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_prefix=1)
# Enable Cross-Origin Resource Sharing (CORS)
CORS(app, resources={r"/*": {"origins": "*"}})

bp = Blueprint('flask_backend', __name__)

# Initialize SocketIO
# socketio = SocketIO(app, cors_allowed_origins="*", path='/api/socket.io' if __name__ == '__main__' else 'socket.io')

# Serve React App
@bp.route("/", defaults={"path": ""})  # Base path for the app
@bp.route("/<path:path>")  # Handling additional paths under the base
def serve(path):
    """
    Serve the React app.

    Parameters:
        path (str): The path to the requested resource.

    Returns:
        response: The requested resource.
    """
    if path != "" and os.path.exists(app.static_folder + "/" + path):
        return send_from_directory(app.static_folder, path)
    else:
        return send_from_directory(app.static_folder, "index.html")


# @socketio.on("connect")
# def handle_connect():
#     """Handle client connection."""
#     print("Client connected")


# @socketio.on("disconnect")
# def handle_disconnect():
#     """Handle client disconnection."""
#     print("Client disconnected")


def emit_status_update(message):
    """
    Emit a status update message to connected clients.

    Parameters:
        message (str): The status message to emit.
    """
    # socketio.emit("status_update", {"message": message})
    pass


def emit_update_progressbar(value):
    """
    Emit an update to the progress bar value to connected clients.

    Parameters:
        value (int): The new value for the progress bar.
    """
    # socketio.emit("progress_update", {"value": value})
    pass
 
# outdated
def clear_unused_instances():
    '''Removes all Compute instances that do not have an existing model associated with them'''
    pass
    # print('Clearing unused instances...')
    # filename = _MODEL_INSTANCES_FILEPATH
    # model_instances = read_json(filename, default_as_dict=False)
    # used_instance_names = [m['instance_name'] for m in model_instances]
    # compute_instances = list_instances(_PROJECT_ID, _ZONE)
    # remaining_instances = []
    # for instance in compute_instances:
    #     if instance.name in used_instance_names:
    #         remaining_instances.append([m for m in model_instances if m['instance_name'] == instance.name][0])
    #     else:
    #         print(' Deleting', instance.name)
    #         # TODO: temp: don't delete for now while debugging
    #         # delete_instance(_PROJECT_ID, _ZONE, instance.name)
            
    # write_json(filename, remaining_instances)
    # print('done clearing', flush=True)
    
# When Google Compute runs out of resources in a zone, we attempt to create new Instances in backup zones
# However, these are only temporary and must be deleted after we are done
def clear_backup_region_instances():
    deleted = 0
    for zone in _BACKUP_ZONES:
        print('Looking for instances in', zone)
        avail_instances = list_instances(_PROJECT_ID, zone)
        if avail_instances is None:
            print('Zone', zone, 'is down. Cannot access the Instances on it.')
        else:
            for instance in avail_instances:
                print('Deleting backup instance from zone:', zone, 'name:', instance.name)
                delete_instance(_PROJECT_ID, zone, instance.name)
                deleted += 1
            
    print('Deleted', deleted, 'backup instances')
    
def get_existing_instance_for_model(model_name: str, try_any_avail=False):
    '''Get the Instance associated with a model name, or None if it does not exist'''
    
    all_instances = list_instances(_PROJECT_ID, _ZONE)
    print('getting existing instances...')
    possible_any_avail_models = []
    for instance in all_instances:
        print(instance.name)
        # if instance.metadata['model-displayname'] == model_name:
        this_name = next(filter(lambda m: m.key == 'model-displayname', instance.metadata.items), None)
        is_idling = next(filter(lambda m: m.key == 'idling', instance.metadata.items), None)
        # print(instance.metadata.items)
        # print(this_name)
        # print(instance.status)
        if (try_any_avail and (instance.status == 'TERMINATED' or this_name is None or (is_idling is not None and is_idling.value == 'True'))):
            possible_any_avail_models.append(instance)
        elif (this_name is not None and this_name.value == model_name):
        # if (this_name is not None and this_name.value == model_name):
            return instance

    if len(possible_any_avail_models) != 0:
        return possible_any_avail_models[0]
    
    return None

def is_able_to_predict_on_dicom_series(selected_model: str, dicom_series_id: str):
    '''Returns false if another instance (not this model) is already running predictions on this dicom series'''
    all_instances = list_instances(_PROJECT_ID, _ZONE)
    print('# instances:', len(all_instances))
    for instance in all_instances:
        this_dicom_image = next(filter(lambda m: m.key == 'dicom-image', instance.metadata.items), None)
        this_name = next(filter(lambda m: m.key == 'model-displayname', instance.metadata.items), None)
        if this_dicom_image is not None and this_dicom_image.value == dicom_series_id:
            return this_name is None or this_name.value == selected_model
    
    return True
    # filename = _MODEL_INSTANCES_FILEPATH
    # model_instances = read_json(filename, default_as_dict=False)
    # matching_instance = next((m for m in model_instances if m['model_name'] == model_name), None)
    # if matching_instance is None:
    #     print('No instance for model', model_name)
    #     return None
    
    # return get_instance(_PROJECT_ID, _ZONE, matching_instance['instance_name'])

# outdated
def add_tracked_model_instance(model_name: str, instance_name: str):
    pass
    # filename = _MODEL_INSTANCES_FILEPATH
    # model_instances = read_json(filename, default_as_dict=False)
    # model_instances.append({
    #     'model_name': model_name,
    #     'instance_name': instance_name,
    #     'running': False,
    # })
    # write_json(filename, model_instances)
    
# outdated
def set_tracked_model_instance_running(model_name: str, running: bool):
    pass
    # filename = _MODEL_INSTANCES_FILEPATH
    # model_instances = read_json(filename, default_as_dict=False)
    # for model_instance in model_instances:
    #     if model_instance['model_name'] == model_name:
    #         model_instance['running'] = running
    #         print('Set model', model_name, 'to running:', running)
            
    # write_json(filename, model_instances)
    # socketio.emit('model_instances_update')
    
def is_tracked_model_instance_running(model_name_or_instance: Union[str | Instance]):
    if isinstance(model_name_or_instance, str):
        # print(model_name_or_instance)
        instance = get_existing_instance_for_model(model_name_or_instance)
    else:
        # print(model_name_or_instance.name)
        instance = model_name_or_instance
        
    is_idling = None if instance is None else next(filter(lambda m: m.key == 'idling', instance.metadata.items), None)
    this_name = None if instance is None else next(filter(lambda m: m.key == 'model-displayname', instance.metadata.items), None)
    print(is_idling, this_name)
    return instance is not None and this_name is not None and (instance.status != 'TERMINATED' and (is_idling is None or is_idling.value != 'True'))
    # filename = _MODEL_INSTANCES_FILEPATH
    # model_instances = read_json(filename, default_as_dict=False)
    # for model_instance in model_instances:
    #     print(model_instance)
    #     if model_instance['model_name'] == model_name:
    #         print('found', model_name, model_instance.get('running', False))
    #         return model_instance.get('running', False)
        
    # return False
    
# outdated
def remove_tracked_model_instance(model_name: str):
    pass
    # filename = _MODEL_INSTANCES_FILEPATH
    # model_instances = read_json(filename, default_as_dict=False)
    # model_instances = [x for x in model_instances if x['model_name'] != model_name]
    # write_json(filename, model_instances)
    
# @bp.route('/testSocket')
# def test_socket():
#     emit_status_update('hello there')
#     emit_update_progressbar(50)
#     return jsonify({ 'message': 'OK' }), 200
    
## TODO
##TODO: Change containers in upload button component to instancesrunning
@bp.route("/instancesrunning", methods=["POST"])
def get_containers():
    """
    Get all the current running instances.

    Returns:
        response: JSON response with running instances details.
    """
    print("fetching containers")
    try:
        # emit_status_update('Getting containers')
        containers = list_instances( _PROJECT_ID, _ZONE)
        arr = [c.name for c in containers]

        return jsonify({"containers": arr}), 200
    except Exception as e:
        print("Exception while fetching containers")
        return jsonify({"message": f"Error getting containers: {str(e)}"}), 500

## TODO: this might be able to be removed?
@bp.route("/authenticateUser", methods=["POST"])
def authenticateGoogleCloud():
    """
    Authenticate user to use our google cloud services.

    Returns:
        response: JSON response with authentication status.
    """
    try:
        # auth_with_key_file_json(_KEY_FILE)
        
        ## I'm not even sure what to do here. Maybe Firebase stuff?

        emit_status_update("User authenticated successfully")
        message = "Instance created successfully"
        status_code = 200
        
    except Exception as e:
        emit_status_update("Error authenticating user")
        message = f"Error authenticating user: {str(e)}"
        status_code = 500
        
    return jsonify({"message": message}), status_code

@bp.route('/listModels', methods=['GET'])
def list_models():
    # return jsonify({'hello': 'world'}), 200
    docker_packages = list_docker_images(_PROJECT_ID, _ZONE, _REPOSITORY, specific_tags=False)
    # print(docker_packages)
    return jsonify({'models': [
        {
            'name': d.name.split('/')[-1],
            'updateTime': d.update_time.rfc3339(),
            'running': is_tracked_model_instance_running(d.name.split('/')[-1])
        } for d in docker_packages]}), 200
    
@bp.route('/isModelRunning', methods=['POST'])
def is_model_running():
    if request.is_json:
        json_data = request.get_json()
    else:
        print('not json')
        return jsonify({ 'message': 'Something went wrong' }), 500
    
    selectedModel = json_data.get('selectedModel')
    if selectedModel is None:
        print('no selectedModel')
        return jsonify({ 'message': 'Please select a model' }), 400
    
    return jsonify({ 'running': is_tracked_model_instance_running(selectedModel) }), 200

def setup_compute_with_model_helper(selected_model, start_compute=True, dicom_series_id=None):
    global _CURRENT_BACKUP_ZONE_INDEX
    global _ZONE
    # TODO: move stuff here. then have /run call this automatically if an instance doesnt exist 'model-displayname'
    print('Setting up instance...')
    emit_update_progressbar(10)
    emit_status_update('Setting up instance...')
    
    succeeded_or_def_failed = False
    new_instance = None    
    while not succeeded_or_def_failed:
        try:
            existing_instance = get_existing_instance_for_model(selected_model, try_any_avail=True)
            # print(existing_instance.name)
            new_instance_name = generate_instance_name('ohif-instance', 'predictor') if existing_instance is None else existing_instance.name
            
            # if existing_instance is not None and existing_instance.status != 'TERMINATED':
            if is_tracked_model_instance_running(existing_instance):
                # PROVISIONING, STAGING, RUNNING, STOPPING,
                #    SUSPENDING, SUSPENDED, REPAIRING, and TERMINATED
                raise Exception('Model', selected_model, 'is already running. Please wait.')
                
            
            # TODO: Big issue: sometimes a Google Cloud Platform zone will run out of resources, and we will get:
            # 503 SERVICE UNAVAILABLE ZONE_RESOURCE_POOL_EXHAUSTED: 
            # The zone 'projects/radiology-b0759/zones/us-east4-b' does not have enough resources available to fulfill the request
            # There needs to be some backup where it looks in other zones for resources, but
            #  this means that we will also need to store the zone separately for the model, and ALSO need to try other
            #  zones in the list_instances method, and anything else that uses _ZONE
            
            new_instance = setup_compute_instance(
                _PROJECT_ID,
                _ZONE,
                new_instance_name,
                _MACHINE_TYPE,
                _INSTANCE_LIMIT,
                _SERVICE_ACCOUNT_EMAIL,
                selected_model,
                _REPOSITORY,
                dicom_series_id=dicom_series_id
            )
            
            succeeded_or_def_failed = True
            print('new_instance', 'oops, none' if new_instance is None else new_instance.name)
  
        except Exception as e:
            # print(e)
            print(traceback.format_exc())
            print('Note, the above exception was handled correctly and the Flask server will continue to run.')
            if str(e).startswith('503 SERVICE UNAVAILABLE'):
                _CURRENT_BACKUP_ZONE_INDEX += 1
                if _CURRENT_BACKUP_ZONE_INDEX >= len(_BACKUP_ZONES):
                    print('Attempted all backup zones but could not find one that is available quitting the Compute setup process.')
                    return None
                
                _ZONE = _BACKUP_ZONES[_CURRENT_BACKUP_ZONE_INDEX]
                print('trying another zone...', _ZONE)
            else:
                succeeded_or_def_failed = True
                
            remove_tracked_model_instance(selected_model)
    
    if new_instance is not None:
        message = "Instance created successfully"
        print(message)
        emit_update_progressbar(20)
        emit_status_update(message)
        
        if start_compute:
            print('check if able to predict', selected_model, dicom_series_id)
            if is_able_to_predict_on_dicom_series(selected_model, dicom_series_id):
                start_instance(_PROJECT_ID, _ZONE, new_instance.name)
                remove_instance_metadata(_PROJECT_ID, _ZONE, new_instance, ['idling'])
            else:
                raise Exception('You are already running a prediction on that DICOM image. Please wait until the other prediction finishes.')
    else:
        emit_status_update("Error Google Cloud is at its limit, please wait.")
        
    return new_instance

@bp.route('/setupComputeWithModel', methods=['POST'])
def setupComputeWithModel():
    # Extract the selected model name
    if request.is_json:
        json_data = request.get_json()
    else:
        print('not json')
        return jsonify({ 'message': 'Something went wrong' }), 500
    
    selected_model = json_data.get('selectedModel')
    if selected_model is None:
        print('no selectedModel')
        return jsonify({ 'message': 'Please select a model' }), 400
    
    try:
        new_instance = setup_compute_with_model_helper(selected_model, start_compute=False)
    except Exception as e:
        print(e)
        new_instance = None
        
    status_code = None
    if new_instance is not None:
        message = "Instance created successfully"
        status_code = 200
    else:
        message = "Google Cloud is at its limit, please wait."
        status_code = 500
        
    return jsonify({"message": message}), status_code

# TODO: the model right now does not distinguish between series, only by study
# Also this should probably use only study id instead of patient id?
def convert_cached_pred_result_to_seg(dcm_prediction_dir, cached_dicom_series_path, temp_images_path, selected_model=None):
    print('Converting to SEG...')
    
    temp_seg_path = os.path.join(dcm_prediction_dir, '__convert/')
    # temp_images_path = os.path.join(dcm_prediction_dir, '_images/')
    os.makedirs(temp_seg_path, exist_ok=True)
    # os.makedirs(temp_images_path, exist_ok=True)
    print('temp seg path', temp_seg_path)
    
    # Convert all npz files in cache
    dcm_pred_files = os.listdir(dcm_prediction_dir)
    success_count = 0
    for f in dcm_pred_files:
        if os.path.isfile(filepath := os.path.join(dcm_prediction_dir, f)):
            success_count += 1
            data = np.load(filepath)
            if not os.path.exists(cached_dicom_series_path):
                print('path doesnt exist', cached_dicom_series_path)
                # load from orthanc ...
                
            dicom_series = load_dicom_series(cached_dicom_series_path)
            seg_save_dir = convert_3d_numpy_array_to_dicom_seg(
                dicom_series, 
                data['data'], 
                data['rois'], 
                os.path.join(temp_seg_path, f'{f.split(".")[0]}.dcm'),
                slice_axis=2,
                seg_series_description=f'Prediction {selected_model}'
            )
            if seg_save_dir is None:
                raise Exception('Something went wrong with saving SEG')
            
            # Upload to orthanc
            uploadSegFile(seg_save_dir, remove_original=True)
            
            print('Removing', filepath, '...')
            os.remove(filepath)

    # shutil.rmtree(temp_images_path)
    # shutil.rmtree(temp_seg_path)
    print('Removing', dcm_prediction_dir)
    shutil.rmtree(dcm_prediction_dir)
    print('Removing', cached_dicom_series_path)
    shutil.rmtree(cached_dicom_series_path)
    shutil.rmtree(temp_images_path)
    
    # there were no model outputs that were actually converted to SEG. Probably because something with the 
    # prediction failed
    if success_count == 0:
        # print('Nothing was converted to SEGs. Something likely went wrong with your model.')
        raise Exception('Nothing was converted to SEGs. Something likely went wrong with your model.')

@bp.route('/testConv', methods=['POST'])
def test_conv():
    # convert_cached_pred_result_to_seg('PANCREAS_0005')
    # print(' | '.join([request.path, request.full_path, request.remote_addr, request.url_root, request.url]))
    series_id = request.json['series_id']
    study_id = request.json['study_id']
    patient_id = request.json['patient_id']
    print(request.json)
    convert_cached_pred_result_to_seg(patient_id, study_id, series_id)
    return jsonify( {'message': 'ok'}), 200

def run_pred_helper(instance, selected_model, study_id, dicom_series_id, stop_instance_at_end=True): # TODO: should take series study patient id
    try: 
        print('instance not none')
        set_tracked_model_instance_running(selected_model, True)
        emit_update_progressbar(25)

        # Pull the images from Orthanc into cache
        emit_status_update('Getting DICOM images...')
        cached_dicom_series_path, temp_images_path = get_dicom_series_from_orthanc_to_cache(dicom_series_id)
        
        emit_update_progressbar(35)
        emit_status_update('Running predictions...')
        dcm_pred_dir = run_predictions(
            _PROJECT_ID, 
            _ZONE, 
            _SERVICE_ACCOUNT_EMAIL, 
            _KEY_FILE, 
            cached_dicom_series_path, 
            dicom_series_id, 
            instance.name, 
            progress_bar_update_callback=emit_update_progressbar,
            stop_instance_at_end=stop_instance_at_end
        )
        
        if dcm_pred_dir is None:
            print('Predictions failed or return no directory')
            raise Exception('Predictions failed')
        
        emit_update_progressbar(90)
        
        emit_status_update('Converting to SEG...')
        print(dcm_pred_dir)
        convert_cached_pred_result_to_seg(dcm_pred_dir, cached_dicom_series_path, temp_images_path, selected_model)
        
        # TODO: maybe delete instance here? it gets paused anyway so not sure if needed
        set_tracked_model_instance_running(selected_model, False)
        
        print('Removing old metadata...')
        instance = get_instance(_PROJECT_ID, _ZONE, instance.name)
        remove_instance_metadata(_PROJECT_ID, _ZONE, instance, ['dicom-image', 'model-displayname'])
        
        emit_update_progressbar(100)
        emit_status_update('Prediction done')
        print('Prediction successful')
        return True
    except Exception as e:
        print(e)
        set_tracked_model_instance_running(selected_model, False)
        stop_instance(_PROJECT_ID, _ZONE, instance.name)
        remove_instance_metadata(_PROJECT_ID, _ZONE, get_instance(_PROJECT_ID, _ZONE, instance.name), ['dicom-image', 'model-displayname'])
        return False
    
@bp.route("/run", methods=["POST"])
def run_prediction():
    global _ZONE
    global _CURRENT_BACKUP_ZONE_INDEX
    """
    Run the prediction on the Google Cloud instance.

    Returns:
        response: JSON response with status of the prediction process.
    """
    
    _ZONE = _BASE_ZONE
    _CURRENT_BACKUP_ZONE_INDEX = -1
    
    if request.is_json:
        json_data = request.get_json()
        print(json_data)
    selected_model = json_data.get("selectedModel", None)
    # selectedDicomSeries = json_data["selectedDicomSeries"]
    # series_id = request.json.get('seriesId', None)
    series_id = request.json.get('parent_id', None)
    study_id = request.json.get('study_id', None)
    
    print('params:')
    print(selected_model)
    
    if selected_model is None or series_id is None or study_id is None:
        print('Invalid params from frontend')
        return jsonify({'message': 'Model or images not provided'}), 500
    
    series_modality = get_modality_of_series(series_id)
    if series_modality is None:
        print('Series', series_id, 'does not exist.')
        return jsonify({ 'message': 'The DICOM image file you are trying to predict is invalid.' }), 400

    if series_modality != 'CT':
        print('Series', series_id, 'is not a valid image, it is a', series_modality)
        return jsonify({ 'message': f'You are trying to predict on a {series_modality}, not an image series.'}), 400
    
    try:
        instance = setup_compute_with_model_helper(selected_model, start_compute=True, dicom_series_id=series_id)
        if instance is None:
            return jsonify({ 'message': "Error: Google Cloud is at its limit, please wait." }), 400
    except Exception as e:
        print(e)
        print(traceback.format_exc())
        # return jsonify({ 'message': 'Issue creating Compute instance. Google Cloud Services likely experiencing temporary resource shortage. Please try again later.' }), 500
        return jsonify({ 'message': str(e) }), 500
    
    # try:
    #     print('check if able to predict', selected_model, series_id)
    #     if not is_able_to_predict_on_dicom_series(selected_model, series_id):
    #         # start_instance(_PROJECT_ID, _ZONE, instance.name)
    #         # stop_instance(_PROJECT_ID, _ZONE, instance)
    #         return jsonify({ 'message': 'Another model is currently predicting on this series. Please wait for it to finish first.' }), 400
    # except Exception as e:
    #     print(e)
    #     return jsonify({ 'message': 'Google Cloud Compute is having issues. Please try again later.' }), 500
    # print(instance.name)
    # return jsonify({'message':'....'}), 200
    try:
        # emit_update_progressbar(20)
        if instance is not None:
            # if is_tracked_model_instance_running(selected_model):
                # raise Exception(f'Selected model {selectedModel} already running')
                # return jsonify({ 'message': f'Selected model {selected_model} already running' }), 500
            
            thread = threading.Thread(target=run_pred_helper, args=(instance, selected_model, study_id, series_id), kwargs={'stop_instance_at_end': False})
            thread.start()
            return jsonify({ 'message': 'Prediction job successfully started' }), 202
        
        else:
            # TODO: maybe handle this differently
            set_tracked_model_instance_running(selected_model, False)
            return jsonify({ 'message': 'Issue creating Compute instance. Google Cloud likely experiencing temporary resource shortage.' }), 500
            
    # Catch any exceptions
    except Exception as e:
        print(e)
        emit_status_update("Error running prediction")
        set_tracked_model_instance_running(selected_model, False)
        return jsonify({ 'message': f"Error running prediction: {str(e)}" }), 500
        

# This currently is not called by anything
@bp.route("/deleteModel", methods=["POST"])
def deleteModel():
    """
    Delete a model from Artifact Registry
    """

    status_code = 500
    try:
        # Get the tarball
        if "imagename" not in request.form:
            return jsonify({"error": "No file part"})

        imagename = request.form["imagename"]

        emit_status_update("Deletion in progress . . .")

        # Execute the bash script
        delete_docker_image(_PROJECT_ID, _ZONE, _REPOSITORY, imagename)

        emit_status_update("Model successfully deleted !")
        status_code = 200
        message = f"Successfully deleted model !"
    # Catch any exceptions
    except Exception as e:
        emit_status_update("Error uploading image")
        message = f"Error uploading image: {str(e)}"
        status_code = 500
    emit_status_update(message)
    return jsonify({"message": message}), status_code

@bp.route('/saveDiscrepancyMask', methods=['POST'])
def save_discrepency_mask():
    if request.is_json:
        json_data = request.get_json()
    else:
        print('not json')
        return jsonify({ 'message': 'Something went wrong' }), 500
    
    dicom_series_id = json_data.get('parent_id')
    pred_series_id = json_data.get('predSeriesUid')
    truth_series_id = json_data.get('truthSeriesUid')
    
    if dicom_series_id is None or pred_series_id is None or truth_series_id is None:
        return jsonify({ 'message': 'Please select a prediction and truth mask.' })
    
    # Pull the images from Orthanc into cache
    emit_status_update('Getting DICOM images...')
    disc_path = 'discrepancy/'
    if (cache_dir := os.environ.get('CACHE_DIRECTORY')) is not None:
        disc_path = os.path.abspath(os.path.join(cache_dir, disc_path))
        
    cached_dicom_series_path, temp_images_path = get_dicom_series_from_orthanc_to_cache(dicom_series_id, cache_subdir='discrepancy/_images')
    dicom_series = load_dicom_series(cached_dicom_series_path)
    shutil.rmtree(temp_images_path)
    
    pred_series, temp_pred_path = get_dicom_series_from_orthanc_to_cache(pred_series_id, cache_subdir=os.path.join(disc_path, '_pred/'))
    truth_series, temp_truth_path = get_dicom_series_from_orthanc_to_cache(truth_series_id, cache_subdir=os.path.join(disc_path, '_truth/'))
    
    for dirpath, _, fnames in os.walk(pred_series):
        print(fnames)
        print(dirpath)
        if len(fnames) == 1:
            pred_series = os.path.abspath(os.path.join(dirpath, fnames[0]))
    for dirpath, _, fnames in os.walk(truth_series):
        print(fnames)
        print(dirpath)
        if len(fnames) == 1:
            truth_series = os.path.abspath(os.path.join(dirpath, fnames[0]))
    
    pred_mask, dcm_pred = seg_to_mask(pred_series, slice_thickness=1)
    truth_mask, dcm_truth = seg_to_mask(truth_series, slice_thickness=1)
    shutil.rmtree(disc_path)
    
    temp_seg_path = os.path.join(disc_path, '_res/')
    os.makedirs(temp_seg_path, exist_ok=True)
    out_name = get_non_intersection_mask_to_seg(dicom_series, pred_mask, truth_mask, dcm_pred, dcm_truth, 
                                     os.path.join(temp_seg_path, f'discrepancy.dcm'),
                                     output_desc=f'Prediction Discrepancy')
    
    if out_name is None:
        print('something went wrong')
        return jsonify({ 'message': 'Failed to get discrepancy mask.' }), 500
    
    print('Uploading SEG')
    uploadSegFile(out_name, remove_original=False)
    
    # print('Removing cached files')
    
    print('Done')
    return jsonify({ 'message': 'Succesfully saved discrepancy mask.' }), 200

@bp.route('/getDICEScores', methods=['POST'])
def getDICEScores():
    if request.is_json:
        json_data = request.get_json()
    else:
        print('not json')
        return jsonify({ 'message': 'Something went wrong' }), 500

    currentMaskDic = json_data.get('currentMask')
    groundTruthDic = json_data.get('groundTruth')

    if currentMaskDic is None or groundTruthDic is None:
        print('wrong params')
        return jsonify({ 'message': 'Select both ground truth and another mask for DICE scores.' }), 400
    
    currentMaskDic = json.loads(currentMaskDic)
    groundTruthDic = json.loads(groundTruthDic)
    # print(currentMaskDic, groundTruthDic)
    
    parent_id = json_data.get('parentDicomId')
    pred_series_id = currentMaskDic['series_uid']
    truth_series_id = groundTruthDic['series_uid']
    
    # parent_id = '1.2.826.0.1.3680043.2.1125.1.64196995986655345161142945283707267'
    # pred_series_id = '1.2.826.0.1.3680043.8.498.30971613207143197447909320821495929249'
    # truth_series_id = '1.2.826.0.1.3680043.8.498.65606104540766071416178016107620147411'
    if parent_id is None:
        print('wrong params')
        return jsonify({ 'message': 'Select both ground truth and another mask for DICE scores.' }), 400
    
    print('getting dice...')
    score_dict = get_files_and_dice_score(parent_id,pred_series_id,truth_series_id)

    return jsonify(score_dict), 200


@bp.route('/getGroundTruthSeries', methods=['POST'])
def getGroundTruthSeries():
    if request.is_json:
        json_data = request.get_json()
    else:
        print('not json')
        return jsonify({ 'message': 'Something went wrong' }), 500
    
    study_UID = json_data.get('study_UID')
    if study_UID is None:
        return jsonify({ 'message': 'Need ID\'s' }), 400

    truth_list = get_tags(study_UID)
    
    return jsonify({"truth_list":truth_list}), 200


@bp.route('/switchTruthLabel', methods=['POST'])
def switchTruthLabel():
    if request.is_json:
        json_data = request.get_json()
    else:
        print('not json')
        return jsonify({ 'message': 'Something went wrong' }), 500
    
    series_UID = json_data.get('series_UID')
    if series_UID is None:
        return jsonify({ 'message': 'Need ID\'s' }), 400

    change_tags(series_UID)
    
    return jsonify({"message":"success"}), 200


@bp.route('/convert_rt_struct_to_seg', methods = ['POST'])
def convert_rt_struct_to_seg():
    if request.is_json:
        json_data = request.get_json()
    else:
        print('not json')
        return jsonify({ 'message': 'Something went wrong' }), 500
   
    patient_id = json_data.get('patient_id')
    study_id = json_data.get('study_id')  #? not sure
    if patient_id is None or study_id is None:
        print('id is none cannot select rtstruct')
        return jsonify({ 'message': 'Please select a model' }), 400

    rt_struct_dicom_path_dict = getRTStructWithoutDICEDict(patient_id,study_id)
    dicom_series_path = rt_struct_dicom_path_dict["DICOM_series_path"]
    rt_struct_path = rt_struct_dicom_path_dict["RT_struct_path"]

    if not dicom_series_path or not rt_struct_path:
        return jsonify({"error": "Please provide both dicom_series_path and rt_struct_path"}), 400

    seg_filename = "output_seg.dcm"  # Temporary filename for the converted SEG file
    result = process_conversion(dicom_series_path, rt_struct_path, seg_filename)
    if not result: #dont have to worry about saving files into orthanc, default ohif functionality
        print('Conversion process failed')
        return jsonify({'message': 'Conversion failed'}), 500



# This setup is intended to prefix all routes to /api/{...} when running in development mode,
# since in production, there is a reverse proxy that serves these routes at /api
# NOTE: this should never really be run unless manually testing only the flask side
if __name__ == "__main__":
    print('Running through main, prefixing routes with /api')
    app.register_blueprint(bp, url_prefix='/api')
    clear_unused_instances()
    # app.run(host='localhost', port=5421)
    # socketio.run(app, host='localhost', port=5421, debug=True)
else:
    print('Not running through main, no prefixes for routes')
    if not _NO_GOOGLE_CLOUD:
        clear_unused_instances()
    clear_backup_region_instances()
    app.register_blueprint(bp)
    # socketio.run(app, debug=True)
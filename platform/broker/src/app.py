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
    list_docker_images,
    generate_instance_name,
    setup_compute_instance,
    run_predictions,
    read_json, write_json,
    delete_docker_image
)
from gcloud_auth import auth_with_key_file_json
from werkzeug.middleware.proxy_fix import ProxyFix
from orthanc_get import getRTStructs
from seg_converter_main_func import process_conversion
from getRTStructWithoutDICEDict import getRTStructWithoutDICEDict


app = Flask(__name__)

# @bp.route("/")
# def index():
#     return ({}, 200)

env_vars = read_env_vars()
_KEY_FILE = env_vars['key_file']
_PROJECT_ID = env_vars['project_id']
_ZONE = env_vars['zone']
_REGION = env_vars['region']
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

auth_with_key_file_json(_KEY_FILE)

app = Flask(__name__, static_folder="./Viewers-master/platform/app/dist")
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_prefix=1)
# Enable Cross-Origin Resource Sharing (CORS)
CORS(app, resources={r"/*": {"origins": "*"}})

bp = Blueprint('flask_backend', __name__)

# Initialize SocketIO
socketio = SocketIO(app, cors_allowed_origins="*", path='/api/socket.io' if __name__ == '__main__' else 'socket.io')

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


@socketio.on("connect")
def handle_connect():
    """Handle client connection."""
    print("Client connected")


@socketio.on("disconnect")
def handle_disconnect():
    """Handle client disconnection."""
    print("Client disconnected")


def emit_status_update(message):
    """
    Emit a status update message to connected clients.

    Parameters:
        message (str): The status message to emit.
    """
    socketio.emit("status_update", {"message": message})


def emit_update_progressbar(value):
    """
    Emit an update to the progress bar value to connected clients.

    Parameters:
        value (int): The new value for the progress bar.
    """
    socketio.emit("progress_update", {"value": value})
 
def clear_unused_instances():
    '''Removes all Compute instances that do not have an existing model associated with them'''
    ## TODO: should also look at non-running instances and set running to false
    print('Clearing unused instances...')
    filename = _MODEL_INSTANCES_FILEPATH
    model_instances = read_json(filename, default_as_dict=False)
    used_instance_names = [m['instance_name'] for m in model_instances]
    compute_instances = list_instances(_PROJECT_ID, _ZONE)
    remaining_instances = []
    for instance in compute_instances:
        if instance.name in used_instance_names:
            remaining_instances.append([m for m in model_instances if m['instance_name'] == instance.name][0])
        else:
            print(' Deleting', instance.name)
            # TODO: temp: don't delete for now while debugging
            # delete_instance(_PROJECT_ID, _ZONE, instance.name)
            
    write_json(filename, remaining_instances)
    print('done clearing', flush=True)
            
    
def get_existing_instance_for_model(model_name: str):
    '''Get the Instance associated with a model name, or None if it does not exist'''
    
    filename = _MODEL_INSTANCES_FILEPATH
    model_instances = read_json(filename, default_as_dict=False)
    matching_instance = next((m for m in model_instances if m['model_name'] == model_name), None)
    if matching_instance is None:
        print('No instance for model', model_name)
        return None
    
    return get_instance(_PROJECT_ID, _ZONE, matching_instance['instance_name'])

def add_tracked_model_instance(model_name: str, instance_name: str):
    filename = _MODEL_INSTANCES_FILEPATH
    model_instances = read_json(filename, default_as_dict=False)
    model_instances.append({
        'model_name': model_name,
        'instance_name': instance_name,
        'running': False,
    })
    write_json(filename, model_instances)
    
def set_tracked_model_instance_running(model_name: str, running: bool):
    filename = _MODEL_INSTANCES_FILEPATH
    model_instances = read_json(filename, default_as_dict=False)
    for model_instance in model_instances:
        if model_instance['model_name'] == model_name:
            model_instance['running'] = running
            print('Set model', model_name, 'to running:', running)
            
    write_json(filename, model_instances)
    socketio.emit('model_instances_update')
    
def is_tracked_model_instance_running(model_name: str):
    filename = _MODEL_INSTANCES_FILEPATH
    model_instances = read_json(filename, default_as_dict=False)
    for model_instance in model_instances:
        print(model_instance)
        if model_instance['model_name'] == model_name:
            print('found', model_name, model_instance.get('running', False))
            return model_instance.get('running', False)
        
    return False
    
def remove_tracked_model_instance(model_name: str):
    filename = _MODEL_INSTANCES_FILEPATH
    model_instances = read_json(filename, default_as_dict=False)
    model_instances = [x for x in model_instances if x['model_name'] != model_name]
    write_json(filename, model_instances)
    
@bp.route('/testSocket')
def test_socket():
    emit_status_update('hello there')
    emit_update_progressbar(50)
    return jsonify({ 'message': 'OK' }), 200
    
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
    
@bp.route('/isModelRunning', methods=['GET'])
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

@bp.route('/setupComputeWithModel', methods=['POST'])
def setupComputeWithModel():
    # Extract the selected model name
    if request.is_json:
        json_data = request.get_json()
    else:
        print('not json')
        return jsonify({ 'message': 'Something went wrong' }), 500
    
    selectedModel = json_data.get('selectedModel')
    if selectedModel is None:
        print('no selectedModel')
        return jsonify({ 'message': 'Please select a model' }), 400
    
    print('Setting up instance...')
    emit_update_progressbar(10)
    emit_status_update('Setting up instance...')
    
    existing_instance = get_existing_instance_for_model(selectedModel)
    new_instance_name = generate_instance_name('ohif-instance', 'predictor') if existing_instance is None else existing_instance.name
            
    # TODO: Big issue: sometimes a Google Cloud Platform zone will run out of resources, and we will get:
    # 503 SERVICE UNAVAILABLE ZONE_RESOURCE_POOL_EXHAUSTED: 
    # The zone 'projects/radiology-b0759/zones/us-east4-b' does not have enough resources available to fulfill the request
    # There needs to be some backup where it looks in other zones for resources, but
    #  this means that we will also need to store the zone separately for the model, and ALSO need to try other
    #  zones in the list_instances method, and anything else that uses _ZONE
    
    if existing_instance is None:
        add_tracked_model_instance(selectedModel, new_instance_name)
        
    try:
        new_instance = setup_compute_instance(
            _PROJECT_ID,
            _ZONE,
            new_instance_name,
            _MACHINE_TYPE,
            _INSTANCE_LIMIT,
            _SERVICE_ACCOUNT_EMAIL,
            selectedModel,
            _REPOSITORY,
        )
    except Exception as e:
        print(e)
        new_instance = None
        remove_tracked_model_instance(selectedModel)
    
    status_code = None
    if new_instance is not None:
        message = "Instance created successfully"
        emit_update_progressbar(20)
        emit_status_update(message)
        status_code = 200
    else:
        emit_status_update("Error Google Cloud is at its limit, please wait.")
        message = "Google Cloud is at its limit, please wait."
        status_code = 500
        
    return jsonify({"message": message}), status_code

@bp.route("/run", methods=["POST"])
def run_prediction():
    """
    Run the prediction on the Google Cloud instance.

    Returns:
        response: JSON response with status of the prediction process.
    """
    
    if request.is_json:
        json_data = request.get_json()
    selectedModel = json_data["selectedModel"]
    selectedDicomSeries = json_data["selectedDicomSeries"]
    
    print('params:')
    print(selectedModel)
    print(selectedDicomSeries)
    
    if selectedModel is None or selectedDicomSeries is None:
        print(selectedModel, selectedDicomSeries, 'wrong')
        return jsonify({'message': 'Model or images not provided'}), 500

    # check_instance()
    message = "No Instance running, please create an instance first"
    status_code = 500
    emit_update_progressbar(20)
    try:
        if (instance := get_existing_instance_for_model(selectedModel)) is not None:
            if is_tracked_model_instance_running(selectedModel):
                raise Exception(f'Selected model {selectedModel} already running')
            
            print('instance not none')
            set_tracked_model_instance_running(selectedModel, True)
            emit_update_progressbar(25)

            ## TODO: pull the images from Orthanc into /dicom-images/
            emit_status_update('Getting DICOM images...')
            os.makedirs('dicom-images', exist_ok=True)
            os.makedirs('dcm-prediction', exist_ok=True)
            # ...
            ##
            
            emit_update_progressbar(35)
            emit_status_update('Running predictions...')
            ran_preds = run_predictions(_PROJECT_ID, _ZONE, _SERVICE_ACCOUNT_EMAIL, _KEY_FILE, selectedDicomSeries, instance.name, progress_bar_update_callback=emit_update_progressbar)
            if not ran_preds:
                raise Exception('Predictions failed')
            
            emit_update_progressbar(90)
            emit_status_update('Storing predictions...')
            print('Storing predictions...')
            
            ## TODO: send predictions back to user or to orthanc. Note that predictions are located in /dcm-prediction/
            
            message = "Prediction complete"
            status_code = 200
            
            # TODO: maybe delete instance here? it gets paused anyway so not sure if needed
            set_tracked_model_instance_running(selectedModel, False)
        else:
            # TODO: maybe handle this differently
            set_tracked_model_instance_running(selectedModel, False)
            return jsonify({"message": 'Instance does not exist for model'}), 500
    # Catch any exceptions
    except Exception as e:
        print(e)
        emit_status_update("Error running prediction")
        message = f"Error running prediction: {str(e)}"
        status_code = 500
        
    emit_update_progressbar(100)
    emit_status_update(message)
    return jsonify({"message": message}), status_code

# Model upload is done through CLI
# @bp.route("/uploadImage", methods=["POST"])
# def uploadModel():
#     """
#     Upload a model by pushing the docker image

#     Returns:
#         response: JSON response with status of the upload process.
#     """

#     status_code = 500
#     try:
#         # Get the tarball
#         if "file" not in request.files:
#             return jsonify({"error": "No file part"})

#         tarball = request.files["file"]
#         imagename = request.form["imagename"]
#         if tarball.filename == "":
#             return jsonify({"error": "No selected file"})

#         emit_status_update("Recieved Model . . .")

#         # Store the tarball locally
#         upload_folder = "./tarballs"
#         tarball_path = os.path.join(upload_folder, tarball.filename)
#         tarball.save(tarball_path)

#         emit_status_update("Uploading to cloud . . .")

#         # Execute the bash script
#         upload_model(
#             _ZONE,
#             _PROJECT_ID,
#             _REPOSITORY,
#             _KEY_FILE,
#             tarball_path,
#             imagename,
#             tarball.filename,
#         )

#         # Clean up: remove the tarball file
#         os.remove(tarball_path)

#         emit_status_update("Model successfully added !")
#         status_code = 200
#         message = f"Successfully uploaded !"
#     # Catch any exceptions
#     except Exception as e:
#         os.remove(tarball_path)
#         emit_status_update("Error uploading image")
#         message = f"Error uploading image: {str(e)}"
#         status_code = 500
#     emit_status_update(message)
#     return jsonify({"message": message}), status_code


@bp.route("/deleteModel", methods=["POST"])
def deleteModel():
    """
    Delete a model from Artifact Registry

    Returns:
        something.
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


@bp.route('/getDICEScores', methods=['POST'])
def getDICEScores():
    # Extract the selected model name
    if request.is_json:
        json_data = request.get_json()
    else:
        print('not json')
        return jsonify({ 'message': 'Something went wrong' }), 500

    patient_id = json_data.get('patient_id')
    study_id = json_data.get('patient_id')
    if patient_id is None or study_id is None:
        print('no selectedModel')
        return jsonify({ 'message': 'Please select a model' }), 400

    score_dict = getRTStructs(patient_id,study_id)

    return jsonify(score_dict), 200

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
    socketio.run(app, host='localhost', port=5421, debug=True)
else:
    print('Not running through main, no prefixes for routes')
    clear_unused_instances()
    app.register_blueprint(bp)
    # socketio.run(app, debug=True)
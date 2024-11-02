from flask import Flask, send_from_directory, request, jsonify, url_for
from flask_cors import CORS, cross_origin
from werkzeug.utils import secure_filename
import os
import sys
from flask_socketio import SocketIO  # Import SocketIO
import math as Math
from dotenv import load_dotenv
from flask_helpers import (
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
app = Flask(__name__)

# @app.route("/")
# def index():
#     return ({}, 200)

load_dotenv(override=True)
_INSTANCE_LIMIT = 1
_PROJECT_ID = os.getenv('PROJECT_ID')
_ZONE = os.getenv('ZONE')
_REGION = '-'.join(_ZONE.split('-')[:-1])
_MACHINE_TYPE = os.getenv('MACHINE_TYPE')
_SERVICE_ACCOUNT = os.getenv('SERVICE_ACCOUNT')
_KEY_FILE = os.getenv('KEY_FILE')
_REPOSITORY = os.getenv('REPOSITORY')

_MODEL_INSTANCES_FILEPATH = 'model_instances/model_instances.json'

auth_with_key_file_json(_KEY_FILE)

app = Flask(__name__, static_folder="./Viewers-master/platform/app/dist")
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_prefix=1)
# Enable Cross-Origin Resource Sharing (CORS)
CORS(app, resources={r"/*": {"origins": "*"}})

# Initialize SocketIO
socketio = SocketIO(app, cors_allowed_origins="*")

# Serve React App
@app.route("/", defaults={"path": ""})  # Base path for the app
@app.route("/<path:path>")  # Handling additional paths under the base
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
    
    filename = _MODEL_INSTANCES_FILEPATH
    model_instances = read_json(filename)
    used_instance_names = [m.instance_name for m in model_instances]
    compute_instances = list_instances(_PROJECT_ID, _ZONE)
    for instance in compute_instances:
        if instance.name not in used_instance_names:
            delete_instance(_PROJECT_ID, _ZONE, instance.name)
    
def get_existing_instance_for_model(model_name: str):
    '''Get the Instance associated with a model name, or None if it does not exist'''
    
    filename = _MODEL_INSTANCES_FILEPATH
    model_instances = read_json(filename)
    matching_instance = next((m for m in model_instances if m.model_name == model_name), None)
    if matching_instance is None:
        return None
    
    return get_instance(_PROJECT_ID, _ZONE, matching_instance.instance_name)

def add_tracked_model_instance(model_name: str, instance_name: str):
    filename = _MODEL_INSTANCES_FILEPATH
    model_instances = read_json(filename)
    model_instances.append({
        'model_name': model_name,
        'instance_name': instance_name
    })
    write_json(filename, model_instances)

## TODO
##TODO: Change containers in upload button component to instancesrunning
@app.route("/instancesrunning", methods=["POST"])
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
@app.route("/authenticateUser", methods=["POST"])
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

@app.route('/listModels')
def list_models():
    # return jsonify({'hello': 'world'}), 200
    return jsonify({'models': [d.name for d in list_docker_images(_PROJECT_ID, _ZONE, _REPOSITORY)]}), 200

@app.route('/setupComputeWithModel', methods=['POST'])
def setupComputeWithModel():
    # Extract the selected model name
    if request.is_json:
        json_data = request.get_json()
    else:
        return jsonify({ 'message': 'Something went wrong' }), 500
    
    selectedModel = json_data.get('selected_model')
    if selectedModel is None:
        return jsonify({ 'message': 'No model selected ' }), 500
    
    existing_instance = get_existing_instance_for_model(selectedModel)
    new_instance_name = generate_instance_name('ohif-instance', 'predictor') if existing_instance is None else existing_instance.name
            
    new_instance = setup_compute_instance(
        _PROJECT_ID,
        _ZONE,
        new_instance_name,
        _MACHINE_TYPE,
        _INSTANCE_LIMIT,
        selectedModel,
        _REPOSITORY,
    )
    
    add_tracked_model_instance(selectedModel, new_instance_name)
    
    status_code = None
    if new_instance is not None:
        emit_status_update("Instance created successfully")
        message = "Instance created successfully"
        status_code = 200
    else:
        emit_status_update("Error Google Cloud is at its limit, please wait.")
        message = "Google Cloud is at its limit, please wait."
        status_code = 500
        
    return jsonify({"message": message}), status_code

@app.route("/run", methods=["POST"])
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
    
    if selectedModel is None or selectedDicomSeries is None:
        return jsonify({'message': 'Model or images not provided'}), 500

    # check_instance()
    message = "No Instance running, please create an instance first"
    status_code = 500
    emit_update_progressbar(0)
    try:
        if (instance := get_existing_instance_for_model(selectedModel)) is not None:
            emit_update_progressbar(0)

            ## TODO: pull the images from Orthanc into /dicom-images/
            os.makedirs('dicom-images', exist_ok=True)
            os.makedirs('dcm-prediction', exist_ok=True)
            ##
            emit_update_progressbar(50)
            run_predictions(_PROJECT_ID, _ZONE, _SERVICE_ACCOUNT, _KEY_FILE, selectedDicomSeries, instance.name)
            
            emit_update_progressbar(90)
            
            ## TODO: send predictions back to user or to orthanc. Note that predictions are located in /dcm-prediction/
            
            message = "Prediction complete"
            status_code = 200
            
            # TODO: maybe delete instance here? it gets paused anyway so not sure if needed
        else:
            # TODO: maybe handle this differently
            return jsonify({"message": 'Instance does not exist for model'}), 500
    # Catch any exceptions
    except Exception as e:
        emit_status_update("Error running prediction")
        message = f"Error running prediction: {str(e)}"
        status_code = 500
        
    emit_update_progressbar(100)
    emit_status_update(message)
    return jsonify({"message": message}), status_code

# Model upload is done through CLI
# @app.route("/uploadImage", methods=["POST"])
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


@app.route("/deleteModel", methods=["POST"])
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
 

if __name__ == "__main__":
    clear_unused_instances()
    app.run()
#    socketio.run(app, debug=True)


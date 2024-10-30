from flask import Flask, send_from_directory, request, jsonify, url_for
from flask_cors import CORS, cross_origin
from werkzeug.utils import secure_filename
import os
import sys
from flask_socketio import SocketIO  # Import SocketIO
# from google.cloud.exceptions import NotFound, Conflict
import math as Math
from dotenv import load_dotenv
from api.flask_helpers import (
    list_instances, get_instance, delete_instance,
    generate_instance_name,
    setup_compute_instance,
    run_predictions,
    read_json, write_json
)
from api.gcloud_auth import auth_with_key_file_json
import json
import time
from werkzeug.middleware.proxy_fix import ProxyFix
app = Flask(__name__)

# @app.route("/")
# def index():
#     return ({}, 200)

# This Flask server has yet to be fully implemented
# Need to copy last year's code into here, then add our new stuff for the model-related routes

load_dotenv(override=True)
_INSTANCE_LIMIT = 1
_PROJECT_ID = os.getenv('PROJECT_ID')
_ZONE = os.getenv('ZONE')
_REGION = '-'.join(_ZONE.split('-')[:-1])
_MACHINE_TYPE = os.getenv('MACHINE_TYPE')
_SERVICE_ACCOUNT = os.getenv('SERVICE_ACCOUNT')
_KEY_FILE = os.getenv('KEY_FILE')
_REPOSITORY = os.getenv('REPOSITORY')

# auth_with_key_file_json(_KEY_FILE)

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

## TODO this might not be needed?
@app.route("/checkInstance", methods=["POST"])
def check_instance():
    """
    Check if the Google Cloud instance exists.

    Returns:
        response: JSON response with instance details and existence status.
    """
    filename = "instance.json"
    data = read_json(filename)
    emit_status_update("Checking if instance exists")

    if data:
        _INSTANCE_NAME = data.get("instance_name")
        # Suppose list_instances is a function that lists all your instances
        instances = list_instances(_PROJECT_ID, _ZONE)
        for instance in instances:
            if instance.name == _INSTANCE_NAME:
                _INSTANCE_EXISTS = True
                break
        if not _INSTANCE_EXISTS:
            _INSTANCE_NAME = None
            _INSTANCE_EXISTS = False
            write_json(
                filename,
                {"instance_name": _INSTANCE_NAME, "instance_exists": _INSTANCE_EXISTS},
            )
        return (
            jsonify(
                {"instance_name": _INSTANCE_NAME, "instance_exists": _INSTANCE_EXISTS}
            ),
            200,
        )
    else:
        data = []
        write_json(
            filename,
            []
        )
        return (
            jsonify(
                {"instance_name": _INSTANCE_NAME, "instance_exists": _INSTANCE_EXISTS}
            ),
            200,
        )
 
def clear_unused_instances():
    '''Removes all Compute instances that do not have an existing model associated with them'''
    
    filename = 'model_instances.json'
    model_instances = read_json(filename)
    used_instance_names = [m.instance_name for m in model_instances]
    compute_instances = list_instances(_PROJECT_ID, _ZONE)
    for instance in compute_instances:
        if instance.name not in used_instance_names:
            delete_instance(_PROJECT_ID, _ZONE, instance.name)
    
def get_existing_instance_for_model(model_name: str):
    '''Get the Instance associated with a model name, or None if it does not exist'''
    
    filename = 'model_instances.json'
    model_instances = read_json(filename)
    matching_instance = next((m for m in model_instances if m.model_name == model_name), None)
    if matching_instance is None:
        return None
    
    return get_instance(_PROJECT_ID, _ZONE, matching_instance.instance_name)

def add_tracked_model_instance(model_name: str, instance_name: str):
    model_instances = read_json('model_instances.json')
    model_instances.append({
        'model_name': model_name,
        'instance_name': instance_name
    })
    # TODO: SAVE json

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
        # arr = []
        # for container in containers:
        #     if container.name == _INSTANCE_NAME:
        #         arr.append([container.name, True])
        #     else:
        #         arr.append([container.name, False])
        # emit_status_update('Containers retrieved')
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
        auth_with_key_file_json(_KEY_FILE)

        emit_status_update("User authenticated successfully")
        message = "Instance created successfully"
        status_code = 200
        
    except Exception as e:
        emit_status_update("Error authenticating user")
        message = f"Error authenticating user: {str(e)}"
        status_code = 500
        
    return jsonify({"message": message}), status_code

## TODO
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
    new_instance_name = None
    if existing_instance is None:
        new_instance_name = generate_instance_name('ohif-instance', 'predictor')
    else:
        new_instance_name = existing_instance.name
            
    new_instance = setup_compute_instance(
        _PROJECT_ID,
        _ZONE,
        new_instance_name,
        _MACHINE_TYPE,
        _INSTANCE_LIMIT,
        selectedModel,
        _REPOSITORY,
    )
    
    
    
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
 
## TODO
@app.route("/deleteInstance", methods=["POST"])
def deleteInstance():
    """
    Delete the instance.

    Returns:
        response: JSON response with status of the instance deletion process.
    """
    global _INSTANCE_EXISTS
    global _INSTANCE_NAME
    global _PREDICTION_RUNNING
    global _INSTANCE_LIMIT
    global _PROJECT_ID
    global _ZONE
    global _MACHINE_TYPE
    global _SERVICE_ACCOUNT
    global _CLOUD_USER
    global _KEY_FILE
    # Check if user's designated instance exists already before proceeding.
    # This prevents the user from creating multiple instances and loading images
    # on them but never running the prediction on it.
    check_instance()
    try:
        # Make sure no prediction is running on the instance before deleting it
        if _INSTANCE_EXISTS and _INSTANCE_NAME is not None and not _PREDICTION_RUNNING:
            # Delete the instance
            emit_update_progressbar(0)
            emit_status_update("Preparing deletion of instance...")
            delete_instance(_INSTANCE_NAME, _ZONE, _PROJECT_ID)
            emit_update_progressbar(50)
            for i in range(1, 11):
                emit_status_update(f"Instance deleting...~{10-i} seconds remaining")
                emit_update_progressbar(50 + i * 5)
                time.sleep(1)
            # Do a timer for 20 seconds
            _INSTANCE_EXISTS = False
            _INSTANCE_NAME = None
            write_json(
                "instance.json",
                {"instance_name": _INSTANCE_NAME, "instance_exists": _INSTANCE_EXISTS},
            )
            message = "Instance deleted successfully"
            emit_status_update(message)
            status_code = 200
        else:
            emit_status_update("No instance to delete")
            message = "No instance to delete"
            status_code = 200
    # Catch exceptions
    except Exception as e:
        emit_status_update("Error deleting instance")
        message = f"Error deleting instance: {str(e)}"
        status_code = 500
    return jsonify({"message": message}), status_code


@app.route("/runPrediction", methods=["POST"])
def runPrediction():
    """
    Run the prediction on the Google Cloud instance.

    Returns:
        response: JSON response with status of the prediction process.
    """
    global _INSTANCE_EXISTS
    global _INSTANCE_NAME
    global _PREDICTION_RUNNING

    check_instance()
    message = "No Instance running, please create an instance first"
    status_code = 500
    emit_update_progressbar(0)
    try:
        if _INSTANCE_EXISTS and _INSTANCE_NAME is not None:
            # Run the prediction
            _PREDICTION_RUNNING = True
            emit_update_progressbar(0)

            # Extract the selected model name
            if request.is_json:
                json_data = request.get_json()
            selectedModel = json_data["selectedModel"]
            selectedDicomSeries = json_data["selectedDicomSeries"]
            
            if selectedModel is None:
                # print("Please select a model first from the model management page.")
                emit_status_update("Please select a model first from the model management page.")
                return jsonify({"message": message}), status_code
            
            # if selectedModel is None:
            #     # print("Please select a model first from the model management page.")
            #     emit_status_update("Please select a model first from the model management page.")
            emit_update_progressbar(50)
            ## TODO: pull the images from Orthanc into /dicom-images/
            
            emit_update_progressbar(70)
            run_predictions(_PROJECT_ID, _ZONE, _SERVICE_ACCOUNT, _KEY_FILE, selectedDicomSeries, _INSTANCE_NAME)
            
            emit_update_progressbar(90)
            
            ## TODO: send predictions back to user or to orthanc. Note that predictions are located in /dcm-prediction/
            
            message = "Prediction complete"
            status_code = 200
            _PREDICTION_RUNNING = False
            # deleteInstance()
            
    # Catch any exceptions
    except Exception as e:
        emit_status_update("Error running prediction")
        message = f"Error running prediction: {str(e)}"
        status_code = 500
        
    emit_update_progressbar(100)
    emit_status_update(message)
    return jsonify({"message": message}), status_code


# @app.route("/uploadImage", methods=["POST"])
# def uploadModel():
#     """
#     Upload a model by pushing the docker image

#     Returns:
#         response: JSON response with status of the upload process.
#     """

#     global _ZONE
#     global _PROJECT_ID
#     global _REPOSITORY
#     global _KEY_FILE

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


# @app.route("/deleteImage", methods=["POST"])
# def deleteModel():
    """
    delete a model by doing something

    Returns:
        something.
    """

    global _ZONE
    global _PROJECT_ID
    global _REPOSITORY
    global _KEY_FILE

    status_code = 500
    try:
        # Get the tarball
        if "imagename" not in request.form:
            return jsonify({"error": "No file part"})

        imagename = request.form["imagename"]

        emit_status_update("Deletion in progress . . .")

        # Execute the bash script
        delete_model(_ZONE, _PROJECT_ID, _REPOSITORY, _KEY_FILE, imagename)

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
    app.run()
#    socketio.run(app, debug=True)


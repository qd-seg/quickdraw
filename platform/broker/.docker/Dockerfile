# NOTE: This is an example Dockerfile for buildling a model that can be uploaded with upload_model.py
# This is not actually used in docker compose

# Use a lightweight Python image as the base
FROM python:3.9-slim

# Set the working directory in the container
WORKDIR /app

# Copy the requirements file to the container
COPY requirements.txt .

# Install Python dependencies
# Note: this next line is required for cv2
RUN apt-get update && apt-get install ffmpeg libsm6 libxext6  -y
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the app code into the container
COPY . .

# Set the command to run the prediction script with the directory as a CLI argument
ENTRYPOINT ["python", "predict.py"]

# Optionally, if you want to specify the image directory as a default argument
CMD ["./"]

import pyorthanc
import zipfile
import os 
import shutil
from dice_score_get import get_DICE_score

def getRTStructs(patient_id,study_id):
    orthanc_url = "/store"
    orthanc = pyorthanc.Orthanc(orthanc_url, username='orthanc', password='orthanc')
    patient = pyorthanc.Patient(patient_id,orthanc)
    #study_id = patient.get_main_information()["Studies"][0] #JUST FOR TESTING
    study = pyorthanc.Study(study_id,orthanc).get_main_information()
    study_folder_name = study["MainDicomTags"]["StudyDescription"]
    DICOM_file_modality = orthanc.get_series_id(study['Series'][0])["MainDicomTags"]["Modality"]#Assumes that the dicom is the first series in the array 
   

    #start = os.path.dirname(os.path.realpath(__file__))
    start = "."#current file directory
    print("hello:",start)
    patient.download('patient.zip', with_progres=False)
    with zipfile.ZipFile(start+'/patient.zip', 'r') as zip_ref:
        zip_ref.extractall(start)
    
    
    first_folder = patient.get_main_information()["MainDicomTags"]["PatientName"]
    first_folder = first_folder + " "+first_folder
    study_dir = start+"/"+first_folder +"/"+study_folder_name

    DICOM_dir = study_dir
    RTSTRUCT1 = study_dir
    RTSTRUCT2 = study_dir
    
    folders = os.listdir(study_dir)
    for i in range(len(folders)):
        if DICOM_file_modality in folders[i]:
            DICOM_dir += "/"+folders[i]
            folders.pop(i)
            break
    RTSTRUCT1 += "/"+folders[0]
    RTSTRUCT1 += "/" + os.listdir(RTSTRUCT1)[0]
    RTSTRUCT2 += "/"+folders[1]
    RTSTRUCT2 += "/" + os.listdir(RTSTRUCT2)[0]
    
    
    dice_list = get_DICE_score(DICOM_dir,RTSTRUCT1,RTSTRUCT2)

    if os.path.exists(start+"/patient.zip"):
        os.remove(start+"/patient.zip")

    if os.path.exists(start+"/"+first_folder):
        shutil.rmtree(start+"/" +first_folder)

    return dice_list

import pyorthanc
import zipfile
import os 
import shutil
from dice_score_get import get_DICE_score

def getRTStructs(patient_id,study_UID,truth_series_UID,pred_series_UID):
    #orthanc_url = 'http://localhost:8042'
    orthanc_url = "http://localhost/store"
    orthanc = pyorthanc.Orthanc(orthanc_url, username='orthanc', password='orthanc')

    patient_file_id = pyorthanc.find_patients(orthanc,query={'PatientID': patient_id})[0]#there should only be one
    patient = pyorthanc.Patient(patient_file_id.get_main_information()["ID"],orthanc)

    study = pyorthanc.find_studies(orthanc, query={"StudyInstanceUID" : study_UID})[0]#there should only be one study
    study_info = study.get_main_information()
    study_folder_name = study_info["MainDicomTags"]["StudyDescription"]

    series_IDs = study_info["Series"]

    dicom_images_order_num = None #will be the order of it's downloaded folder 
    ground_truth_order_num = None #will be the order of it's downloaded folder 
    predicted_mask_order_num = None #will be the order of it's downloaded folder 
    for i in range(len(series_IDs)):
        file = pyorthanc.Series(series_IDs[i],orthanc)
        file_info = file.get_main_information()
        if "CT" == file_info["MainDicomTags"]["Modality"]: #CT is the dicom image series
            dicom_images_order_num = i
        
        #if "ground_truth" in file.labels: #ground truth series
            #ground_truth_order_num = i
        if file_info["MainDicomTags"]["SeriesInstanceUID"] == truth_series_UID:
            predicted_mask_order_num = i

        if file_info["MainDicomTags"]["SeriesInstanceUID"] == pred_series_UID:
            predicted_mask_order_num = i
        
    if dicom_images_order_num == None or ground_truth_order_num == None or predicted_mask_order_num == None:
        return {}#FAILURE   

    start = os.path.dirname(os.path.realpath(__file__))
    patient.download(start+'/patient.zip', with_progres=False)
    with zipfile.ZipFile(start+'/patient.zip', 'r') as zip_ref:
        zip_ref.extractall(start)
      
    patient_name = patient.get_main_information()["MainDicomTags"]["PatientName"]
    patient_id = patient.get_main_information()["MainDicomTags"]["PatientID"]
    first_folder = patient_name + " " + patient_id
    study_dir = start+"/"+first_folder +"/"+study_folder_name

    DICOM_dir = study_dir
    RTSTRUCT1 = study_dir
    RTSTRUCT2 = study_dir
    
    folders = os.listdir(study_dir)
    DICOM_dir += "/"+folders[dicom_images_order_num]
    RTSTRUCT1 += "/"+folders[ground_truth_order_num]
    RTSTRUCT1 += "/" + os.listdir(RTSTRUCT1)[dicom_images_order_num]
    RTSTRUCT2 += "/"+folders[predicted_mask_order_num]
    RTSTRUCT2 += "/" + os.listdir(RTSTRUCT2)[dicom_images_order_num]
    
    dice_list = get_DICE_score(DICOM_dir,RTSTRUCT1,RTSTRUCT2)

    if os.path.exists(start+"/patient.zip"):
        os.remove(start+"/patient.zip")

    if os.path.exists(start+"/"+first_folder):
        shutil.rmtree(start+"/" +first_folder)

    return dice_list
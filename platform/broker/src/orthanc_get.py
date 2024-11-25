import pyorthanc
import zipfile
import os 
import shutil
from dice_score_get import get_DICE_score
from seg_mask_dice import seg_mask_dice
from orthanc_functions import get_dicom_series_by_id, get_modality_of_series
import traceback

def get_files_and_dice_score(dicom_series_UID, pred_series_UID,truth_series_UID):#find ground truth and use this series id to get files from folder
    #orthanc_url = 'http://localhost:8042' #TEST ONLY!!
    orthanc_url = 'http://orthanc'
    orthanc = pyorthanc.Orthanc(orthanc_url, username='orthanc', password='orthanc')
    has_SEG_tag = get_modality_of_series(pred_series_UID) == 'SEG' or get_modality_of_series(truth_series_UID) == 'SEG'
    
    dice_dir = 'dice/'
    # print('cache', os.environ.get('CACHE_DIRECTORY'))
    # return []
    if (cache_dir := os.environ.get('CACHE_DIRECTORY')) is not None:
        dice_dir = os.path.abspath(os.path.join(cache_dir, dice_dir))
    #     print(dice_dir)
    # return []
    pred_dir = get_dicom_series_by_id(pred_series_UID, os.path.join(dice_dir, '_pred'))
    truth_dir = get_dicom_series_by_id(truth_series_UID, os.path.join(dice_dir, '_truth'))
    DICOM_series = get_dicom_series_by_id(dicom_series_UID, os.path.join(dice_dir, '_dicom'), download=False)
    print(len(DICOM_series.instances))
    
    for dirpath, _, fnames in os.walk(pred_dir):
        print(fnames)
        print(dirpath)
        if len(fnames) == 1:
            pred_dir = os.path.abspath(os.path.join(dirpath, fnames[0]))
    for dirpath, _, fnames in os.walk(truth_dir):
        print(fnames)
        print(dirpath)
        if len(fnames) == 1:
            truth_dir = os.path.abspath(os.path.join(dirpath, fnames[0]))
    
    # pred_series = pyorthanc.find_series(orthanc, query={"SeriesInstanceUID": pred_series_UID})[0]

    # patient_file_id = pyorthanc.find_patients(orthanc,query={'PatientID': patient_id})[0]#there should only be one
    # patient = pyorthanc.Patient(patient_file_id.get_main_information()["ID"],orthanc)
    # patient_info = patient.get_main_information()
    # study = pyorthanc.find_studies(orthanc, query={"StudyInstanceUID" : study_UID})[0]#there should only be one study
    # study_info = study.get_main_information()
    # study_folder_name = study_info["MainDicomTags"]["StudyDescription"]
    # series_IDs = study_info["Series"]

    # has_SEG_tag, modality = False, False
    # dicom_image_series_obj, pred_series_obj, truth_series_obj = None, None, None
    # for i in range(len(series_IDs)):
    #     file = pyorthanc.Series(series_IDs[i],orthanc)
    #     file_info = file.get_main_information()
    #     if "CT" == file_info["MainDicomTags"]["Modality"]:
    #             dicom_image_series_obj = file
    #     if file_info["MainDicomTags"]["SeriesInstanceUID"] == truth_series_UID:
    #         truth_series_obj = file
    #         if "SEG" == file_info["MainDicomTags"]["Modality"]:
    #             #print("Yes1")
    #             has_SEG_tag = True

    #     if file_info["MainDicomTags"]["SeriesInstanceUID"] == pred_series_UID:
    #         pred_series_obj = file
    #         if "SEG" == file_info["MainDicomTags"]["Modality"]:
    #             #print("Yes2")
    #             has_SEG_tag = True
    

    # start = os.path.dirname(os.path.realpath(__file__))
    # patient_name = patient_info["MainDicomTags"]["PatientName"]
    # patient_id = patient_info["MainDicomTags"]["PatientID"]
    # patient_folder_name = patient_name + " " + patient_id
    # study_dir = start+"/"+patient_folder_name +"/"+study_folder_name

    # objs = [dicom_image_series_obj, pred_series_obj, truth_series_obj]
    # series_name = ""
    # for i in range(3):
    #     objs[i].download(start+'/patient.zip', with_progres=False)
    #     with zipfile.ZipFile(start+'/patient.zip', 'r') as zip_ref:
    #         zip_ref.extractall(start)
    #     if i == 1: #(This is the first seg file)
    #         series_folder_name = os.listdir(study_dir)[1]#should be the second one
    #         series_name = os.listdir(study_dir+"/"+series_folder_name)[0]#should only be one
    #         #we move the file to prevent folders/files with same name overiding eachother 
    #         shutil.move(study_dir+"/"+series_folder_name+"/"+series_name, start+"/"+patient_folder_name+"/"+series_name)
            
            
    #     if os.path.exists(start+"/patient.zip"):
    #         os.remove(start+"/patient.zip")
    

    # DICOM_dir,pred_dir,truth_dir = "","",""
    # folders = os.listdir(study_dir)
    
    # for folder_name in folders:
    #     if "CT" in folder_name and "RTSTRUCT" not in folder_name:#KEEP THE SPACE (TO PREVENT "CT" AND "STRUCT" FROM BEING CONFUSED)
    #         DICOM_dir += study_dir+"/"+ folder_name
    #         print("buh",DICOM_dir)
    #     if "SEG" in folder_name or "RTSTRUCT" in folder_name:
    #         pred_dir += study_dir+"/"+folder_name
    #         pred_dir += "/" + os.listdir(pred_dir)[0]#should only be one file in folder
    # truth_dir += start+"/"+patient_folder_name+"/"+series_name
    
    # print(DICOM_dir)
    print(pred_dir)
    print(truth_dir)

    dice_list = None
    try:
        if has_SEG_tag:
            print('has seg')
            dice_list = seg_mask_dice(len(DICOM_series.instances), pred_dir, truth_dir)#for seg files
        else:
            DICOM_dir = get_dicom_series_by_id(dicom_series_UID, os.path.join(dice_dir, '_dicom'))
            dice_list = get_DICE_score(DICOM_dir,pred_dir,truth_dir)#for rtstruct files
    except Exception as e:
        print(e)
        print(traceback.format_exc())
        dice_list = []
    print(dice_list)
    # if os.path.exists(start+"/"+patient_folder_name):
    #     shutil.rmtree(start+"/" +patient_folder_name)
    print('Removing temp dirs')
    shutil.rmtree(dice_dir)

    return dice_list
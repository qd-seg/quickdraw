import pyorthanc
import zipfile
import os

orthanc_url = "/store"

def get_tags(study_UID):
    UID_list = []
    orthanc = pyorthanc.Orthanc(orthanc_url, username='orthanc', password='orthanc')
    study = pyorthanc.find_studies(orthanc, query={"StudyInstanceUID" : study_UID})[0]#there should only be one study
    study_info = study.get_main_information()
    for series_id in study_info["Series"]:
        file = pyorthanc.Series(series_id,orthanc)
        if "ground_truth" in file.labels:
            UID_list.append(study_info["MainDicomTags"]["StudyInstanceUID"])
    print(UID_list)
    return UID_list


def change_tags(series_UID):#make sure this is an RTstruct series
    orthanc = pyorthanc.Orthanc(orthanc_url, username='orthanc', password='orthanc')
    series = None
    try:
        series = pyorthanc.find_series(orthanc, query={"SeriesInstanceUID":series_UID})[0]#Should only be one
    except:
        return 
    
    if "ground_truth" in series.labels:
        series.remove_label("ground_truth")
        print(series.labels)
    else:
        series.add_label("ground_truth")
        print(series.labels)




def get_first_dicom_image_series_from_study(patient_id, study_UID, save_directory):
    orthanc = pyorthanc.Orthanc(orthanc_url, username='orthanc', password='orthanc')

    patient_file_id = pyorthanc.find_patients(orthanc,query={'PatientID': patient_id})[0]#there should only be one
    patient = pyorthanc.Patient(patient_file_id.get_main_information()["ID"],orthanc)

    study = pyorthanc.find_studies(orthanc, query={"StudyInstanceUID" : study_UID})[0]#there should only be one study
    study_info = study.get_main_information()

    series_IDs = study_info["Series"]
    study_folder_name = study_info["MainDicomTags"]["StudyDescription"]

    image_order_num = None
    for i in range(len(series_IDs)):
        file_info = pyorthanc.Series(series_IDs[i],orthanc).get_main_information()
        if "CT" == file_info["MainDicomTags"]["Modality"]:
            image_order_num = i
            
    start = os.path.join(save_directory, '_images')
    patient.download(start+'/patient.zip', with_progres=False)
    with zipfile.ZipFile(start + '/patient.zip', 'r') as zip_ref:
        zip_ref.extractall(start)

    first_folder = patient.get_main_information()["MainDicomTags"]["PatientName"]
    first_folder = first_folder + " " + first_folder # this might need changes. Currently the patient name is duplicated
                                                     # in the folder name. But I think it might be study ID (not UID) and
                                                     # Patient ID, or Patient Name
    # study_dir = start+"/"+first_folder +"/"+study_folder_name
    study_dir = os.path.join(start, first_folder, study_folder_name)
    image_folder = os.listdir(study_dir)[image_order_num]
    return first_folder, study_dir + "/"+image_folder

def get_dicom_series_by_id(series_instance_uid, save_directory):
    a_series = pyorthanc.Series(series_instance_uid, pyorthanc.Orthanc(orthanc_url, username='orthanc', password='orthanc'))
    print(save_directory)
    zip_path = os.path.join(save_directory, 'series.zip')
    a_series.download(zip_path, with_progres=False)
    with zipfile.ZipFile(zip_path, 'r') as zip_ref:
        print('extracting', zip_ref.filename)
        zip_ref.extractall(zip_path)
        
    return zip_path


def uploadSegFile(file_path):
    orthanc = pyorthanc.Orthanc(orthanc_url, username='orthanc', password='orthanc')
    with open(file_path, 'rb') as file:
        orthanc.post_instances(file.read())

    print(os.path.exists(file_path))
    if os.path.exists(file_path):
        os.remove(file_path)
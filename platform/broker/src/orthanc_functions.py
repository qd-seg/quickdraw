import pyorthanc
import zipfile
import os
from urllib.parse import urljoin

# TODO: might want to look into this: https://orthanc.uclouvain.be/book/faq/orthanc-ids.html

orthanc_url = 'http://orthanc'

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
    orthanc = pyorthanc.Orthanc(orthanc_url, username='orthanc', password='orthanc', timeout=60)

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
            print('asdf;', i)
            
    start = save_directory
    print(start+ '/patient.zip')
    patient.download(os.path.join(start, 'patient.zip'), with_progres=False)
    with zipfile.ZipFile(start + '/patient.zip', 'r') as zip_ref:
        zip_ref.extractall(start)

    # first_folder = patient.get_main_information()["MainDicomTags"]["PatientName"]
    
    first_folder = patient.patient_id + " " + patient.name
          
    # study_dir = start+"/"+first_folder +"/"+study_folder_name
    study_dir = os.path.join(start, first_folder, study_folder_name)
    image_folder = os.listdir(study_dir)[image_order_num]
    return first_folder, study_dir + "/"+image_folder

def get_dicom_series_by_id(series_instance_uid, save_directory, series_obj_out=[], extract_zip=True):
    print('saving', save_directory)
    url = orthanc_url

    orthanc = pyorthanc.Orthanc(url, username='orthanc', password='orthanc', timeout=60)
    valid_series = pyorthanc.find_series(orthanc, query={'SeriesInstanceUID': series_instance_uid})
    if len(valid_series) == 0:
        raise Exception('No series found with UID:', series_instance_uid)
    
    a_series = valid_series[0]
    # print('study id:', a_series.parent_study.study_id, .patient_id)
    # print(save_directory)
    # print(a_series)
    print(len(a_series.instances))
    os.makedirs(save_directory, exist_ok=True)
    zip_path = os.path.join(save_directory, 'series.zip')
    a_series.download(zip_path, with_progres=False)
    if extract_zip:
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            # zip_ref.extractall(zip_path, [r'PANCREAS_0005 PANCREAS_0005/'])
            zip_ref.extractall(save_directory)
            os.remove(zip_path)
    
    patient = a_series.parent_patient 
    if isinstance(series_obj_out, list):
        series_obj_out.append(a_series)
        # a_series.parent_study.uid
        # a_series.description
    
    return os.path.join(save_directory, f'{patient.patient_id} {patient.name}') if extract_zip else zip_path

def extract_dicom_series_zip(zip_path, save_directory, remove_original=False):
    with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(save_directory)
            if remove_original:
                os.remove(zip_path)
    
    return save_directory

def uploadSegFile(file_path, remove_original=False):
    print('Uploading', file_path, 'to orthanc...')
    orthanc = pyorthanc.Orthanc(orthanc_url, username='orthanc', password='orthanc', timeout=60)
    with open(file_path, 'rb') as file:
        orthanc.post_instances(file.read())

    if remove_original:
        print(os.path.exists(file_path))
        if os.path.exists(file_path):
            os.remove(file_path)
            
def get_modality_of_series(series_UID):
    orthanc = pyorthanc.Orthanc(orthanc_url, username='orthanc', password='orthanc', timeout=60)
    series = None
    try:
        series = pyorthanc.find_series(orthanc, query={"SeriesInstanceUID":series_UID})[0]#Should only be one
    except Exception as e:
        return None
    
    series = series.get_main_information()
    return series["MainDicomTags"]["Modality"]

def get_next_available_iterative_name_for_series(base_series_name, parent_study_uid, split_char='_', modality='SEG', max_len=64):
    orthanc = pyorthanc.Orthanc(orthanc_url, username='orthanc', password='orthanc', timeout=60)
    valid_studies = pyorthanc.find_studies(orthanc, query={'StudyInstanceUID': parent_study_uid})
    if len(valid_studies) == 0:
        raise Exception('Could not find any studies with UID', parent_study_uid)
    # print(valid_studies[0])
    # print([s.modality for s in valid_studies[0].series])
    # print([s.description for s in valid_studies[0].series])
    # print([split_char.join(s.description.split(split_char)[:-1]) for s in valid_studies[0].series])
    intersecting_series = []
    for s in valid_studies[0].series:
        try:
            if s.modality == modality and \
               s.description.count(split_char) >= 1 and \
               split_char.join(s.description.split(split_char)[:-1]) == base_series_name:
                   intersecting_series.append(s.description)
        except Exception as e:
            continue
                
    # intersecting_series = [s.description for s in valid_studies[0].series if (
    #     s.modality==modality and 
    #     s.description.count(split_char) >= 1 and
    #     split_char.join(s.description.split(split_char)[:-1])==base_series_name
    #     # s.description.startswith(base_series_name)
    #     )]
    # print(intersecting_series)
    # intersecting_series.sort(key=lambda s: s.description)
    next_valid_iteration = 1
    for i in range(1, len(intersecting_series) + 2):
        if f'{base_series_name}{split_char}{i}' not in intersecting_series:
            next_valid_iteration = i
            print('next valid iter:', next_valid_iteration)
            break
            
    return_name = f'{base_series_name}{split_char}{next_valid_iteration}'
    if max_len is not None and len(return_name) > max_len: # DICOM descriptions must be 64 chars or less
        prefix_len = (max_len - 5) // 2  # Length of the prefix
        suffix_len = max_len - 5 - prefix_len  # Length of the suffix
        return_name = return_name[:prefix_len] + '-xxx-' + return_name[-suffix_len:]
        print('shortened description to', return_name)
        
    return return_name
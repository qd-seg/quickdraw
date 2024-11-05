from rt_utils import RTStructBuilder
from rt_utils import image_helper
import numpy as np
import concurrent.futures

def monkey_patched_create_series_mask_from_contour_sequence(series_data, contour_sequence):
    mask = image_helper.create_empty_series_mask(series_data)
    transformation_matrix = image_helper.get_patient_to_pixel_transformation_matrix(series_data)

    # Iterate through each slice of the series; if it's part of the contour, add the contour mask
    for i, series_slice in enumerate(series_data):
        slice_contour_data = image_helper.get_slice_contour_data(series_slice, contour_sequence)
        try:
            if len(slice_contour_data):
                # Add contour data to mask
                mask[:, :, i] = image_helper.get_slice_mask_from_slice_contour_data(
                    series_slice, slice_contour_data, transformation_matrix
                )
        except:
            pass

    return mask

image_helper.create_series_mask_from_contour_sequence = monkey_patched_create_series_mask_from_contour_sequence


def dice_thread(rtstruct_pred,rtstruct_truth,name,scores):
    try:
        mask_3d_pred = rtstruct_pred.get_roi_mask_by_name(name)#organ
        mask_3d_truth = rtstruct_truth.get_roi_mask_by_name(name)
        #Uses all layers to calculate a DICE score
        mask_slice_pred = mask_3d_pred[:, :]#0:layer_num
        mask_slice_truth = mask_3d_truth[:, :]

        pred_flat = (np.array(mask_slice_pred)).flatten()
        truth_flat = (np.array(mask_slice_truth)).flatten()

        matches = np.sum(pred_flat[truth_flat] == 1)
        total = np.sum(pred_flat)+np.sum(truth_flat)

        dice_score = 2 * matches / total
        scores[name] = dice_score
        print(name,dice_score)
    except:
        print("fail: ",name)
        

#Output: The dice score for every layer combined
#Input: 
# directory of the dicom image folder (string)
# directory of the predicted rt struct (string)
# directory of the true rt struct (string)
def get_DICE_score(dicom_dir,pred_path,truth_path):
    #Determine ground truth with attributes
    try:
        scores = {}
        rtstruct_pred = RTStructBuilder.create_from(
            dicom_series_path= dicom_dir, 
            rt_struct_path= pred_path
        )

        rtstruct_truth = RTStructBuilder.create_from(
            dicom_series_path= dicom_dir, 
            rt_struct_path= truth_path
        )
        
        names = rtstruct_truth.get_roi_names()
        pool = concurrent.futures.ThreadPoolExecutor(max_workers=len(names))
        for name in names:
            pool.submit(dice_thread,rtstruct_pred,rtstruct_truth,name,scores)

        pool.shutdown(wait=True)
        return scores
    except Exception as e:
        return {}
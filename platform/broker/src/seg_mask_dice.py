import pydicom
from typing import Tuple
import pydicom_seg.reader_utils
import numpy as np


## deps
# pydicom                       2.4.4
# pydicom-seg                   0.4.1
# numpy
##

def mp_get_declared_image_spacing(dataset: pydicom.Dataset) -> Tuple[float, float, float]:
    sfg = dataset.SharedFunctionalGroupsSequence[0]
    if "PixelMeasuresSequence" not in sfg:
        raise ValueError("Pixel measures FG is missing!")

    pixel_measures = sfg.PixelMeasuresSequence[0]
    # DICOM defines (row spacing, column spacing) -> (y, x)
    y_spacing, x_spacing = pixel_measures.PixelSpacing

    # print(y_spacing, x_spacing) # added this

    if "SpacingBetweenSlices" in pixel_measures:
        z_spacing = pixel_measures.SpacingBetweenSlices
    else:
        # changed this. used to be pixel_measure.SliceThickness
        z_spacing = dataset.get('SliceThickness')

    # print(z_spacing) # added this

    return float(x_spacing), float(y_spacing), float(z_spacing)


pydicom_seg.reader_utils.get_declared_image_spacing = mp_get_declared_image_spacing

def pad_ground_truth(gt_data: np.ndarray, target_shape: Tuple[int, int, int]) -> np.ndarray:
    current_shape = gt_data.shape

    # Calculate the padding required for each dimension
    pad_z = (target_shape[0] - current_shape[0]
             ) if target_shape[0] > current_shape[0] else 0
    pad_y = (target_shape[1] - current_shape[1]
             ) if target_shape[1] > current_shape[1] else 0
    pad_x = (target_shape[2] - current_shape[2]
             ) if target_shape[2] > current_shape[2] else 0

    # Define the padding for each dimension as (before, after)
    padding = ((0, pad_z), (0, pad_y), (0, pad_x))

    # Pad the ground truth data with zeros
    padded_gt_data = np.pad(
        gt_data, padding, mode='constant', constant_values=0)
    return padded_gt_data


def calculate_dice_scores(pred_data: np.ndarray,
                          truth_data: np.ndarray,
                          segfile_pred: pydicom.Dataset,
                          segfile_truth: pydicom.Dataset):
    """
    Args:
        pred_data: Predicted segmentation array
        truth_data: Ground truth segmentation array
        segfile_pred: DICOM dataset containing prediction segment information
        segfile_truth: DICOM dataset containing ground truth segment information

    Returns:
        DICE scores for each ROI
    """
    if pred_data.shape != truth_data.shape:
        print(f"Shapes don't match: pred {pred_data.shape}, truth {truth_data.shape}")
        raise ValueError(
            "Prediction and ground truth arrays must have the same shape")

        # Create ROI to label mappings for both prediction and truth
    roi_to_label_pred = {}
    roi_to_label_truth = {}

    # Get truth labels
    if hasattr(segfile_truth, 'SegmentSequence'):
        for segment in segfile_truth.SegmentSequence:
            roi_to_label_truth[segment.SegmentNumber] = segment.SegmentLabel

    # Get prediction labels (assuming they're in the same structure)
    if hasattr(segfile_pred, 'SegmentSequence'):
        for segment in segfile_pred.SegmentSequence:
            roi_to_label_pred[segment.SegmentNumber] = segment.SegmentLabel

    # print("roi_to_label_truth ->")
    # print(roi_to_label_truth)
    # print("roi_to_label_pred ->")
    # print(roi_to_label_pred)

    # Create mapping of truth ROI numbers to pred ROI numbers based on matching labels
    truth_to_pred_roi = {}
    for truth_roi, truth_label in roi_to_label_truth.items():
        for pred_roi, pred_label in roi_to_label_pred.items():
            if truth_label == pred_label:
                truth_to_pred_roi[truth_roi] = pred_roi
                break

    # print("Mapped ROIs (truth_roi: pred_roi) ->")
    # print(truth_to_pred_roi)

    dice_scores = {}

    # Calculate dice scores for all prediction ROIs
    for pred_roi, pred_label in roi_to_label_pred.items():
        pred_flat = (pred_data == pred_roi).flatten()

        # Find if there's a corresponding truth ROI
        matching_truth_roi = None
        for truth_roi, mapped_pred_roi in truth_to_pred_roi.items():
            if mapped_pred_roi == pred_roi:
                matching_truth_roi = truth_roi
                break

        if matching_truth_roi is not None:
            # Calculate dice score with matching truth ROI
            truth_flat = (truth_data == matching_truth_roi).flatten()

            intersection = np.sum(pred_flat & truth_flat)
            total = np.sum(pred_flat) + np.sum(truth_flat)

            if total == 0:
                dice_score = 0.0
            else:
                dice_score = (2.0 * intersection) / total
        else:
            # No matching ROI in truth data
            dice_score = 0.0

        dice_scores[pred_label] = float(dice_score)

    # dice_scores is in the form of {'Liver': 0.8906308112413376, 'Stomach': 0.9276701174292482, 'Duodenum': 0.9404155757022683, 'Inferior Vena Cava': 0.7494568578632709, 'Left Kidney': 0.0, 'Right Kidney': 0.9141375614824105, 'Aorta': 0.0, 'Left Adrenal Gland': 0.0, 'Right Adrenal Gland': 0.0, 'Gallbladder': 0.0, 'Esophagus': 0.8972954467648065, 'Pancreas': 0.8069919883466861}
    dice_scores_list = [{key: value} for key, value in dice_scores.items()]
    # print(dice_scores_list)
    # return dice_scores
    return dice_scores_list

def seg_to_mask(seg_path, slice_thickness=1):
    seg_series = pydicom.dcmread(seg_path)
    seg_series.add(pydicom.DataElement(('0018', '0050'), 'DS', slice_thickness)) # set SliceThickness property
    reader = pydicom_seg.MultiClassReader()
    seg_mask = reader.read(seg_series).data
    return seg_mask, seg_series
    
def seg_mask_dice(dicom_dir, pred_path, truth_path):

    # print("hello I AM IN SEG_MASK_DICE ")
    # print("pred_path -> " + pred_path)
    # print("truth_path -> " + truth_path)
    # print("--------images------------------------")
    # dcm_images = pydicom.dcmread(pred_path)
    # dcm_images.add(pydicom.DataElement(('0018', '0050'), 'DS', 1))
    # # print(dcm_images.get('SliceThickness'))
    # reader = pydicom_seg.MultiClassReader()
    # result_images = reader.read(dcm_images)

    # image_data = result_images.data
    pred_data, dcm_pred = seg_to_mask(pred_path, slice_thickness=1)
    # print(image_data.shape)
    # print(image_data)

    # print("--------truth-----------")
    # dcm_truth = pydicom.dcmread(truth_path)
    # dcm_truth.add(pydicom.DataElement(('0018', '0050'), 'DS', 1))
    # # print(dcm_truth.get('SliceThickness'))
    # result_truth = reader.read(dcm_truth)

    # truth_data = result_truth.data
    # print(truth_data.shape)
    truth_data, dcm_truth = seg_to_mask(truth_path, slice_thickness=1)

    if truth_data.shape != pred_data.shape:
        if truth_data.shape[0] < pred_data.shape[0]:
            # print("not the same size, padding the ground truth to match the image shape")
            truth_data = pad_ground_truth(truth_data, pred_data.shape)
        elif truth_data.shape[0] > pred_data.shape[0]:
            pred_data = pad_ground_truth(pred_data, truth_data.shape)

    # print("after pad")
    # print(truth_data.shape)
    # truth_metadata = extract_metadata(dcm_truth, truth_data, "Truth Data")

    # print("DICE SCORES")
    dice_scores = calculate_dice_scores(
        pred_data, truth_data, dcm_pred, dcm_truth)

    # print(dice_scores)
    return dice_scores

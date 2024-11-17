import numpy as np
import pydicom
from pydicom import Dataset
import os

import pydicom.sequence
import cv2 as cv
from rt_utils import RTStructBuilder
from highdicom.seg import Segmentation, SegmentDescription
from pydicom.sr.coding import Code
from pydicom.uid import generate_uid
from typing import List
import monkey_patches
from seg_mask_dice import pad_ground_truth
from functools import reduce

# Function to convert RT struct to binary 3D mask
def get_roi_masks(dicom_series_path, rt_struct_path):
    try:
        rtstruct = RTStructBuilder.create_from(
            dicom_series_path=dicom_series_path,
            rt_struct_path=rt_struct_path
        )
        roi_names = rtstruct.get_roi_names()
        print(f"Available ROIs: {roi_names}")

        masks = {}
        valid_roi_names = []
        for roi_name in roi_names:
            try:
                mask = rtstruct.get_roi_mask_by_name(roi_name)
                print(f"Retrieved mask for {roi_name}")

                if mask is None:
                    print(f"No mask available for {roi_name}")
                    continue

                voxel_count = np.sum(mask > 0)
                if voxel_count == 0:
                    print(f"Skipping {roi_name} - no non-zero voxels found")
                    continue   
                    
                if mask.dtype != np.int32:
                    mask = mask.astype(np.int32)

                masks[roi_name] = {
                    'mask': mask,
                    'shape': mask.shape,
                    'voxels': np.sum(mask)
                }

                valid_roi_names.append(roi_name)
                print(f"Successfully added {roi_name} with {voxel_count} voxels")

            except cv.error as cv_err:
                print(f"\nException: OpenCV error processing {roi_name}: {cv_err}")
                continue

        return masks, valid_roi_names
    except Exception as e:
        print(f"Failed to process RT struct: {e}")
        return {},[]
    
# NOTE: there shouldn't really ever be a reason to use this over convert_3d
# It takes up more memory for no benefit
def convert_4d_numpy_array_to_dicom_seg(dicom_series: List[Dataset], numpy_array, roi_names, seg_filename, seg_series_description=None):
    '''
    Converts a (num_slices, height, width, num_rois) numpy array into DICOM SEG object
    '''
    dicom_series.sort(key=lambda d: d.InstanceNumber)
    
    segment_descriptions = []
    for i, roi_name in enumerate(roi_names):
        segment_descriptions.append(
            SegmentDescription(
                segment_number=i + 1,
                segment_label=roi_name,
                algorithm_type="MANUAL",
                segmented_property_category=Code("123037004", "SCT", "Anatomical Structure"),
                segmented_property_type=Code("85756007", "SCT", "Organ")
            )
        )

    num_slices, height, width, _ = numpy_array.shape
    print("num_slices ->"+str(num_slices))
    print("height ->" + str(height))
    print("width ->"+str(width))

    num_slices_in_dicom_series = len(dicom_series)
    if num_slices_in_dicom_series != num_slices:
        print(f"Slice mismatch: DICOM series has {num_slices_in_dicom_series}, pixel_array has {num_slices}.")
        return

    dicom_height = dicom_series[0].Rows
    dicom_width = dicom_series[0].Columns
    if dicom_height != height or dicom_width != width:
        print(f"Dimension mismatch: DICOM image is {dicom_height}x{dicom_width}, pixel_array is {height}x{width}.")
        return

    print('Creating SEG object')
    seg = Segmentation(
        source_images=dicom_series,
        pixel_array=numpy_array,
        segmentation_type="BINARY",
        segment_descriptions=segment_descriptions,
        series_instance_uid=generate_uid(),
        sop_instance_uid=generate_uid(),
        device_serial_number="123456",
        instance_number=1,
        manufacturer="YourCompany",
        manufacturer_model_name="YourModel",
        series_number=1,
        software_versions="1.0",
        series_description=seg_series_description,
        omit_empty_frames=False
    )

    try:
        print('Saving...')
        seg.save_as(seg_filename)
        print(f"DICOM SEG file saved at: {seg_filename}")
        return seg_filename
    except Exception as e:
        print(f"Error saving DICOM SEG file: {e}")
        return None
    
def convert_3d_numpy_array_to_dicom_seg(dicom_series: List[Dataset], numpy_array, roi_names, seg_filename, slice_axis=2, seg_series_description=None):
    '''
    Converts 3d numpy array into a DICOM SEG object.
    slice_axis determines which axis corresponds to num_slices
    '''
    if slice_axis >= 3:
        raise Exception(f'Invalid axis: {slice_axis}')
    
    if slice_axis == 0:
        num_slices, height, width = numpy_array.shape
        transpose = (0, 1, 2)
    if slice_axis == 1:
        height, num_slices, width = numpy_array.shape
        transpose = (1, 0, 2)
    if slice_axis == 2:
        height, width, num_slices = numpy_array.shape
        transpose = (2, 0, 1)
        
    # pixel_array = np.zeros((num_slices, height, width, len(roi_names)), dtype=np.uint8)

    # for i, roi_name in enumerate(roi_names):
    #     # print(roi_name)
    #     binary_mask = (numpy_array == i+1).astype(np.uint8)
    #     binary_mask = np.transpose(binary_mask, transpose)
    #     pixel_array[:, :, :, i] = binary_mask
        
    # return convert_4d_numpy_array_to_dicom_seg(dicom_series, pixel_array, roi_names, seg_filename, seg_series_description=seg_series_description)

    dicom_series.sort(key=lambda d: d.InstanceNumber)
    numpy_array = np.transpose(numpy_array, transpose)
    print(numpy_array.shape, numpy_array.dtype)
    print(roi_names)
    
    segment_descriptions = []
    for i, roi_name in enumerate(roi_names):
        segment_descriptions.append(
            SegmentDescription(
                segment_number=i + 1,
                segment_label=roi_name,
                algorithm_type="MANUAL",
                segmented_property_category=Code("123037004", "SCT", "Anatomical Structure"),
                segmented_property_type=Code("85756007", "SCT", "Organ")
            )
        )

    num_slices, height, width = numpy_array.shape
    print("num_slices ->"+str(num_slices))
    print("height ->" + str(height))
    print("width ->"+str(width))

    num_slices_in_dicom_series = len(dicom_series)
    if num_slices_in_dicom_series != num_slices:
        # print(f"Slice mismatch: DICOM series has {num_slices_in_dicom_series}, pixel_array has {num_slices}.")
        raise Exception(f"Slice mismatch: DICOM series has {num_slices_in_dicom_series}, pixel_array has {num_slices}.")

    dicom_height = dicom_series[0].Rows
    dicom_width = dicom_series[0].Columns
    if dicom_height != height or dicom_width != width:
        # print(f"Dimension mismatch: DICOM image is {dicom_height}x{dicom_width}, pixel_array is {height}x{width}.")
        raise Exception(f"Dimension mismatch: DICOM image is {dicom_height}x{dicom_width}, pixel_array is {height}x{width}.")

    print('Creating SEG object')
    print(segment_descriptions)
    numpy_array = numpy_array.astype(np.uint8)
    print(numpy_array.shape, numpy_array.dtype)
    print(numpy_array.max(), numpy_array.min())
    
    
    seg = Segmentation(
        source_images=dicom_series,
        pixel_array=numpy_array,
        segmentation_type="BINARY",
        segment_descriptions=segment_descriptions,
        series_instance_uid=generate_uid(),
        sop_instance_uid=generate_uid(),
        device_serial_number="123456",
        instance_number=1,
        manufacturer="YourCompany",
        manufacturer_model_name="YourModel",
        series_number=1,
        software_versions="1.0",
        series_description=seg_series_description,
        omit_empty_frames=False
    )

    try:
        print('Saving...')
        seg.save_as(seg_filename)
        print(f"DICOM SEG file saved at: {seg_filename}")
        return seg_filename
    except Exception as e:
        # print(f"Error saving DICOM SEG file: {e}")
        # return None
        raise Exception(f"Error saving DICOM SEG file: {e}")

# Converts binary 3D masks into a DICOM SEG object
def convert_mask_to_dicom_seg(dicom_series, binary_masks, roi_names, seg_filename, seg_series_description=None):
    '''
    Converts dict of binary 3D masks into a DICOM SEG object.
    binary_masks must be a dict of the same structure that get_roi_masks() returns.
    '''
    
    first_mask = binary_masks[roi_names[0]]['mask']
    height, width, num_slices = first_mask.shape
    
    pixel_array = np.zeros((num_slices, height, width, len(roi_names)), dtype=np.uint8)

    dicom_height = dicom_series[0].Rows
    dicom_width = dicom_series[0].Columns
    if dicom_height != height or dicom_width != width:
        print(f"Dimension mismatch: DICOM image is {dicom_height}x{dicom_width}, pixel_array is {height}x{width}.")
        return

    for i, roi_name in enumerate(roi_names):
        binary_mask = (binary_masks[roi_name]['mask'] > 0).astype(np.uint8)
        binary_mask = np.transpose(binary_mask, (2, 0, 1))
        pixel_array[:, :, :, i] = binary_mask

    return convert_4d_numpy_array_to_dicom_seg(dicom_series, pixel_array, roi_names, seg_filename, seg_series_description)

# Function to load DICOM series from a given path
def load_dicom_series(dicom_series_path):
    dicom_series = []
    for root, dirs, files in os.walk(dicom_series_path):
        for file in files:
            if file.endswith(".dcm"):
                dicom_file_path = os.path.join(root, file)
                dicom_series.append(pydicom.dcmread(dicom_file_path))
    return dicom_series

def get_non_intersection_mask_to_seg(
        dicom_series: List[Dataset],
        pred_data: np.ndarray,
        truth_data: np.ndarray,
        segfile_pred: pydicom.Dataset,
        segfile_truth: pydicom.Dataset, 
        output_filename: str,
        output_desc: str = 'Prediction Discrepancy',
        separate_fp_fn: bool = False,
        merge_all_rois: bool = False):
    
    print('!!!',pred_data.shape, truth_data.shape)
    if truth_data.shape != pred_data.shape:
        print('Padding...')
        if truth_data.shape[0] < pred_data.shape[0]:
            # print("not the same size, padding the ground truth to match the image shape")
            truth_data = pad_ground_truth(truth_data, pred_data.shape)
        elif truth_data.shape[0] > pred_data.shape[0]:
            pred_data = pad_ground_truth(pred_data, truth_data.shape)
            
    if pred_data.shape != truth_data.shape:
        print(f"Shapes don't match: pred {pred_data.shape}, truth {truth_data.shape}")
        raise ValueError(
            "Prediction and ground truth arrays must have the same shape")

    # Create label to ROI mappings for both prediction and truth
    label_to_roi_numbers = {}

    print(pred_data.shape, truth_data.shape)

    # Get truth labels
    if hasattr(segfile_truth, 'SegmentSequence'):
        for segment in segfile_truth.SegmentSequence:
            label_to_roi_numbers[segment.SegmentLabel] = [
                segment.SegmentNumber, None]

    # Get prediction labels (assuming they're in the same structure)
    if hasattr(segfile_pred, 'SegmentSequence'):
        for segment in segfile_pred.SegmentSequence:
            if (existing_segment := label_to_roi_numbers.get(segment.SegmentLabel, None)) is not None:
                existing_segment[1] = segment.SegmentNumber
            else:
                label_to_roi_numbers[segment.SegmentLabel] = [
                    None, segment.SegmentNumber]

    # merged_segment_labels = label_to_roi_numbers.keys()

    # non_intersections = np.zeros(shape=(truth_data.shape + (len(label_to_roi_numbers),)))
    non_intersections = np.zeros_like(truth_data)
    label_names = []
    mask_value = 1
    for index, (label_name, (truth_index, pred_index)) in enumerate(label_to_roi_numbers.items()):
        print('Processing', label_name, pred_index, truth_index)
        pred_mask = pred_data == pred_index
        truth_mask = truth_data == truth_index
        if separate_fp_fn: # false positive vs false negative
            fp = pred_mask & (~truth_mask)
            fn = (~pred_mask) & truth_mask
            if merge_all_rois:
                non_intersections[fp] = 1
                non_intersections[fn] = 2
            else:
                if np.count_nonzero(fp) > 0:
                    non_intersections[fp] = mask_value
                    mask_value += 1
                    label_names.append(label_name + ' FP')
                if np.count_nonzero(fn) > 0:
                    non_intersections[fn] = mask_value
                    mask_value += 1
                    label_names.append(label_name + ' FN')
        else:
            diff_mask = pred_mask ^ truth_mask
            if np.count_nonzero(diff_mask) > 0:
                non_intersections[diff_mask] = 1 if merge_all_rois else mask_value
                mask_value += 1
                label_names.append(label_name)
            
        # print(' - ', np.count_nonzero(pred_mask), np.count_nonzero(truth_mask), np.count_nonzero(non_intersections == index+1))
    
    if np.count_nonzero(non_intersections) == 0:
        print('There were no discrepancies between prediction and truth.')
        # TODO: handle this None somehow, probably with a toast
        return None
    
    if merge_all_rois:
        label_names = []
        fp_count = np.count_nonzero(non_intersections == 1)
        fn_count = np.count_nonzero(non_intersections == 2)
        if separate_fp_fn:
            if fp_count > 0:
                label_names.append('False Positives')
            if fn_count > 0:
                label_names.append('False Negatives')
        else:
            if fp_count + fn_count > 0:
                label_names.append('Discrepancies')
        # label_names = ['False Positive', 'False Negative'] if separate_fp_fn else ['Discrepancies']
    # elif separate_fp_fn:
    #     label_names = reduce(lambda a, c: a + [f'{c} FP', f'{c} FN'], label_names, [])
        
    if merge_all_rois:
        output_desc += '_m'
    if separate_fp_fn:
        output_desc += '_fpn'
    
    print(non_intersections.shape, non_intersections.dtype)
    print(label_names)
    print('Converting to SEG...')
    print(output_desc)
    if len(output_desc) > 64:
        prefix_len = (64 - 5) // 2  # Length of the prefix
        suffix_len = 64 - 5 - prefix_len  # Length of the suffix
        return output_desc[:prefix_len] + '-xxx-' + output_desc[-suffix_len:]
    
    return convert_3d_numpy_array_to_dicom_seg(dicom_series, non_intersections, label_names, output_filename, slice_axis=0, seg_series_description=output_desc)
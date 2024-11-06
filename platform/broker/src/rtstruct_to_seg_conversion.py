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
        for roi_name in roi_names:
            try:
                mask = rtstruct.get_roi_mask_by_name(roi_name)
                print(f"Retrieved mask for {roi_name}")

                if mask is None or mask.size == 0:
                    print(f"No mask available for {roi_name}")
                    continue

                if mask.dtype != np.int32:
                    mask = mask.astype(np.int32)

                masks[roi_name] = {
                    'mask': mask,
                    'shape': mask.shape,
                    'voxels': np.sum(mask)
                }

            except cv.error as cv_err:
                print(f"\nException: OpenCV error processing {roi_name}: {cv_err}")
                continue

        return masks
    except Exception as e:
        print(f"Failed to process RT struct: {e}")
        return {}

# Converts binary 3D masks into a DICOM SEG object
def convert_mask_to_dicom_seg(dicom_series, binary_masks, roi_names, seg_filename):
    '''
    Converts dict of binary 3D masks into a DICOM SEG object.
    binary_masks must be a dict of the same structure that get_roi_masks() returns.
    '''
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

    first_mask = binary_masks[roi_names[0]]['mask']
    height, width, num_slices = first_mask.shape
    print("num_slices ->"+str(num_slices))
    print("height ->" + str(height))
    print("width ->"+str(width))

    pixel_array = np.zeros((num_slices, height, width, len(roi_names)), dtype=np.uint8)
    num_slices_in_dicom_series = len(dicom_series)
    if num_slices_in_dicom_series != num_slices:
        print(f"Slice mismatch: DICOM series has {num_slices_in_dicom_series}, pixel_array has {num_slices}.")
        return

    dicom_height = dicom_series[0].Rows
    dicom_width = dicom_series[0].Columns
    if dicom_height != height or dicom_width != width:
        print(f"Dimension mismatch: DICOM image is {dicom_height}x{dicom_width}, pixel_array is {height}x{width}.")
        return

    for i, roi_name in enumerate(roi_names):
        binary_mask = (binary_masks[roi_name]['mask'] > 0).astype(np.uint8)
        binary_mask = np.transpose(binary_mask, (2, 0, 1))
        pixel_array[:, :, :, i] = binary_mask

    seg = Segmentation(
        source_images=dicom_series,
        pixel_array=pixel_array,
        segmentation_type="BINARY",
        segment_descriptions=segment_descriptions,
        series_instance_uid=generate_uid(),
        sop_instance_uid=generate_uid(),
        device_serial_number="123456",
        instance_number=1,
        manufacturer="YourCompany",
        manufacturer_model_name="YourModel",
        series_number=1,
        software_versions="1.0"
    )

    try:
        seg.save_as(seg_filename)
        print(f"DICOM SEG file saved at: {seg_filename}")
        return seg_filename
    except Exception as e:
        print(f"Error saving DICOM SEG file: {e}")
        return None
    
def convert_numpy_array_to_dicom_seg(dicom_series: List[Dataset], numpy_array, roi_names, seg_filename):
    '''
    Converts (NxMxH) numpy array into a DICOM SEG object.
    '''
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

    height, width, num_slices = numpy_array.shape
    print("num_slices ->"+str(num_slices))
    print("height ->" + str(height))
    print("width ->"+str(width))

    pixel_array = np.zeros((num_slices, height, width, len(roi_names)), dtype=np.uint8)
    num_slices_in_dicom_series = len(dicom_series)
    if num_slices_in_dicom_series != num_slices:
        print(f"Slice mismatch: DICOM series has {num_slices_in_dicom_series}, pixel_array has {num_slices}.")
        return

    dicom_height = dicom_series[0].Rows
    dicom_width = dicom_series[0].Columns
    if dicom_height != height or dicom_width != width:
        print(f"Dimension mismatch: DICOM image is {dicom_height}x{dicom_width}, pixel_array is {height}x{width}.")
        return

    for i, roi_name in enumerate(roi_names):
        # print(roi_name)
        binary_mask = (numpy_array == i+1).astype(np.uint8)
        binary_mask = np.transpose(binary_mask, (2, 0, 1))
        pixel_array[:, :, :, i] = binary_mask

    seg = Segmentation(
        source_images=dicom_series,
        pixel_array=pixel_array,
        segmentation_type="BINARY",
        segment_descriptions=segment_descriptions,
        series_instance_uid=generate_uid(),
        sop_instance_uid=generate_uid(),
        device_serial_number="123456",
        instance_number=1,
        manufacturer="YourCompany",
        manufacturer_model_name="YourModel",
        series_number=1,
        software_versions="1.0"
    )

    try:
        seg.save_as(seg_filename)
        print(f"DICOM SEG file saved at: {seg_filename}")
        return seg_filename
    except Exception as e:
        print(f"Error saving DICOM SEG file: {e}")
        return None

# Function to load DICOM series from a given path
def load_dicom_series(dicom_series_path):
    dicom_series = []
    for root, dirs, files in os.walk(dicom_series_path):
        for file in files:
            if file.endswith(".dcm"):
                dicom_file_path = os.path.join(root, file)
                dicom_series.append(pydicom.dcmread(dicom_file_path))
    return dicom_series






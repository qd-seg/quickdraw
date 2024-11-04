import numpy as np
import pydicom
import os
import cv2 as cv
from rt_utils import RTStructBuilder
from highdicom.seg import Segmentation, SegmentDescription
from pydicom.sr.coding import Code
from pydicom.uid import generate_uid
from rt_utils import image_helper

#monkey patch
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



#function to convert RT struct to binary 3D mask
def get_roi_masks(dicom_series_path, rt_struct_path):
    try:
        # Initialize RTStructBuilder
        rtstruct = RTStructBuilder.create_from(
            dicom_series_path=dicom_series_path,
            rt_struct_path=rt_struct_path
        )

        # Get the list of ROI names
        roi_names = rtstruct.get_roi_names()
        print(f"Available ROIs: {roi_names}")

        masks = {}

        # Process each ROI
        for roi_name in roi_names:
            try:

                mask = rtstruct.get_roi_mask_by_name(roi_name)
                print(f"Retrieved mask for {roi_name}")

                if mask is None or mask.size == 0:
                    print(f"No mask available for {roi_name}")
                    continue  # Skip to the next ROI

                #make sure mask is in correct format (int32)
                if mask.dtype != np.int32:
                    mask = mask.astype(np.int32)

                # Store mask information
                masks[roi_name] = {
                    'mask': mask,
                    'shape': mask.shape,
                    'voxels': np.sum(mask)
                }

                print(f"\nSuccessfully processed {roi_name}:")
                print(f"Mask shape: {mask.shape}")
                print(f"Number of voxels: {np.sum(mask)}")

            except cv.error as cv_err:
                print(f"\nException: OpenCV error processing {roi_name}: {cv_err}")
                continue

        return masks

    except Exception as e:
        print(f"Failed to process RT struct: {e}")
        return {}


#Converts binary 3D masks into a DICOM SEG object.
#dicom_series (list): List of pydicom DICOM datasets (CT/MR series).
#binary_masks (dict): Dictionary of binary masks with ROI names as keys.
#roi_names (list): List of ROI names corresponding to the binary masks.

def convert_mask_to_dicom_seg(dicom_series, binary_masks, roi_names):

    #define segmentation metadata
    segment_descriptions = []
    for i, roi_name in enumerate(roi_names):
        segment_descriptions.append(
            SegmentDescription(
                segment_number=i + 1,
                segment_label=roi_name,
                algorithm_type="MANUAL",
                segmented_property_category=Code("123037004", "SCT", "Anatomical Structure"),   #placeholder value
                segmented_property_type=Code("85756007", "SCT", "Organ") #placeholder value

            )
        )

    #Create pixel array with proper dimensions. Fill the pixel array and ensure binary values (0 or 1)

    # Get the shape of the first mask to determine dimensions
    first_mask = binary_masks[roi_names[0]]['mask']

    height, width, num_slices = first_mask.shape
    print("num_slices ->"+str(num_slices))
    print("height ->" + str(height))
    print("width ->"+str(width))


    # Initialize a 4D array with dimensions: [num_slices, height, width, num_segments]
    # Use uint8 data type as required by highdicom
    pixel_array = np.zeros((num_slices, height, width, len(roi_names)), dtype=np.uint8)

    #Check if the number of slices in dicom_series matches num_slices in pixel_array
    num_slices_in_dicom_series = len(dicom_series)
    if num_slices_in_dicom_series != num_slices:
        print(f"Slice mismatch: DICOM series has {num_slices_in_dicom_series}, pixel_array has {num_slices}.")
        return

    # Check the height and width dimensions
    dicom_height = dicom_series[0].Rows
    dicom_width = dicom_series[0].Columns
    if dicom_height != height or dicom_width != width:
        print(f"Dimension mismatch: DICOM image is {dicom_height}x{dicom_width}, pixel_array is {height}x{width}.")
        return

    for i, roi_name in enumerate(roi_names):
        # Convert mask to binary (0 or 1) and ensure uint8 type
        binary_mask = (binary_masks[roi_name]['mask'] > 0).astype(np.uint8)
        # Transpose the binary mask to match the same shape as the pixel array
        binary_mask = np.transpose(binary_mask, (2, 0, 1))
        pixel_array[:, :, :, i] = binary_mask


    seg = Segmentation(
        source_images=dicom_series,
        pixel_array= pixel_array,
        segmentation_type="BINARY",
        segment_descriptions=segment_descriptions,
        series_instance_uid=generate_uid(),
        sop_instance_uid=generate_uid(),
        device_serial_number="123456",    #placeholder
        instance_number=1,
        manufacturer="YourCompany", #placeholder
        manufacturer_model_name="YourModel",
        series_number=1,
        software_versions="1.0"
    )

    # Save the DICOM SEG Object
    seg_filename = r"C:\Sem7\Organ_Segmentation_Example_edited\Organ_Segmentation_Example\segmodel\model_outputs\segmentation_rstruct01_1028.dcm"

    try:
        seg.save_as(seg_filename)
        print(f"DICOM SEG file saved at: {seg_filename}")
    except Exception as e:
        print(f"Error saving DICOM SEG file: {e}")

def load_dicom_series(dicom_series_path):
    dicom_series = []
    for root, dirs, files in os.walk(dicom_series_path):
        for file in files:
            if file.endswith(".dcm"):
                dicom_file_path = os.path.join(root, file)
                dicom_series.append(pydicom.dcmread(dicom_file_path))
    return dicom_series


if __name__ == "__main__":
    dicom_series_path = r"C:\Sem7\Organ_Segmentation_Example_edited\Organ_Segmentation_Example\segmodel\images\PANCREAS_0001\11-24-2015-PANCREAS0001-Pancreas-18957\Pancreas-99667"
    rt_struct_path = r"C:\Sem7\Organ_Segmentation_Example_edited\Organ_Segmentation_Example\segmodel\model_outputs\PANCREAS_0001-multiorgan-segmentation.dcm"

    masks = get_roi_masks(dicom_series_path, rt_struct_path)

    if masks:
        dicom_series = load_dicom_series(dicom_series_path)
        roi_names = list(masks.keys())

        convert_mask_to_dicom_seg(dicom_series, masks, roi_names)
    else:
        print("No masks available to process.")



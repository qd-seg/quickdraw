from rtstruct_to_seg_conversion import get_roi_masks, convert_mask_to_dicom_seg, load_dicom_series

def process_conversion(dicom_series_path, rt_struct_path, seg_filename):
    # Step 1: Get ROI masks
    masks, valid_roi_names = get_roi_masks(dicom_series_path, rt_struct_path)
    if masks:
        # Step 2: Load DICOM series
        dicom_series = load_dicom_series(dicom_series_path)
        #roi_names = list(masks.keys())

        # Step 3: Convert mask to DICOM SEG
        convert_mask_to_dicom_seg(dicom_series, masks, valid_roi_names, seg_filename)

        return seg_filename
    else:
        print("No masks available to process.")
        return None

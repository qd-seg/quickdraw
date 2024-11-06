# Monkey patches to library methods

import numpy as np
from typing import Tuple
from highdicom.seg import SegmentationTypeValues, SegmentsOverlapValues, Segmentation

from highdicom.content import PixelMeasuresSequence
from pydicom.sequence import Sequence

from rt_utils import image_helper

PATCH_HIGHDICOM = False
PATCH_RTUTILS = True

# np.float_ is deprecated in numpy>=2.0.0
# highdicom<=0.22.0 still checks np.float_
@staticmethod
def _check_and_cast_pixel_array(
        pixel_array: np.ndarray,
        number_of_segments: int,
        segmentation_type: SegmentationTypeValues
    ) -> Tuple[np.ndarray, SegmentsOverlapValues]:
        if pixel_array.ndim == 4:
            # Check that the number of segments in the array matches
            if pixel_array.shape[-1] != number_of_segments:
                raise ValueError(
                    'The number of segments in last dimension of the pixel '
                    f'array ({pixel_array.shape[-1]}) does not match the '
                    'number of described segments '
                    f'({number_of_segments}).'
                )

        if pixel_array.dtype in (np.bool_, np.uint8, np.uint16):
            max_pixel = pixel_array.max()

            if pixel_array.ndim == 3:
                # A label-map style array where pixel values represent
                # segment associations

                # The pixel values in the pixel array must all belong to
                # a described segment
                if max_pixel > number_of_segments:
                    raise ValueError(
                        'Pixel array contains segments that lack '
                        'descriptions.'
                    )

                # By construction of the pixel array, we know that the segments
                # cannot overlap
                segments_overlap = SegmentsOverlapValues.NO
            else:
                # Pixel array is 4D where each segment is stacked down
                # the last dimension
                # In this case, each segment of the pixel array should be binary
                if max_pixel > 1:
                    raise ValueError(
                        'When passing a 4D stack of segments with an integer '
                        'pixel type, the pixel array must be binary.'
                    )

                # Need to check whether or not segments overlap
                if max_pixel == 0:
                    # Empty segments can't overlap (this skips an unnecessary
                    # further test)
                    segments_overlap = SegmentsOverlapValues.NO
                elif pixel_array.shape[-1] == 1:
                    # A single segment does not overlap
                    segments_overlap = SegmentsOverlapValues.NO
                else:
                    sum_over_segments = pixel_array.sum(axis=-1)
                    if np.any(sum_over_segments > 1):
                        segments_overlap = SegmentsOverlapValues.YES
                    else:
                        segments_overlap = SegmentsOverlapValues.NO

        elif pixel_array.dtype in (np.float32, np.float64):
            unique_values = np.unique(pixel_array)
            if np.min(unique_values) < 0.0 or np.max(unique_values) > 1.0:
                raise ValueError(
                    'Floating point pixel array values must be in the '
                    'range [0, 1].'
                )
            if segmentation_type == SegmentationTypeValues.BINARY:
                non_boolean_values = np.logical_and(
                    unique_values > 0.0,
                    unique_values < 1.0
                )
                if np.any(non_boolean_values):
                    raise ValueError(
                        'Floating point pixel array values must be either '
                        '0.0 or 1.0 in case of BINARY segmentation type.'
                    )
                pixel_array = pixel_array.astype(np.uint8)

                # Need to check whether or not segments overlap
                if len(unique_values) == 1 and unique_values[0] == 0.0:
                    # All pixels are zero: there can be no overlap
                    segments_overlap = SegmentsOverlapValues.NO
                elif pixel_array.ndim == 3 or pixel_array.shape[-1] == 1:
                    # A single segment does not overlap
                    segments_overlap = SegmentsOverlapValues.NO
                elif pixel_array.sum(axis=-1).max() > 1:
                    segments_overlap = SegmentsOverlapValues.YES
                else:
                    segments_overlap = SegmentsOverlapValues.NO
            else:
                if (pixel_array.ndim == 3) or (pixel_array.shape[-1] == 1):
                    # A single segment does not overlap
                    segments_overlap = SegmentsOverlapValues.NO
                else:
                    # A truly fractional segmentation with multiple segments.
                    # Unclear how overlap should be interpreted in this case
                    segments_overlap = SegmentsOverlapValues.UNDEFINED
        else:
            raise TypeError('Pixel array has an invalid data type.')

        return pixel_array, segments_overlap

# same issue as above: uses np.float_
@staticmethod
def _get_segment_pixel_array(
        pixel_array: np.ndarray,
        segment_number: int,
        number_of_segments: int,
        segmentation_type: SegmentationTypeValues,
        max_fractional_value: int
    ) -> np.ndarray:
        """Get pixel data array for a specific segment and plane.

        This is a helper method used during the constructor. Note that the
        pixel array is expected to have been processed using the
        ``_check_and_cast_pixel_array`` method before being passed to this
        method.

        Parameters
        ----------
        pixel_array: numpy.ndarray
            Segmentation pixel array containing all segments for a single plane.
            Array is therefore either (Rows x Columns x Segments) or (Rows x
            Columns) in case of a "label map" style array.
        segment_number: int
            The segment of interest.
        number_of_segments: int
            Number of segments in the the segmentation.
        segmentation_type: highdicom.seg.SegmentationTypeValues
            Desired output segmentation type.
        max_fractional_value: int
            Value for scaling FRACTIONAL segmentations.

        Returns
        -------
        numpy.ndarray:
            Pixel data array consisting of pixel data for a single segment for
            a single plane. Output array has dtype np.uint8 and binary values
            (0 or 1).

        """
        if pixel_array.dtype in (np.float32, np.float64):
            # Based on the previous checks and casting, if we get here the
            # output is a FRACTIONAL segmentation Floating-point numbers must
            # be mapped to 8-bit integers in the range [0,
            # max_fractional_value].
            if pixel_array.ndim == 3:
                segment_array = pixel_array[:, :, segment_number - 1]
            else:
                segment_array = pixel_array
            segment_array = np.around(
                segment_array * float(max_fractional_value)
            )
            segment_array = segment_array.astype(np.uint8)
        else:
            if pixel_array.ndim == 2:
                # "Label maps" that must be converted to binary masks.
                if number_of_segments == 1:
                    # We wish to avoid unnecessary comparison or casting
                    # operations here, for efficiency reasons. If there is only
                    # a single segment, the label map pixel array is already
                    # correct
                    if pixel_array.dtype != np.uint8:
                        segment_array = pixel_array.astype(np.uint8)
                    else:
                        segment_array = pixel_array
                else:
                    segment_array = (
                        pixel_array == segment_number
                    ).astype(np.uint8)
            else:
                segment_array = pixel_array[:, :, segment_number - 1]
                if segment_array.dtype != np.uint8:
                    segment_array = segment_array.astype(np.uint8)

            # It may happen that a binary valued array is passed that should be
            # stored as a fractional segmentation. In this case, we also need
            # to stretch pixel values to 8-bit unsigned integer range by
            # multiplying with the maximum fractional value.
            if segmentation_type == SegmentationTypeValues.FRACTIONAL:
                # Avoid an unnecessary multiplication operation if max
                # fractional value is 1
                if int(max_fractional_value) != 1:
                    segment_array *= int(max_fractional_value)

        return segment_array

# RT utils monkey patch for contours
def monkey_patched_create_series_mask_from_contour_sequence(series_data, contour_sequence):
    mask = image_helper.create_empty_series_mask(series_data)
    transformation_matrix = image_helper.get_patient_to_pixel_transformation_matrix(series_data)

    for i, series_slice in enumerate(series_data):
        slice_contour_data = image_helper.get_slice_contour_data(series_slice, contour_sequence)
        try:
            if len(slice_contour_data):
                mask[:, :, i] = image_helper.get_slice_mask_from_slice_contour_data(
                    series_slice, slice_contour_data, transformation_matrix
                )
        except:
            pass

    return mask

# Due to dependency issues, we must use a later version of pydicom, which does not 
def monkey_patched_PixelMeasuresSequence__eq__(self, other):
    if not isinstance(other, Sequence):
        raise TypeError('Second item must be of type pydicom.Sequence.')
    if len(other) != 1:
        raise ValueError('Second item must have length 1.')

    if other[0].get('SliceThickness', None) != self[0].get('SliceThickness', None):
        return False
    if other[0].PixelSpacing != self[0].PixelSpacing:
        return False
    if (
        hasattr(other[0], 'SpacingBetweenSlices') !=
        hasattr(self[0], 'SpacingBetweenSlices')
    ):
        return False
    if hasattr(self[0], 'SpacingBetweenSlices'):
        if other[0].SpacingBetweenSlices != self[0].SpacingBetweenSlices:
            return False

    return True


if PATCH_HIGHDICOM:    
    print('patching highdicom')
    Segmentation._check_and_cast_pixel_array = _check_and_cast_pixel_array
    PixelMeasuresSequence.__eq__ = monkey_patched_PixelMeasuresSequence__eq__  
    Segmentation._get_segment_pixel_array = _get_segment_pixel_array
    
if PATCH_RTUTILS:
    print('patching rt-utils')
    image_helper.create_series_mask_from_contour_sequence = monkey_patched_create_series_mask_from_contour_sequence

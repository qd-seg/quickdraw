import React from 'react';
import { Select, Icon, Dropdown, Tooltip, Button } from '@ohif/ui';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import WrappedSelect from '../WrappedSelect';

function SegmentationDropDownRow({
  segmentations = [],
  activeSegmentation,
  onActiveSegmentationChange,
  analysis,
  activeTruth,
  setActiveTruth,
  disableEditing,
  onToggleSegmentationVisibility,
  onSegmentationEdit,
  onSegmentationDownload,
  onSegmentationDownloadRTSS,
  storeSegmentation,
  onSegmentationDelete,
  onSegmentationAdd,
  addSegmentationClassName,
}) {
  if (!activeSegmentation) {
    return null;
  }

  const handleActiveSegmentationChange = option => {
    onActiveSegmentationChange(option.value);
  };

  const activeSegmentationOptions = segmentations.map(s => ({
    value: s.id,
    label: s.label,
  }));

  const truthSegmentationOptions = Object.values(analysis)
    .filter(r => r.maskUIDs.display_set_uid === activeSegmentation.id)
    .map(r => ({
      value: r.truthUIDs.display_set_uid,
      label: r.truthUIDs.series_desc,
    }));

  const { t } = useTranslation('SegmentationTable');

  if (activeTruth === undefined && truthSegmentationOptions.length > 0) {
    setActiveTruth(truthSegmentationOptions[0].value);
  }

  return (
    <div>
      {activeSegmentationOptions?.length && (
        <div>
          <WrappedSelect
            label="Active Segmentation"
            options={activeSegmentationOptions}
            value={activeSegmentationOptions?.find(o => o.value === activeSegmentation.id)}
            onChange={handleActiveSegmentationChange}
          />

          <WrappedSelect
            label="Ground Truth for DICE Score"
            options={truthSegmentationOptions}
            value={truthSegmentationOptions?.find(o => o.value === activeTruth)}
            onChange={o => setActiveTruth(o.value)}
          ></WrappedSelect>
        </div>
      )}

      <div className="group mx-0.5 mt-[8px] flex items-center justify-around pb-[10px]">
        <div
          onClick={e => {
            e.stopPropagation();
          }}
        >
          <Dropdown
            id="segmentation-dropdown"
            showDropdownIcon={false}
            alignment="left"
            itemsClassName={`text-primary-active ${addSegmentationClassName}`}
            showBorders={false}
            maxCharactersPerLine={30}
            list={[
              ...(!disableEditing
                ? [
                    {
                      title: t('Add new segmentation'),
                      onClick: () => {
                        onSegmentationAdd();
                      },
                    },
                  ]
                : []),
              ...(!disableEditing
                ? [
                    {
                      title: t('Rename'),
                      onClick: () => {
                        onSegmentationEdit(activeSegmentation.id);
                      },
                    },
                  ]
                : []),
              {
                title: t('Delete'),
                onClick: () => {
                  onSegmentationDelete(activeSegmentation.id);
                },
              },
              ...(!disableEditing
                ? [
                    {
                      title: t('Export DICOM SEG'),
                      onClick: () => {
                        storeSegmentation(activeSegmentation.id);
                      },
                    },
                  ]
                : []),
              ...[
                {
                  title: t('Download DICOM SEG'),
                  onClick: () => {
                    onSegmentationDownload(activeSegmentation.id);
                  },
                },
                {
                  title: t('Download DICOM RTSTRUCT'),
                  onClick: () => {
                    onSegmentationDownloadRTSS(activeSegmentation.id);
                  },
                },
              ],
            ]}
          >
            <div className="hover:bg-secondary-dark grid h-[28px] w-[28px] cursor-pointer place-items-center rounded-[4px]">
              <Icon name="icon-more-menu"></Icon>
            </div>
          </Dropdown>
        </div>
        <Tooltip
          position="bottom-right"
          content={
            <div className="flex flex-col">
              <div className="text-[13px] text-white">Series:</div>
              <div className="text-aqua-pale text-[13px]">{activeSegmentation.description}</div>
            </div>
          }
        >
          <Icon name="info-action" className="text-primary-active" />
        </Tooltip>
        <div
          className="hover:bg-secondary-dark mr-1 grid h-[28px] w-[28px] cursor-pointer place-items-center rounded-[4px]"
          onClick={() => onToggleSegmentationVisibility(activeSegmentation.id)}
        >
          {activeSegmentation.isVisible ? (
            <Icon name="row-shown" className="text-primary-active" />
          ) : (
            <Icon name="row-hidden" className="text-primary-active" />
          )}
        </div>
      </div>
    </div>
  );
}

SegmentationDropDownRow.propTypes = {
  segmentations: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
    })
  ).isRequired,
  activeSegmentation: PropTypes.shape({
    id: PropTypes.string.isRequired,
    isVisible: PropTypes.bool.isRequired,
  }),
  onActiveSegmentationChange: PropTypes.func.isRequired,
  disableEditing: PropTypes.bool,
  onToggleSegmentationVisibility: PropTypes.func,
  onSegmentationEdit: PropTypes.func,
  onSegmentationDownload: PropTypes.func,
  onSegmentationDownloadRTSS: PropTypes.func,
  storeSegmentation: PropTypes.func,
  onSegmentationDelete: PropTypes.func,
  onSegmentationAdd: PropTypes.func,
};

SegmentationDropDownRow.defaultProps = {
  segmentations: [],
  disableEditing: false,
};

export default SegmentationDropDownRow;

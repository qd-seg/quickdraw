import * as React from 'react';
import { Icon, Dropdown, Tooltip } from '@ohif/ui';

import WrappedSelect from '../WrappedSelect';

export default ({
  analysis,
  segmentations,
  activeSegmentation,
  activeTruthUID,
  segmentationClassName,

  disableEditing,

  onActiveSegmentationChange,
  onActiveTruthChange,
  onToggleSegmentationVisibility,
  onSegmentationEdit,
  onSegmentationDownload,
  onSegmentationDownloadRTSS,
  onSegmentationStore,
  onSegmentationDelete,
  onSegmentationAdd,
}) => {
  if (activeSegmentation === undefined) return null;

  const handleActiveSegmentationChange = option => onActiveSegmentationChange(option.value);
  const activeSegmentationOptions = segmentations.map((s: any) => ({
    value: s.id,
    label: s.label,
  }));

  const handleActiveTruthChange = option => onActiveTruthChange(option.value);
  const activeTruthOptions = Object.values(analysis)
    .filter((r: any) => r.maskUIDs.display_set_uid === activeSegmentation.id)
    .map((r: any) => ({ value: r.truthUIDs.display_set_uid, label: r.truthUIDs.series_desc }));

  if (activeTruthUID === undefined && activeTruthOptions.length > 0) {
    onActiveTruthChange(activeTruthOptions[0].value);
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
            options={activeTruthOptions}
            value={activeTruthOptions?.find(o => o.value === activeTruthUID)}
            onChange={handleActiveTruthChange}
          />
        </div>
      )}

      <div className="group mx-0.5 mt-[8px] flex items-center justify-around pb-[10px]">
        <div onClick={e => e.stopPropagation()}>
          <Dropdown
            id="segmentation-dropdown"
            showDropdownIcon={false}
            alignment="left"
            itemsClassName={`text-primary-active ${segmentationClassName}`}
            showBorders={false}
            maxCharactersPerLine={30}
            list={[
              ...(!disableEditing
                ? [
                    {
                      title: 'Add New Segmentation',
                      onClick: () => onSegmentationAdd(),
                    },
                  ]
                : []),
              ...(!disableEditing
                ? [
                    {
                      title: 'Rename',
                      onClick: () => onSegmentationEdit(activeSegmentation.id),
                    },
                  ]
                : []),
              {
                title: 'Delete',
                onClick: () => onSegmentationDelete(activeSegmentation.id),
              },
              ...(!disableEditing
                ? [
                    {
                      title: 'Export DICOM SEG',
                      onClick: () => onSegmentationStore(activeSegmentation.id),
                    },
                  ]
                : []),
              ...[
                {
                  title: 'Download DICOM SEG',
                  onClick: () => onSegmentationDownload(activeSegmentation.id),
                },
                {
                  title: 'Download DICOM RTSTRUCT',
                  onClick: () => onSegmentationDownloadRTSS(activeSegmentation.id),
                },
              ],
            ]}
          >
            <div className="hover:bg-secondary-dark grid h-[28px] w-[28px] cursor-pointer place-items-center rounded-[4px]">
              <Icon name="icon-more-menu" />
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
};

import * as React from 'react';
import { Icon, Dropdown } from '@ohif/ui';

import WrappedSelect, { WrappedSelectOption } from '../WrappedSelect';
import { EvaluationMap } from '../AnalysisPanel';
import { Segmentation } from '../SegmentationPanel';
import { SelectedSegmentationPair } from '../PredictionAnalysisPanelSection';

interface ActionRowProperties {
  evaluations: EvaluationMap;
  segmentations: Segmentation[];
  selected: SelectedSegmentationPair;
  setSelected: React.Dispatch<React.SetStateAction<SelectedSegmentationPair>>;
  additionalClassName: string;
  disableEditing: boolean;
  onSegmentationAdd: () => unknown;
  onSegmentationDelete: (segmentationId: string) => unknown;
  onSegmentationEdit: (segmentationId: string) => unknown;
  onSegmentationClick: (segmentationId: string) => unknown;
  onSegmentationToggleVisibility: (segmentationId: string) => unknown;
  onSegmentationDownload: (segmentationId: string) => unknown;
  onSegmentationDownloadRTSS: (segmentationId: string) => unknown;
  onSegmentationExport: (segmentationId: string) => unknown;
}

export default (properties: ActionRowProperties) => {
  const {
    evaluations,
    segmentations,
    selected,
    setSelected,
    additionalClassName,
    disableEditing,
    onSegmentationAdd,
    onSegmentationDelete,
    onSegmentationEdit,
    onSegmentationClick,
    onSegmentationToggleVisibility,
    onSegmentationDownload,
    onSegmentationExport,
  } = properties;

  const active = React.useMemo(() => {
    return segmentations?.find(segmentation => segmentation.isActive);
  }, [segmentations]);

  const loaded = React.useMemo(() => {
    if (!segmentations) return [];

    return segmentations.map(segmentation => ({
      value: segmentation.id,
      label: segmentation.label,
    }));
  }, [evaluations, segmentations]);

  const comparable = React.useMemo(() => {
    if (!active) return [];

    return Array.from(evaluations.entries())
      .map(([key, value]) => ({ set: new Set(key.split(':')), value }))
      .filter(({ set }) => set.has(active.id))
      .map(({ set, value }) => {
        return set.size === 1
          ? { id: Array.from(set.keys())[0], value }
          : { id: Array.from(set.keys()).find(id => id !== active.id), value };
      })
      .map(({ id, value }) => value.descriptors.find(descriptor => descriptor.value === id));
  }, [active, loaded]);

  React.useEffect(() => {
    if (comparable.length === 0) return;

    setSelected(previous => {
      previous[1] = comparable[0];
      return [...previous];
    });
  }, [active]);

  return (
    <div>
      <WrappedSelect
        description="Active Segmentation"
        options={loaded as WrappedSelectOption[]}
        value={loaded.find(option => option?.value === selected[0]?.value)}
        onChange={option => {
          setSelected(previous => {
            onSegmentationClick(option.value);

            previous[0] = option;
            return [...previous];
          });
        }}
      />

      <WrappedSelect
        description="Comparison Segmentation"
        options={comparable as WrappedSelectOption[]}
        value={comparable.find(option => option?.value === selected[1]?.value)}
        onChange={option => {
          setSelected(previous => {
            previous[1] = option;
            return [...previous];
          });
        }}
      />

      <div className="group mx-0.5 mt-[8px] flex items-center justify-around pb-[10px]">
        <div onClick={e => e.stopPropagation()}>
          <Dropdown
            id="segmentation-dropdown"
            showDropdownIcon={false}
            alignment="left"
            itemsClassName={`text-primary-active ${additionalClassName}`}
            showBorders={false}
            maxCharactersPerLine={30}
            list={[
              ...(!disableEditing
                ? [
                    {
                      title: 'Add',
                      onClick: () => onSegmentationAdd(),
                    },
                  ]
                : []),
              ...(!disableEditing
                ? [
                    {
                      title: 'Rename',
                      onClick: () => active && onSegmentationEdit(active.id),
                    },
                  ]
                : []),
              {
                title: 'Delete',
                onClick: () => active && onSegmentationDelete(active.id),
              },
              ...(!disableEditing
                ? [
                    {
                      title: 'Export',
                      onClick: () => active && onSegmentationExport(active.id),
                    },
                  ]
                : []),
              ...[
                {
                  title: 'Download',
                  onClick: () => active && onSegmentationDownload(active.id),
                },
              ],
            ]}
          >
            <div className="hover:bg-secondary-dark grid h-[28px] w-[28px] cursor-pointer place-items-center rounded-[4px]">
              <Icon name="icon-more-menu" />
            </div>
          </Dropdown>
        </div>

        <div
          className="hover:bg-secondary-dark mr-1 grid h-[28px] w-[28px] cursor-pointer place-items-center rounded-[4px]"
          onClick={() => active && onSegmentationToggleVisibility(active.id)}
        >
          {active?.isVisible ? (
            <Icon name="row-shown" className="text-primary-active" />
          ) : (
            <Icon name="row-hidden" className="text-primary-active" />
          )}
        </div>
      </div>
    </div>
  );
};

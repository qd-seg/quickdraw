import * as React from 'react';
import { Icon, Tooltip } from '@ohif/ui';

import WrappedSelect, { WrappedSelectOption } from '../WrappedSelect';
import { EvaluationMap } from '../AnalysisPanel';
import { Segmentation } from '../SegmentationPanel';
import { SelectedSegmentationPair } from '../PredictionAnalysisPanelSection';

interface ActionRowProperties {
  evaluations: EvaluationMap;
  segmentations: Segmentation[];
  primary: Segmentation | undefined;
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
    primary,
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

  const available = React.useMemo(() => {
    if (!segmentations || !evaluations) return [];

    const reducer = (accumulator, descriptor) => {
      return accumulator.find(option => option.value === descriptor.value)
        ? accumulator
        : [...accumulator, descriptor];
    };

    const loaded = segmentations.map(segmentation => ({
      value: segmentation.id,
      label: segmentation.label,
    })) as WrappedSelectOption[];

    const calculated = Array.from(evaluations.values()).map(evaluation => {
      return evaluation.descriptors[0];
    });

    return calculated.concat(loaded).reduce(reducer, []);
  }, [evaluations, segmentations]);

  const comparable = React.useMemo(() => {
    if (!selected[0]) return [];

    return Array.from(evaluations.entries())
      .map(([key, value]) => ({ pair: key.split(':'), value }))
      .filter(({ pair }) => selected[0]?.value === pair[0])
      .map(({ pair, value }) => value.descriptors[1]);
  }, [evaluations, selected]);

  React.useEffect(() => {
    if (available.find(option => option.value === selected[0]?.value)) return;

    if (available.length === 0) {
      setSelected(previous => {
        previous[0] = undefined;
        return [...previous];
      });
    } else {
      setSelected(previous => {
        previous[0] = available[0];
        return [...previous];
      });
    }
  }, [available]);

  React.useEffect(() => {
    if (comparable.find(option => option.value === selected[1]?.value)) return;

    if (comparable.length === 0) {
      setSelected(previous => {
        previous[1] = undefined;
        return [...previous];
      });
    } else {
      setSelected(previous => {
        previous[1] = comparable[0];
        return [...previous];
      });
    }
  }, [comparable]);

  return (
    <div>
      <WrappedSelect
        description="Primary Segmentation"
        options={available as WrappedSelectOption[]}
        value={selected[0]}
        onChange={option => {
          setSelected(previous => {
            previous[0] = option;
            return [...previous];
          });
        }}
      />

      <WrappedSelect
        description="Comparison Segmentation"
        options={comparable as WrappedSelectOption[]}
        value={selected[1]}
        onChange={option => {
          setSelected(previous => {
            previous[1] = option;
            return [...previous];
          });
        }}
      />

      <div className="mx-0.5 mt-[8px] justify-around pb-[10px]">
        <div className="group mx-0.5 mt-[8px] flex items-center justify-around">
          {!disableEditing && (
            <div onClick={event => event.stopPropagation()}>
              <div
                className="hover:bg-secondary-dark mr-1 grid h-[28px] w-[28px] cursor-pointer place-items-center rounded-[4px]"
                onClick={() => onSegmentationAdd()}
              >
                <Tooltip content="Create Empty">
                  <Icon name="icon-add" className="text-primary-active" />
                </Tooltip>
              </div>
            </div>
          )}

          {primary && !disableEditing && (
            <div onClick={event => event.stopPropagation()}>
              <div
                className="hover:bg-secondary-dark mr-1 grid h-[28px] w-[28px] cursor-pointer place-items-center rounded-[4px]"
                onClick={() => onSegmentationExport(primary.id)}
              >
                <Tooltip content="Export as New">
                  <Icon name="action-new-dialog" className="text-primary-active" />
                </Tooltip>
              </div>
            </div>
          )}

          {primary && !disableEditing && (
            <div onClick={event => event.stopPropagation()}>
              <div
                className="hover:bg-secondary-dark mr-1 grid h-[28px] w-[28px] cursor-pointer place-items-center rounded-[4px]"
                onClick={() => onSegmentationEdit(primary.id)}
              >
                <Tooltip content="Rename">
                  <Icon name="icon-rename" className="text-primary-active" />
                </Tooltip>
              </div>
            </div>
          )}

          {primary && (
            <div onClick={event => event.stopPropagation()}>
              <div
                className="hover:bg-secondary-dark mr-1 grid h-[28px] w-[28px] cursor-pointer place-items-center rounded-[4px]"
                onClick={() => onSegmentationDelete(primary.id)}
              >
                <Tooltip content="Unload">
                  <Icon name="icon-close" className="text-primary-active" />
                </Tooltip>
              </div>
            </div>
          )}

          {primary && (
            <div onClick={event => event.stopPropagation()}>
              <div
                className="hover:bg-secondary-dark mr-1 grid h-[28px] w-[28px] cursor-pointer place-items-center rounded-[4px]"
                onClick={() => onSegmentationToggleVisibility(primary.id)}
              >
                {primary.isVisible ? (
                  <Tooltip content="Hide All">
                    <Icon name="row-shown" className="text-primary-active" />
                  </Tooltip>
                ) : (
                  <Tooltip content="Show All">
                    <Icon name="row-hidden" className="text-primary-active" />
                  </Tooltip>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

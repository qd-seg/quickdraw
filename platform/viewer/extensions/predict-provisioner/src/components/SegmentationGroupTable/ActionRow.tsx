import * as React from 'react';
import { Icon, Dropdown } from '@ohif/ui';

import WrappedSelect, { WrappedSelectOption } from '../WrappedSelect';
import { EvaluationMap } from '../AnalysisPanel';
import { Segmentation } from '../SegmentationPanel';
import { SelectedSegmentationPair } from '../PredictionAnalysisPanelSection';
import NoSegmentationRow from './NoSegmentationRow';

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
    console.log(evaluations, primary, selected[0]);
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

      {primary && (
        <div className="mx-0.5 mt-[8px] justify-around pb-[10px]">
          {!disableEditing && (
            <div onClick={event => event.stopPropagation()} className="w-full">
              <div className={`group ${additionalClassName}`} onClick={() => onSegmentationAdd()}>
                <div className="text-primary-active group-hover:bg-secondary-dark flex items-center rounded-[4px] group-hover:cursor-pointer">
                  <div className="grid h-[28px] w-[28px] place-items-center">
                    <Icon name="icon-add" />
                  </div>

                  <span className="text-[13px]">Create Empty</span>
                </div>
              </div>
            </div>
          )}

          {!disableEditing && (
            <div onClick={event => event.stopPropagation()} className="w-full">
              <div
                className={`group ${additionalClassName}`}
                onClick={() => onSegmentationExport(primary.id)}
              >
                <div className="text-primary-active group-hover:bg-secondary-dark flex items-center rounded-[4px] group-hover:cursor-pointer">
                  <div className="grid h-[28px] w-[28px] place-items-center">
                    <Icon name="action-new-dialog" />
                  </div>

                  <span className="text-[13px]">Save as New</span>
                </div>
              </div>
            </div>
          )}

          {!disableEditing && (
            <div onClick={event => event.stopPropagation()} className="w-full">
              <div
                className={`group ${additionalClassName}`}
                onClick={() => onSegmentationEdit(primary.id)}
              >
                <div className="text-primary-active group-hover:bg-secondary-dark flex items-center rounded-[4px] group-hover:cursor-pointer">
                  <div className="grid h-[28px] w-[28px] place-items-center">
                    <Icon name="icon-rename" />
                  </div>

                  <span className="text-[13px]">Rename</span>
                </div>
              </div>
            </div>
          )}

          <div onClick={event => event.stopPropagation()} className="w-full">
            <div
              className={`group ${additionalClassName}`}
              onClick={() => onSegmentationDelete(primary.id)}
            >
              <div className="text-primary-active group-hover:bg-secondary-dark flex items-center rounded-[4px] group-hover:cursor-pointer">
                <div className="grid h-[28px] w-[28px] place-items-center">
                  <Icon name="icon-close" />
                </div>

                <span className="text-[13px]">Unload</span>
              </div>
            </div>
          </div>

          <div onClick={event => event.stopPropagation()} className="w-full">
            <div
              className={`group ${additionalClassName}`}
              onClick={() => onSegmentationToggleVisibility(primary.id)}
            >
              <div className="text-primary-active group-hover:bg-secondary-dark flex items-center rounded-[4px] group-hover:cursor-pointer">
                <div className="grid h-[28px] w-[28px] place-items-center">
                  <Icon name={primary.isVisible ? 'row-shown' : 'row-hidden'} />
                </div>

                <span className="text-[13px]">{primary.isVisible ? 'Hide All' : 'Show All'}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

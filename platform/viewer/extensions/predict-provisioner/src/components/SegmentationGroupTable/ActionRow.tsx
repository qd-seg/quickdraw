import * as React from 'react';
import { Icon, Dropdown } from '@ohif/ui';

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

    const calculated = Array.from(evaluations.values())
      .map(evaluation => evaluation.descriptors)
      .flat();

    return calculated.concat(loaded).reduce(reducer, []) as WrappedSelectOption[];
  }, [evaluations, segmentations]);

  const comparable = React.useMemo(() => {
    if (!selected[0]) return [];

    return Array.from(evaluations.entries())
      .map(([key, value]) => ({ set: new Set(key.split(':')), value }))
      .filter(({ set }) => selected[0] && set.has(selected[0].value))
      .map(({ set, value }) => {
        if (set.size === 1) return { id: Array.from(set.keys())[0], value };

        const id = Array.from(set.keys()).find(id => selected[0] && id !== selected[0].value);
        return { id, value };
      })
      .map(({ id, value }) => {
        return value.descriptors.find(descriptor => descriptor.value === id);
      }) as WrappedSelectOption[];
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
        <div className="group mx-0.5 mt-[8px] flex items-center justify-around pb-[10px]">
          <div onClick={event => event.stopPropagation()}>
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
                        onClick: () => onSegmentationEdit(primary.id),
                      },
                    ]
                  : []),
                {
                  title: 'Delete',
                  onClick: () => onSegmentationDelete(primary.id),
                },
                ...(!disableEditing
                  ? [
                      {
                        title: 'Export',
                        onClick: () => onSegmentationExport(primary.id),
                      },
                    ]
                  : []),
                ...[
                  {
                    title: 'Download',
                    onClick: () => onSegmentationDownload(primary.id),
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
            onClick={() => onSegmentationToggleVisibility(primary.id)}
          >
            {primary?.isVisible ? (
              <Icon name="row-shown" className="text-primary-active" />
            ) : (
              <Icon name="row-hidden" className="text-primary-active" />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

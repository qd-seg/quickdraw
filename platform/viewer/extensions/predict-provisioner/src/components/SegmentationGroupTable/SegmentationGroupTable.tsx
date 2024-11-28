import * as React from 'react';
import { PanelSection } from '@ohif/ui';

import ConfigurationMenu from './ConfigurationMenu';
import ActionRow from './ActionRow';
import NoSegmentationRow from './NoSegmentationRow';
import AddSegmentRow from './AddSegmentRow';

import { Segmentation, SegmentationConfiguration } from '../SegmentationPanel';
import { EvaluationMap } from '../AnalysisPanel';
import { SelectedSegmentationPair } from '../PredictionAnalysisPanelSection';
import SegmentRow from './SegmentRow';

interface SegmentationGroupTableProperties {
  configuration: { initialConfiguration: SegmentationConfiguration };
  evaluations: EvaluationMap;
  segmentations: Segmentation[];
  additionalClassName: string;
  disableEditing: boolean;
  showAddSegmentation: boolean;
  showAddSegment: boolean;
  showDeleteSegment: boolean;
  onSegmentationAdd: () => unknown;
  onSegmentationDelete: (id: string) => unknown;
  onSegmentationEdit: (id: string) => unknown;
  onSegmentationClick: (id: string) => unknown;
  onSegmentationToggleVisibility: (id: string) => unknown;
  onSegmentationDownload: (id: string) => unknown;
  onSegmentationDownloadRTSS: (id: string) => unknown;
  onSegmentationExport: (id: string) => unknown;
  onSegmentAdd: (id: string) => unknown;
  onSegmentDelete: (id: string, index: number) => unknown;
  onSegmentEdit: (id: string, index: number) => unknown;
  onSegmentClick: (id: string, index: number) => unknown;
  onSegmentColorClick: (id: string, index: number) => unknown;
  onSegmentToggleVisibility: (id: string, index: number) => unknown;
  onSegmentToggleLock: (id: string, index: number) => unknown;
  setRenderOutline: (value: unknown) => unknown;
  setRenderFill: (value: unknown) => unknown;
  setRenderInactiveSegmentations: (value: unknown) => unknown;
  setOutlineOpacityActive: (value: unknown) => unknown;
  setOutlineWidthActive: (value: unknown) => unknown;
  setFillAlpha: (value: unknown) => unknown;
  setFillAlphaInactive: (value: unknown) => unknown;
}

export default (properties: SegmentationGroupTableProperties) => {
  const {
    configuration,
    evaluations,
    segmentations,
    additionalClassName,
    disableEditing,
    showAddSegmentation,
    showAddSegment,
    showDeleteSegment,
    onSegmentationAdd,
    onSegmentationDelete,
    onSegmentationEdit,
    onSegmentationClick,
    onSegmentationToggleVisibility,
    onSegmentationDownload,
    onSegmentationDownloadRTSS,
    onSegmentationExport,
    onSegmentAdd,
    onSegmentDelete,
    onSegmentEdit,
    onSegmentClick,
    onSegmentToggleVisibility,
    onSegmentColorClick,
    onSegmentToggleLock,
    setRenderOutline,
    setRenderFill,
    setRenderInactiveSegmentations,
    setOutlineOpacityActive,
    setOutlineWidthActive,
    setFillAlpha,
    setFillAlphaInactive,
  } = properties;

  const [isConfigurationOpen, setIsConfigurationOpen] = React.useState<boolean>(false);
  const [selected, setSelected] = React.useState<SelectedSegmentationPair>([undefined, undefined]);

  const active = React.useMemo(() => {
    return segmentations?.find(segmentation => segmentation.isActive);
  }, [segmentations, evaluations]);

  React.useEffect(() => {
    if (!active) return;

    setSelected(previous => {
      previous[0] = { label: active.label, value: active.id };
      return [...previous];
    });
  }, [active]);

  return (
    <div className="flex min-h-0 flex-col bg-black text-[13px] font-[300]">
      <PanelSection
        title={'Segmentation'}
        actionIcons={
          selected[0]
            ? [
                {
                  name: 'settings-bars',
                  onClick: () => setIsConfigurationOpen(value => !value),
                },
              ]
            : []
        }
      >
        {isConfigurationOpen && (
          <ConfigurationMenu
            configuration={configuration}
            setFillAlpha={setFillAlpha}
            setFillAlphaInactive={setFillAlphaInactive}
            setOutlineWidthActive={setOutlineWidthActive}
            setOutlineOpacityActive={setOutlineOpacityActive}
            setRenderFill={setRenderFill}
            setRenderInactiveSegmentations={setRenderInactiveSegmentations}
            setRenderOutline={setRenderOutline}
          />
        )}

        <div className="bg-primary-dark">
          {segmentations?.length === 0 ? (
            <div className="select-none bg-black py-[3px]">
              {showAddSegmentation && !disableEditing && (
                <NoSegmentationRow
                  onSegmentationAdd={onSegmentationAdd}
                  additionalClassName={additionalClassName}
                />
              )}
            </div>
          ) : (
            <div className="mt-1 select-none">
              <ActionRow
                evaluations={evaluations}
                segmentations={segmentations}
                selected={selected}
                setSelected={setSelected}
                additionalClassName={additionalClassName}
                disableEditing={disableEditing}
                onSegmentationAdd={onSegmentationAdd}
                onSegmentationDelete={onSegmentationDelete}
                onSegmentationEdit={onSegmentationEdit}
                onSegmentationClick={onSegmentationClick}
                onSegmentationToggleVisibility={onSegmentationToggleVisibility}
                onSegmentationDownload={onSegmentationDownload}
                onSegmentationDownloadRTSS={onSegmentationDownloadRTSS}
                onSegmentationExport={onSegmentationExport}
              />

              {!disableEditing && showAddSegment && (
                <AddSegmentRow
                  onClick={() => selected[0] && onSegmentAdd(selected[0].value)}
                  onSegmentationToggleVisibility={() => {}}
                  segmentation={undefined}
                />
              )}
            </div>
          )}

          {active && (
            <div className="ohif-scrollbar flex h-fit min-h-0 flex-1 flex-col overflow-auto bg-black">
              {active.segments?.map(segment => {
                if (!segment) return null;

                const { segmentIndex: index, color, label, isVisible, isLocked } = segment;

                const key = [selected[0]?.value, selected[1]?.value].sort().join(':');
                const evaluation = evaluations.get(key);
                const record = evaluation?.result.find(record => record.label === label);

                return (
                  <div className="mb-[1px]" key={index}>
                    <SegmentRow
                      segmentation={active}
                      index={index}
                      label={label}
                      color={color}
                      text={undefined}
                      record={record ? record : evaluation ? { label, value: 0 } : undefined}
                      isActive={active.activeSegmentIndex === index}
                      isVisible={isVisible}
                      isLocked={isLocked}
                      showDelete={showDeleteSegment}
                      disableEditing={disableEditing}
                      onSegmentDelete={onSegmentDelete}
                      onSegmentEdit={onSegmentEdit}
                      onSegmentClick={onSegmentClick}
                      onSegmentColorClick={onSegmentColorClick}
                      onSegmentToggleVisibility={onSegmentToggleVisibility}
                      onSegmentToggleLock={onSegmentToggleLock}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </PanelSection>
    </div>
  );
};

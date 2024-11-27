import * as React from 'react';
import { PanelSection } from '@ohif/ui';

import ConfigurationMenu from './ConfigurationMenu';
import ActionRow from './ActionRow';
import NoSegmentationRow from './NoSegmentationRow';
import AddSegmentRow from './AddSegmentRow';

import { Segmentation, SegmentationConfiguration } from '../SegmentationPanel';
import { EvaluationMap } from '../AnalysisPanel';
import { SelectedSegmentationPair } from '../PredictionAnalysisPanelSection';

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
  onSegmentationDelete: (segmentationId: string) => unknown;
  onSegmentationEdit: (segmentationId: string) => unknown;
  onSegmentationClick: (segmentationId: string) => unknown;
  onSegmentationToggleVisibility: (segmentationId: string) => unknown;
  onSegmentationDownload: (segmentationId: string) => unknown;
  onSegmentationDownloadRTSS: (segmentationId: string) => unknown;
  onSegmentationExport: (segmentationId: string) => unknown;
  onSegmentAdd: (segmentationId: string) => unknown;
  onSegmentDelete: (segmentationId: string, segmentIndex: number) => unknown;
  onSegmentEdit: (segmentationId: string, segmentIndex: number) => unknown;
  onSegmentClick: (segmentationId: string, segmentIndex: number) => unknown;
  onSegmentColorClick: (segmentationId: string, segmentIndex: number) => unknown;
  onSegmentToggleVisibility: (segmentationId: string, segmentIndex: number) => unknown;
  onSegmentToggleLock: (segmentationId: string, segmentIndex: number) => unknown;
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

  React.useEffect(() => {
    let active = segmentations?.find(segmentation => segmentation.isActive);

    if (!active) return;

    setSelected(previous => {
      previous[0] = { label: active.label, value: active.id };
      return [...previous];
    });
  }, [segmentations]);

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
        </div>
      </PanelSection>
    </div>
  );
};

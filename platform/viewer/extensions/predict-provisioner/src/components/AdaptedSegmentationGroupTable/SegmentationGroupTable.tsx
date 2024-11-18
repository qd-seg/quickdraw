import * as React from 'react';
import { PanelSection } from '@ohif/ui';

import SegmentationConfig from './SegmentationConfig';
import SegmentationDropDownRow from './SegmentationDropDownRow';
import NoSegmentationRow from './NoSegmentationRow';
import AddSegmentRow from './AddSegmentRow';
import SegmentationGroupSegment from './SegmentationGroupSegment';

export default ({
  analysis,
  segmentations,

  config,
  segmentationClassName,

  disableEditing,
  showAddSegmentation,
  showAddSegment,
  showDeleteSegment,

  onSegmentationAdd,
  onSegmentationEdit,
  onSegmentationClick,
  onSegmentationDelete,
  onSegmentationDownload,
  onSegmentationDownloadRTSS,
  onSegmentationStore,
  onSegmentClick,
  onSegmentColorClick,
  onSegmentAdd,
  onSegmentDelete,
  onSegmentEdit,
  onToggleSegmentationVisibility,
  onToggleSegmentVisibility,
  onToggleSegmentLock,

  setFillAlpha,
  setFillAlphaInactive,
  setOutlineWidthActive,
  setOutlineOpacityActive,
  setRenderFill,
  setRenderInactiveSegmentations,
  setRenderOutline,
}) => {
  const [isConfigOpen, setIsConfigOpen] = React.useState(false);
  const [activeSegmentationUID, setActiveSegmentationUID] = React.useState(undefined);
  const [activeTruthUID, setActiveTruthUID] = React.useState(undefined);

  const [activeSegmentationScores, setActiveSegmentationScores] = React.useState([]);

  const onActiveSegmentationChange = segmentationUID => {
    onSegmentationClick(segmentationUID);
    setActiveSegmentationUID(segmentationUID);
    getActiveSegmentationScores(segmentationUID);
  };

  const onActiveTruthChange = truthUID => {
    setActiveTruthUID(truthUID);
    getActiveSegmentationScores(activeSegmentationUID);
  };

  const getActiveSegmentationScores = segmentationUID => {
    const scores = analysis[`${segmentationUID}:${activeTruthUID}`]?.scores;

    if (scores) setActiveSegmentationScores(scores);
    else setActiveSegmentationScores([]);
  };

  React.useEffect(() => {
    getActiveSegmentationScores(activeSegmentationUID);
  }, [analysis, activeTruthUID]);

  React.useEffect(() => {
    let activeUID = segmentations?.find(segmentation => segmentation.isActive)?.id;

    if (!activeUID && segmentations?.length > 0) activeUID = segmentations[0].id;
    if (segmentations?.length === 0) activeUID = undefined;

    setActiveSegmentationUID(activeUID);
    getActiveSegmentationScores(activeUID);
  }, [segmentations]);

  const activeSegmentation = segmentations?.find(
    segmentation => segmentation.id === activeSegmentationUID
  );

  return (
    <div className="flex min-h-0 flex-col bg-black text-[13px] font-[300]">
      <PanelSection
        title={'Segmentation'}
        actionIcons={
          activeSegmentation && [
            {
              name: 'settings-bars',
              onClick: () => setIsConfigOpen(isOpen => !isOpen),
            },
          ]
        }
      >
        {isConfigOpen && (
          <SegmentationConfig
            config={config}
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
                  segmentationClassName={segmentationClassName}
                />
              )}
            </div>
          ) : (
            <div className="mt-1 select-none">
              <SegmentationDropDownRow
                analysis={analysis}
                segmentations={segmentations}
                activeSegmentation={activeSegmentation}
                activeTruthUID={activeTruthUID}
                segmentationClassName={segmentationClassName}
                disableEditing={disableEditing}
                onActiveSegmentationChange={onActiveSegmentationChange}
                onActiveTruthChange={onActiveTruthChange}
                onToggleSegmentationVisibility={onToggleSegmentationVisibility}
                onSegmentationEdit={onSegmentationEdit}
                onSegmentationDownload={onSegmentationDownload}
                onSegmentationDownloadRTSS={onSegmentationDownloadRTSS}
                onSegmentationStore={onSegmentationStore}
                onSegmentationDelete={onSegmentationDelete}
                onSegmentationAdd={onSegmentationAdd}
              />

              {!disableEditing && showAddSegment && (
                <AddSegmentRow
                  onClick={() => onSegmentAdd(activeSegmentationUID)}
                  onToggleSegmentationVisibility={() => {}}
                  segmentation={undefined}
                />
              )}
            </div>
          )}
        </div>

        {activeSegmentation && (
          <div className="ohif-scrollbar flex h-fit min-h-0 flex-1 flex-col overflow-auto bg-black">
            {activeSegmentation?.segments?.map(segment => {
              if (!segment) return null;

              const { segmentIndex: index, color, label, isVisible, isLocked } = segment;
              const record = activeSegmentationScores.find(s => Object.keys(s)[0] === label);
              const score = record ? record[label] : undefined;

              return (
                <div className="mb-[1px]" key={index}>
                  <SegmentationGroupSegment
                    segmentationUID={activeSegmentationUID}
                    score={score}
                    index={index}
                    label={label}
                    color={color}
                    isActive={activeSegmentation.activeSegmentIndex === index}
                    isVisible={isVisible}
                    isLocked={isLocked}
                    showDelete={showDeleteSegment}
                    disableEditing={disableEditing}
                    displayText={undefined}
                    onClick={onSegmentClick}
                    onEdit={onSegmentEdit}
                    onDelete={onSegmentDelete}
                    onColor={onSegmentColorClick}
                    onToggleVisibility={onToggleSegmentVisibility}
                    onToggleLocked={onToggleSegmentLock}
                  />
                </div>
              );
            })}
          </div>
        )}
      </PanelSection>
    </div>
  );
};

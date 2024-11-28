import * as React from 'react';
import { Icon } from '@ohif/ui';

import { Segmentation } from '../SegmentationPanel';

interface SegmentRowProperties {
  segmentation: Segmentation;
  index: number;
  label: string;
  color: [number, number, number];
  text: string | string[] | undefined;
  record: { label: string; value: number } | undefined;
  isActive: boolean;
  isVisible: boolean;
  isLocked: boolean;
  showDelete: boolean;
  disableEditing: boolean;
  onSegmentDelete: (id: string, index: number) => unknown;
  onSegmentEdit: (id: string, index: number) => unknown;
  onSegmentClick: (id: string, index: number) => unknown;
  onSegmentColorClick: (id: string, index: number) => unknown;
  onSegmentToggleVisibility: (id: string, index: number) => unknown;
  onSegmentToggleLock: (id: string, index: number) => unknown;
}

interface HoveringIconProperties {
  segmentation: Segmentation;
  index: number;
  isLocked: boolean;
  isVisible: boolean;
  disableEditing: boolean;
  onSegmentEdit: (id: string, index: number) => unknown;
  onSegmentToggleVisibility: (id: string, index: number) => unknown;
  onSegmentToggleLock: (id: string, index: number) => unknown;
}

export default (properties: SegmentRowProperties) => {
  const {
    segmentation,
    index,
    label,
    color,
    text,
    record,
    isActive,
    isVisible,
    isLocked,
    showDelete,
    disableEditing,
    onSegmentDelete,
    onSegmentEdit,
    onSegmentClick,
    onSegmentColorClick,
    onSegmentToggleVisibility,
    onSegmentToggleLock,
  } = properties;

  const [isNumberBoxHovering, setIsNumberBoxHovering] = React.useState<boolean>(false);

  return (
    <div
      className={`text-aqua-pale group/row bg-primary-dark flex min-h-[28px] flex-col overflow-hidden ${isActive ? 'bg-primary-light border-primary-light rounded-l-[6px] border text-black' : ''}`}
      onClick={event => {
        event.stopPropagation();
        onSegmentClick(segmentation.id, index);
      }}
      tabIndex={0}
      data-cy={'segment-item'}
    >
      <div className="flex min-h-[28px]">
        <div
          className={`group/number grid w-[28px] place-items-center ${isActive ? 'bg-primary-light border-primary-light rounded-l-[4px] border text-black' : 'bg-primary-dark border-primary-dark border'}`}
          onMouseEnter={() => setIsNumberBoxHovering(true)}
          onMouseLeave={() => setIsNumberBoxHovering(false)}
        >
          {isNumberBoxHovering && showDelete ? (
            <Icon
              name="close"
              className={`h-[8px] w-[8px] ${!disableEditing ? 'hover:cursor-pointer hover:opacity-60' : ''}`}
              onClick={event => {
                if (disableEditing) return;
                event.stopPropagation();
                onSegmentDelete(segmentation.id, index);
              }}
            />
          ) : (
            <div>{index}</div>
          )}
        </div>

        <div
          className={`text-aqua-pale relative flex w-full ${!isActive ? 'border border-l-0 border-transparent' : ''}`}
          style={{ width: 'calc(100% - 28px)' }}
        >
          <div className="bg-primary-dark flex h-full flex-grow items-center">
            <div className="pl-2 pr-1.5">
              <div
                className={`h-[8px] w-[8px] grow-0 rounded-full ${!disableEditing ? 'hover:cursor-pointer hover:opacity-60' : ''}`}
                style={{ backgroundColor: `rgb(${color[0]},${color[1]},${color[2]})` }}
                onClick={event => {
                  if (disableEditing) return;

                  event.stopPropagation();
                  onSegmentColorClick(segmentation.id, index);
                }}
              />
            </div>

            {record && (
              <div className="pl-1.5 pr-1.5">
                <div className="flex grid w-[28px] place-items-center items-center py-1 font-semibold">
                  {record.value.toFixed(2)}
                </div>
              </div>
            )}

            <div className="flex items-center py-1 hover:cursor-pointer">{label}</div>
          </div>

          <div className="absolute right-[8px] top-0 flex flex-row-reverse rounded-lg pt-[3px]">
            <div className="group-hover/row:hidden">
              {!isVisible && (
                <Icon
                  name="row-hidden"
                  className="h-5 w-5 text-[#3d5871]"
                  onClick={event => {
                    event.stopPropagation();
                    onSegmentToggleVisibility(segmentation.id, index);
                  }}
                />
              )}
            </div>

            <div className="group-hover/row:hidden">
              {isLocked && (
                <div className="flex">
                  <Icon
                    name="row-lock"
                    className="h-5 w-5 text-[#3d5871]"
                    onClick={event => {
                      event.stopPropagation();
                      onSegmentToggleLock(segmentation.id, index);
                    }}
                  />

                  {isVisible && <Icon name="row-hidden" className="h-5 w-5 opacity-0" />}
                </div>
              )}
            </div>

            <div className="hidden group-hover/row:flex">
              <HoveringIcons
                segmentation={segmentation}
                index={index}
                isLocked={isLocked}
                isVisible={isVisible}
                disableEditing={disableEditing}
                onSegmentEdit={onSegmentEdit}
                onSegmentToggleVisibility={onSegmentToggleVisibility}
                onSegmentToggleLock={onSegmentToggleLock}
              />
            </div>
          </div>
        </div>
      </div>

      {Array.isArray(text) ? (
        <div className="flex flex-col bg-black py-[5px] pl-[43px]">
          {text.map(value => (
            <div key={value} className="text-aqua-pale flex h-full items-center text-[11px]">
              {value}
            </div>
          ))}
        </div>
      ) : (
        text && (
          <div className="text-aqua-pale flex h-full items-center px-2 py-[5px] pl-[45px] text-[11px]">
            {text}
          </div>
        )
      )}
    </div>
  );
};

const HoveringIcons = (properties: HoveringIconProperties) => {
  const {
    segmentation,
    index,
    isLocked,
    isVisible,
    disableEditing,
    onSegmentEdit,
    onSegmentToggleVisibility,
    onSegmentToggleLock,
  } = properties;

  const create = (name, action, color) => (
    <Icon
      name={name}
      className={`h-5 w-5 hover:cursor-pointer hover:opacity-60 ${color ?? 'text-white'}`}
      onClick={event => {
        event.stopPropagation();
        action(segmentation.id, index);
      }}
    />
  );

  return (
    <div className="flex items-center">
      {!disableEditing && create('row-edit', onSegmentEdit, null)}

      {!disableEditing &&
        create(
          isLocked ? 'row-lock' : 'row-unlock',
          onSegmentToggleLock,
          isLocked ? 'text-[#3d5871]' : null
        )}

      {create(
        isVisible ? 'row-shown' : 'row-hidden',
        onSegmentToggleVisibility,
        !isVisible ? 'text-[#3d5871]' : null
      )}
    </div>
  );
};

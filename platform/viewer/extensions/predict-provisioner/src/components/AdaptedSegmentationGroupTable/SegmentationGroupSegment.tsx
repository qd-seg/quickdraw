import * as React from 'react';
import { Icon } from '@ohif/ui';

export default ({
  segmentationUID,

  score,
  index,
  label,
  color,

  isActive,
  isVisible,
  isLocked,
  showDelete,
  disableEditing,
  displayText,

  onClick,
  onEdit,
  onDelete,
  onColor,
  onToggleVisibility,
  onToggleLocked,
}) => {
  const [isNumberBoxHovering, setIsNumberBoxHovering] = React.useState(false);

  return (
    <div
      className={`text-aqua-pale group/row bg-primary-dark flex min-h-[28px] flex-col overflow-hidden ${isActive === true ? 'bg-primary-light border-primary-light rounded-l-[6px] border text-black' : ''}`}
      onClick={e => {
        e.stopPropagation();
        onClick(segmentationUID, index);
      }}
      tabIndex={0}
      data-cy={'segment-item'}
    >
      <div className="flex min-h-[28px]">
        <div
          className={`group/number grid w-[28px] place-items-center ${isActive === true ? 'bg-primary-light border-primary-light rounded-l-[4px] border text-black' : 'bg-primary-dark border-primary-dark border'}`}
          onMouseEnter={() => setIsNumberBoxHovering(true)}
          onMouseLeave={() => setIsNumberBoxHovering(false)}
        >
          {isNumberBoxHovering && showDelete ? (
            <Icon
              name="close"
              className={`h-[8px] w-[8px] ${!disableEditing ? 'hover:cursor-pointer hover:opacity-60' : ''}`}
              onClick={e => {
                if (disableEditing) return;
                e.stopPropagation();
                onDelete(segmentationUID, index);
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
                onClick={e => {
                  if (disableEditing) return;
                  e.stopPropagation();
                  onColor(segmentationUID, index);
                }}
              />
            </div>

            <div className="flex items-center py-1 hover:cursor-pointer">
              {`${score ? `${score.toFixed(2)} - ` : ''}${label}`}
            </div>
          </div>

          <div className="absolute right-[8px] top-0 flex flex-row-reverse rounded-lg pt-[3px]">
            <div className="group-hover/row:hidden">
              {!isVisible && (
                <Icon
                  name="row-hidden"
                  className="h-5 w-5 text-[#3d5871]"
                  onClick={e => {
                    e.stopPropagation();
                    onToggleVisibility(segmentationUID, index);
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
                    onClick={e => {
                      e.stopPropagation();
                      onToggleLocked(segmentationUID, index);
                    }}
                  />

                  {isVisible && <Icon name="row-hidden" className="h-5 w-5 opacity-0" />}
                </div>
              )}
            </div>

            <div className="hidden group-hover/row:flex">
              <HoveringIcons
                segmentationUID={segmentationUID}
                index={index}
                disableEditing={disableEditing}
                isLocked={isLocked}
                isVisible={isVisible}
                onEdit={onEdit}
                onToggleLocked={onToggleLocked}
                onToggleVisibility={onToggleVisibility}
              />
            </div>
          </div>
        </div>
      </div>

      {Array.isArray(displayText) ? (
        <div className="flex flex-col bg-black py-[5px] pl-[43px]">
          {displayText.map(text => (
            <div key={text} className="text-aqua-pale flex h-full items-center text-[11px]">
              {text}
            </div>
          ))}
        </div>
      ) : (
        displayText && (
          <div className="text-aqua-pale flex h-full items-center px-2 py-[5px] pl-[45px] text-[11px]">
            {displayText}
          </div>
        )
      )}
    </div>
  );
};

const HoveringIcons = ({
  segmentationUID,
  index,
  disableEditing,
  isLocked,
  isVisible,
  onToggleLocked,
  onToggleVisibility,
  onEdit,
}) => {
  const handleIconClick = (e, action) => {
    e.stopPropagation();
    action(segmentationUID, index);
  };

  const createIcon = (name, action, color) => (
    <Icon
      name={name}
      className={`h-5 w-5 hover:cursor-pointer hover:opacity-60 ${color ?? 'text-white'}`}
      onClick={e => handleIconClick(e, action)}
    />
  );

  return (
    <div className="flex items-center">
      {!disableEditing && createIcon('row-edit', onEdit, null)}

      {!disableEditing &&
        createIcon(
          isLocked ? 'row-lock' : 'row-unlock',
          onToggleLocked,
          isLocked ? 'text-[#3d5871]' : null
        )}

      {createIcon(
        isVisible ? 'row-shown' : 'row-hidden',
        onToggleVisibility,
        !isVisible ? 'text-[#3d5871]' : null
      )}
    </div>
  );
};

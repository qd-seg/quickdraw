import * as React from 'react';
import { Icon } from '@ohif/ui';

export default ({ onSegmentationAdd, segmentationClassName }) => {
  return (
    <div className={`group ${segmentationClassName}`} onClick={onSegmentationAdd}>
      <div className="text-primary-active group-hover:bg-secondary-dark flex items-center rounded-[4px] group-hover:cursor-pointer">
        <div className="grid h-[28px] w-[28px] place-items-center">
          <Icon name="icon-add" />
        </div>

        <span className="text-[13px]">Add Segmentation</span>
      </div>
    </div>
  );
};

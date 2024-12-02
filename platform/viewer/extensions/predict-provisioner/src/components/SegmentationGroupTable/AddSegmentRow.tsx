import * as React from 'react';
import { Icon } from '@ohif/ui';

interface AddSegmentRowProperties {
  onClick: () => unknown;
}

export default (properties: AddSegmentRowProperties) => {
  const { onClick } = properties;

  return (
    <div className="flex justify-between bg-black hover:cursor-pointer">
      <div className="group w-full py-[5px] pb-[5px]" onClick={onClick}>
        <div className="text-primary-active group-hover:bg-secondary-dark flex items-center rounded-[4px] pr-2">
          <div className="grid h-[28px] w-[28px] place-items-center">
            <Icon name="icon-add" />
          </div>

          <span className="text-[13px]">Add Segment</span>
        </div>
      </div>
    </div>
  );
};

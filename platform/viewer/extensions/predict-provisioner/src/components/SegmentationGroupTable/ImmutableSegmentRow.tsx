import * as React from 'react';

interface ImmutableSegmentRowProperties {
  index: number;
  record: { label: string; value: number };
}

export default (properties: ImmutableSegmentRowProperties) => {
  const { index, record } = properties;

  return (
    <div
      className="text-aqua-pale group/row bg-primary-dark flex min-h-[28px] flex-col overflow-hidden"
      tabIndex={0}
      data-cy={'segment-item'}
    >
      <div className="flex min-h-[28px]">
        <div className="group/number bg-primary-dark border-primary-dark grid w-[28px] place-items-center border">
          <div>{index}</div>
        </div>

        <div className="text-aqua-pale relative flex w-full" style={{ width: 'calc(100% - 28px)' }}>
          <div className="bg-primary-dark flex h-full flex-grow items-center">
            <div className="pl-2 pr-1.5">
              <div className="bg-primary-main h-[8px] w-[8px] grow-0 rounded-full" />
            </div>

            <div className="pl-1.5 pr-1.5">
              <div className="flex grid w-[28px] place-items-center items-center py-1 font-semibold">
                {record.value.toFixed(2)}
              </div>
            </div>

            <div className="flex items-center py-1">{record.label}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

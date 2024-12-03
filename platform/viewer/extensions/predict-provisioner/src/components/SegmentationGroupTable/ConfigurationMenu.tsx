import * as React from 'react';
import { Icon, InputRange, CheckBox, InputNumber } from '@ohif/ui';

import { SegmentationConfiguration } from '../SegmentationPanel';

const round = value => Math.round(value * 100) / 100;

interface ActiveConfigurationMenuProperties {
  configuration: SegmentationConfiguration;
  setRenderOutline: (value: unknown) => unknown;
  setRenderFill: (value: unknown) => unknown;
  setOutlineOpacityActive: (value: unknown) => unknown;
  setOutlineWidthActive: (value: unknown) => unknown;
  setFillAlpha: (value: unknown) => unknown;
}

interface InactiveConfigurationMenuProperties {
  configuration: SegmentationConfiguration;
  setRenderInactiveSegmentations: (value: unknown) => unknown;
  setFillAlphaInactive: (value: unknown) => unknown;
}

interface ConfigurationMenuProperties {
  configuration: { initialConfiguration: SegmentationConfiguration };
  setRenderOutline: (value: unknown) => unknown;
  setRenderFill: (value: unknown) => unknown;
  setRenderInactiveSegmentations: (value: unknown) => unknown;
  setOutlineOpacityActive: (value: unknown) => unknown;
  setOutlineWidthActive: (value: unknown) => unknown;
  setFillAlpha: (value: unknown) => unknown;
  setFillAlphaInactive: (value: unknown) => unknown;
}

const ActiveConfigurationMenu = (properties: ActiveConfigurationMenuProperties) => {
  const {
    configuration,
    setRenderOutline,
    setRenderFill,
    setOutlineOpacityActive,
    setOutlineWidthActive,
    setFillAlpha,
  } = properties;

  return (
    <div className="flex justify-between gap-[5px] px-2 pt-[13px] text-[12px]">
      <div className="flex h-[89px] flex-col items-start">
        <div className="mb-[12px] text-white">Active</div>
        <CheckBox
          label="Outline"
          checked={configuration.renderOutline}
          labelClassName="text-[12px]"
          className="mb-[9px]"
          onChange={setRenderOutline}
        />

        <div className="mt-2" />
        <CheckBox
          label="Fill"
          checked={configuration.renderFill}
          labelClassName="text-[12px]"
          className="mb-[9px]"
          onChange={setRenderFill}
        />
      </div>

      <div className="col-span-2 flex flex-col items-center">
        <div className="mb-[12px] text-[10px] text-[#b3b3b3]">Opacity</div>
        <InputRange
          minValue={0}
          maxValue={100}
          value={round((configuration.outlineOpacity || 0) * 100)}
          onChange={setOutlineOpacityActive}
          step={1}
          containerClassName="mt-[4px] mb-[9px] w-[100px]"
          inputClassName="w-[64px]"
          labelClassName="text-white text-[12px] whitespace-nowrap"
          unit="%"
        />

        <InputRange
          minValue={0}
          maxValue={100}
          value={round((configuration.fillAlpha || 0) * 100)}
          onChange={setFillAlpha}
          step={1}
          containerClassName="mt-[4px] mb-[9px] w-[100px]"
          inputClassName="w-[64px]"
          labelClassName="text-white text-[12px] whitespace-nowrap"
          unit="%"
        />
      </div>

      <div className="flex flex-col items-center">
        <div className="mb-[12px] text-[10px] text-[#b3b3b3]">Size</div>
        <InputNumber
          value={configuration.outlineWidthActive}
          onChange={setOutlineWidthActive}
          minValue={0}
          maxValue={10}
          className="-mt-1"
        />
      </div>
    </div>
  );
};

const InactiveConfigurationMenu = (properties: InactiveConfigurationMenuProperties) => {
  const { configuration, setRenderInactiveSegmentations, setFillAlphaInactive } = properties;

  return (
    <div className="px-3">
      <CheckBox
        label="Display inactive segmentations"
        checked={configuration.renderInactiveSegmentations}
        labelClassName="text-[12px]"
        className="mb-[9px]"
        onChange={setRenderInactiveSegmentations}
      />

      <div className="flex items-center space-x-2 pl-4">
        <span className="text-[10px] text-[#b3b3b3]">Opacity</span>
        <InputRange
          minValue={0}
          maxValue={100}
          value={round((configuration.fillAlphaInactive || 0) * 100)}
          onChange={setFillAlphaInactive}
          step={1}
          containerClassName="mt-[4px]"
          inputClassName="w-[64px]"
          labelClassName="text-white text-[12px]"
          unit="%"
        />
      </div>
    </div>
  );
};

export default (properties: ConfigurationMenuProperties) => {
  const {
    configuration,
    setFillAlpha,
    setFillAlphaInactive,
    setOutlineWidthActive,
    setOutlineOpacityActive,
    setRenderFill,
    setRenderInactiveSegmentations,
    setRenderOutline,
  } = properties;

  const [isMinimized, setIsMinimized] = React.useState<boolean>(true);

  return (
    <div className="bg-primary-dark select-none">
      <div>
        <ActiveConfigurationMenu
          configuration={configuration.initialConfiguration}
          setFillAlpha={setFillAlpha}
          setOutlineWidthActive={setOutlineWidthActive}
          setOutlineOpacityActive={setOutlineOpacityActive}
          setRenderFill={setRenderFill}
          setRenderOutline={setRenderOutline}
        />

        <div className="mx-1 mb-[8px] h-[1px] bg-[#212456]" />

        <div
          onClick={() => setIsMinimized(!isMinimized)}
          className="flex cursor-pointer items-center pb-[9px] pl-2"
        >
          <Icon
            name="panel-group-open-close"
            className={`h-5 w-5 cursor-pointer text-white transition duration-300 ${!isMinimized ? 'rotate-90 transform' : ''}`}
          />

          <span className="text-[12px] font-[300] text-[#d8d8d8]">Inactive Segmentations</span>
        </div>

        {!isMinimized && (
          <InactiveConfigurationMenu
            configuration={configuration.initialConfiguration}
            setRenderInactiveSegmentations={setRenderInactiveSegmentations}
            setFillAlphaInactive={setFillAlphaInactive}
          />
        )}
      </div>

      <div className="h-[6px] bg-black" />
    </div>
  );
};

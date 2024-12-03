import * as React from 'react';
import { Select, Typography, Label } from '@ohif/ui';

export type WrappedSelectOption = { label: string; value: string };

export interface WrappedSelectProperties {
  description: string;
  value: WrappedSelectOption | undefined;
  options: WrappedSelectOption[];
  onChange: (value: WrappedSelectOption) => unknown;
}

export default (properties: WrappedSelectProperties) => {
  const { description, value, options, onChange } = properties;

  const child = (
    <Select
      className="mb-2 w-full"
      closeMenuOnSelect={true}
      isSearchable={true}
      isClearable={false}
      value={value}
      options={options}
      onChange={onChange}
    />
  );

  const text = (
    <Typography
      color="primaryLight"
      children={description}
      className="mb-0.5 mt-1 pl-2.5"
      varient="subtitle"
    />
  );

  return <Label children={child} text={text} />;
};

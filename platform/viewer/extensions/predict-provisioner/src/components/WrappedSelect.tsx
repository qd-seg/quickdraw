import * as React from 'react';

import { PanelSection, Select, Typography, Label } from '@ohif/ui';

export default ({ value, onChange, options, label }) => {
  const child = (
    <Select
      className="mb-2 w-full"
      closeMenuOnSelect={true}
      isSearchable={true}
      isClearable={false}
      options={options}
      onChange={onChange}
      value={value}
    />
  );

  const text = (
    <Typography
      color="primaryLight"
      children={label}
      className="mb-0.5 mt-1 pl-2.5"
      varient="subtitle"
    />
  );

  return <Label children={child} text={text}></Label>;
};

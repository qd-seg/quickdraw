import * as React from 'react';
import { ChromePicker } from 'react-color';
import { Dialog } from '@ohif/ui';

import './ColorPickerDialog.css';

export default (service, rgbaColor, callback) => {
  const id = 'pick-color';

  const onSubmitHandler = ({ action, value }) => {
    switch (action.id) {
      case 'save':
        callback(value.rgbaColor, action.id);
        break;
      case 'cancel':
        callback('', action.id);
        break;
    }
    service.dismiss({ id });
  };

  if (service !== undefined) {
    service.create({
      id,
      centralize: true,
      isDraggable: false,
      showOverlay: true,
      content: Dialog,
      contentProps: {
        title: 'Segment Color',
        value: { rgbaColor },
        noCloseButton: true,
        onClose: () => service.dismiss({ id }),
        actions: [
          { id: 'cancel', text: 'Cancel', type: 'primary' },
          { id: 'save', text: 'Save', type: 'secondary' },
        ],
        onSubmit: onSubmitHandler,
        body: ({ value, setValue }) => {
          const handleChange = color => {
            setValue({ rgbaColor: color.rgb });
          };

          return (
            <ChromePicker
              color={value.rgbaColor}
              onChange={handleChange}
              presetColors={[]}
              width={300}
            />
          );
        },
      },
    });
  }
};

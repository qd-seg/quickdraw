import * as React from 'react';
import { ChromePicker } from 'react-color';
import { Dialog } from '@ohif/ui';

import './ColorPickerDialog.css';

export default (service, current, callback) => {
  const id = 'pick-color';

  const onSubmitHandler = ({ action, value }) => {
    switch (action.id) {
      case 'save':
        callback(value.updated, action.id);
        break;
      case 'cancel':
        callback('', action.id);
        break;
    }

    service.dismiss({ id });
  };

  if (service === undefined) return;

  service.create({
    id,
    centralize: true,
    isDraggable: false,
    showOverlay: true,
    content: Dialog,
    contentProps: {
      title: 'Segment Color',
      value: { current },
      noCloseButton: true,
      onClose: () => service.dismiss({ id }),
      actions: [
        { id: 'cancel', text: 'Cancel', type: 'primary' },
        { id: 'save', text: 'Save', type: 'secondary' },
      ],
      onSubmit: onSubmitHandler,
      body: ({ value, setValue }) => {
        const handleChange = color => setValue({ updated: color.rgb });

        return (
          <ChromePicker
            color={value.current}
            onChange={handleChange}
            presetColors={[]}
            width={300}
          />
        );
      },
    },
  });
};

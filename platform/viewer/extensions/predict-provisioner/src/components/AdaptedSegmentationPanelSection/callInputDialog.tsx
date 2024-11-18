import * as React from 'react';
import { Input, Dialog, ButtonEnums } from '@ohif/ui';

export default (service, label, callback) => {
  const id = 'enter-segment-label';

  const onSubmitHandler = ({ action, value }) => {
    switch (action.id) {
      case 'save':
        callback(value.label, action.id);
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
        title: 'Segment',
        value: { label },
        noCloseButton: true,
        onClose: () => service.dismiss({ id }),
        actions: [
          { id: 'cancel', text: 'Cancel', type: ButtonEnums.type.secondary },
          { id: 'save', text: 'Confirm', type: ButtonEnums.type.primary },
        ],
        onSubmit: onSubmitHandler,
        body: ({ value, setValue }) => {
          return (
            <Input
              label="Enter the segment label"
              labelClassName="text-white text-[14px] leading-[1.2]"
              autoFocus
              className="border-primary-main bg-black"
              type="text"
              value={value.label}
              onChange={event => {
                event.persist();
                setValue(value => ({ ...value, label: event.target.value }));
              }}
              onKeyPress={event => {
                if (event.key === 'Enter') onSubmitHandler({ value, action: { id: 'save' } });
              }}
            />
          );
        },
      },
    });
  }
};

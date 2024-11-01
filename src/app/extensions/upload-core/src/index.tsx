import * as React from 'react';

import { id } from './id';
import UploadPanel from './components/UploadPanel';

const extension = {
  id,

  getPanelModule: ({ servicesManager, commandsManager }) => {
    return [
      {
        name: 'upload',
        iconName: 'logo-ohif-small',
        iconLabel: 'Upload',
        label: 'Upload',
        component: () => {
          return (
            <UploadPanel servicesManager={servicesManager} commandsManager={commandsManager} />
          );
        },
      },
    ];
  },
};

export default extension;

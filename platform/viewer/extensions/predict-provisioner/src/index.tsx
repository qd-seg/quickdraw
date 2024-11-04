import * as React from 'react';

import { id } from './id';
import PredictionPanel from './components/PredictionPanel';

const extension = {
  id,

  getPanelModule: ({ servicesManager, commandsManager, extensionManager }) => {
    return [
      {
        name: 'predict',
        iconName: 'logo-ohif-small',
        iconLabel: 'Upload',
        label: 'Predict',
        component: () => {
          return (
            <PredictionPanel servicesManager={servicesManager} commandsManager={commandsManager} extensionManager={extensionManager}/>
          );
        },
      },
    ];
  },
};

export default extension;

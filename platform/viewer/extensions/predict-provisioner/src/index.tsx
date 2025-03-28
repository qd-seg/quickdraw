import * as React from 'react';

import { id } from './id';
import AnalysisPanel from './components/AnalysisPanel';

export default {
  id,

  getPanelModule: ({ servicesManager, extensionManager, commandsManager }) => {
    return [
      {
        name: 'predict',
        iconName: 'logo-ohif-small',
        iconLabel: 'Upload',
        label: 'Predict',
        component: () => (
          <AnalysisPanel
            servicesManager={servicesManager}
            extensionManager={extensionManager}
            commandsManager={commandsManager}
          />
        ),
      },
    ];
  },
};

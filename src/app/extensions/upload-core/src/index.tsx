import React from 'react';
import { Types } from '@ohif/core';
import { id } from './id';
import UploadPanel from './components/UploadPanel';

const uploadCoreExtension: Types.Extensions.Extension = {
  id,
  preRegistration: ({ servicesManager, commandsManager, configuration = {} }) => {},
  getPanelModule: ({ servicesManager, commandsManager, extensionManager }) => {
    return [
      {
        name: 'upload',
        iconName: 'logo-ohif-small',
        iconLabel: 'Upload',
        label: 'Upload',
        // Create a component wrapper to inject the segmentation ID as a prop
        component: () => {
            return <UploadPanel 
              servicesManager={servicesManager} 
              commandsManager={commandsManager}
              />;
        }
      }
    ];
  },
}
export default uploadCoreExtension;

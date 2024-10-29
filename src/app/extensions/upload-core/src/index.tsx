import { id } from './id';
import UploadPanel from './components/UploadPanel';

export default {
  id,

  getPanelModule: () => {
    return [
      {
        name: 'upload',
        iconName: 'logo-ohif-small',
        iconLabel: 'Upload',
        label: 'Upload',
        component: UploadPanel,
      },
    ];
  },
};

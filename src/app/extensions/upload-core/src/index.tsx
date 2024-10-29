import { id } from './id';
import UploadButton from './components/UploadButton';

export default {
  id,

  getPanelModule: () => {
    return [
      {
        name: 'upload',
        iconName: 'logo-ohif-small',
        iconLabel: 'Upload',
        label: 'Upload',
        component: UploadButton,
      },
    ];
  },
};

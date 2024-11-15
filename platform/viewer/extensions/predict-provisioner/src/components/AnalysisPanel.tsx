import * as React from 'react';

import ModelRelationPanelSection from './ModelRelationPanelSection';

export default ({ servicesManager }) => {
  const [status, setStatus] = React.useState({
    uploading: false,
    deleting: false,
    predicting: false,
    authenticating: false,
    loading: false,
    calculating: false,
  });

  return (
    <div>
      <ModelRelationPanelSection
        status={status}
        setStatus={setStatus}
        servicesManager={servicesManager}
      />
    </div>
  );
};

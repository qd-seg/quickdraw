import * as React from 'react';

import { ProgressLoadingBar } from '@ohif/ui';

import ModelRelationPanelSection from './ModelRelationPanelSection';
import PredictionAnalysisPanelSection from './PredictionAnalysisPanelSection';

export default ({ servicesManager }) => {
  const [progress, setProgress] = React.useState<number | undefined>(0);
  const [status, setStatus] = React.useState<Record<string, boolean>>({
    uploading: false,
    deleting: false,
    predicting: false,
    authenticating: false,
    loading: false,
    calculating: false,
  });

  const isProcessing = () => !Object.values(status).every(x => x === false);

  React.useEffect(() => {
    isProcessing() ? setProgress(undefined) : setProgress(0);
  }, [status]);

  return (
    <div>
      <ProgressLoadingBar progress={progress} />

      <ModelRelationPanelSection
        status={status}
        setStatus={setStatus}
        servicesManager={servicesManager}
      />

      <PredictionAnalysisPanelSection
        status={status}
        setStatus={setStatus}
        servicesManager={servicesManager}
      />
    </div>
  );
};

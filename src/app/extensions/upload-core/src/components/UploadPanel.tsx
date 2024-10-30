import * as React from 'react';

import { Button, PanelSection, ProgressLoadingBar } from '@ohif/ui';

import { Timestamp } from 'firebase/firestore';

interface Document {
  id: string;
  date?: Timestamp;
  description?: string;

  [key: string]: any;
}

const labelStyle = {
  display: 'inline-block',
  padding: '5px',
  borderRadius: '5px',
  cursor: 'pointer',
};

const checkedLabelStyle = {
  ...labelStyle,
  backgroundColor: '#0844b3',
  color: '#fff',
};

const UploadButton: React.FunctionComponent = ({ servicesManager, commandsManager }) => {
  const [message, setMessage] = React.useState('');
  const [progress, setProgress] = React.useState(0);
  const [counter, setCounter] = React.useState(0);

  const [containers, setContainers] = React.useState<[string, boolean][]>([]);
  const [documents, setDocuments] = React.useState<Document[]>([]);

  const [model, setModel] = React.useState(undefined);

  const [status, setStatus] = React.useState({
    uploading: false,
    deleting: false,
    predicting: false,
    authenticating: false,
  });
  const segmentationService = servicesManager.services.segmentationService;

  const isActive = () => {
    return status.uploading || status.deleting || status.predicting || status.authenticating;
  };

  // // SEGMENTATION_UPDATED event listener: echang
  // this is the event listener for the SEGMENTATION_UPDATED event
  // it will be triggered whenever a segmentation is updated
  // useEffect(() => {
  //     if (!segmentationService) return;
  
  //     // Define the event handler for segmentation updates
  //     const handleSegmentationUpdate = () => {
  //         const activeSegmentation = segmentationService.getActiveSegmentation();
  //         const activeSegmentationID = activeSegmentation ? activeSegmentation.id : null;
  //         setActiveSegmentationID(activeSegmentationID);
  //         console.log('SEGMENTATION_UPDATED event fired. Active segmentation ID:', activeSegmentationID);
  //     };
  
  //     // Subscribe to the SEGMENTATION_UPDATED event
  //     segmentationService.subscribe(segmentationService.EVENTS.SEGMENTATION_UPDATED, handleSegmentationUpdate);
  
  //     // Cleanup: Unsubscribe when component unmounts
  //     return () => {
  //       segmentationService.unsubscribe(segmentationService.EVENTS.SEGMENTATION_UPDATED, handleSegmentationUpdate);
  //     };
  //   }, [segmentationService]);

  const authenticateUser = async () => {
    setStatus({ ...status, authenticating: true });

    try {
      await fetch('/api/authenticate', { method: 'POST' });
    } catch (error) {
      setMessage('Unable to Authenticate');

      console.error('Error:', error);
    } finally {
      setStatus({ ...status, authenticating: false });
    }
  };

  const isInstanceAvailable = async () => {
    try {
      await fetch('/api/instances/available', { method: 'POST' });
    } catch (error) {
      setMessage('Unable to Authenticate');

      console.error('Error:', error);
    }
  };

  const updateContainers = async () => {
    try {
      const response = await fetch('/api/instances/running', { method: 'POST' });
      const data = await response.json();

      setContainers(data.containers);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const uploadInstance = async () => {
    setStatus({ ...status, uploading: true });

    const url = new URL(window.location.href);
    const UIDs = url.searchParams.get('StudyInstanceUIDs');
    const firstUID = UIDs.split(/[^\d.]+/)[0];

    try {
      await fetch('/api/instances/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstUID }),
      });
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setStatus({ ...status, uploading: false });

      updateContainers();
    }
  };

  const runPrediction = async () => {
    setStatus({ ...status, predicting: true });

    try {
      await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectedModel: model }),
      });
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setStatus({ ...status, deleting: false });

      setCounter(counter + 1);
    }
  };

  const deleteInstance = async () => {
    setStatus({ ...status, deleting: true });

    try {
      await fetch('/api/instances/delete', { method: 'POST' });
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setStatus({ ...status, deleting: false });

      updateContainers();
    }
  };

  /* TODO: */
  const updateDocuments = async () => {
    try {
    } catch (error) {
      console.error('Error:', error);
    }
  };

  React.useEffect(() => authenticateUser() as undefined, []);
  React.useEffect(() => isInstanceAvailable() as undefined, []);
  React.useEffect(() => updateContainers() as undefined, []);
  React.useEffect(() => updateDocuments() as undefined, []);

  return (
    <div style={{ margin: '2px' }}>
      <div className="w-full text-center text-white">
        <h1 className="text-common-light mr-3 text-lg">Administrative Page:</h1>
        <Button onClick={() => window.open('/dashboard', '_blank')}>Model Management Page</Button>
        <br />
        <br />
      </div>

      <PanelSection title="Prediction Panel">
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'left',
            justifyContent: 'center',
            fontSize: '13px',
            margin: '5px',
          }}
        >
          <br />
          <Button
            onClick={uploadInstance}
            children={status.uploading ? 'Uploading...' : 'Upload Images to Server'}
            disabled={isActive()}
          />

          <br />
          <Button
            onClick={runPrediction}
            children={status.deleting ? 'Running Prediction...' : 'Run Prediction'}
            disabled={isActive()}
          />

          <br />
          <Button
            onClick={deleteInstance}
            children={status.deleting ? 'Deleting...' : 'Delete Current Instance'}
            disabled={isActive()}
          />

          <br />
          <Button
            onClick={() => {
              // use segmentationService to get the id of the active segmentation
              const activeID = segmentationService.getActiveSegmentation()?.id;
              console.log('Active Segmentation:', activeID);

              // downloads to local downloads folder by calling downloadSegmentation command through commandsManager
              commandsManager.runCommand('downloadSegmentation', {
                  segmentationId: activeID,
                });

            }}
            children={status.uploading ? 'Saving...' : 'Save Modified Mask'}
            disabled={isActive()}
          />

          <br />
          <Button onClick={updateContainers} children="Refresh Containers" disabled={isActive()} />

          {progress > 0 && <ProgressLoadingBar progress={progress} />}

          <div style={{ color: '#90cdf4', margin: '5px' }}>
            <p>{message}</p>
          </div>
        </div>
      </PanelSection>

      <br />
      <div className="w-full text-center text-white">
        <PanelSection title={'Models'}>
          <div style={{ maxHeight: '250px', overflowY: 'auto', fontSize: '13px' }}>
            {documents.map((document, index) => (
              <div
                key={index}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  margin: '3px',
                  borderBottom: '1px solid #3a3f99',
                }}
              >
                <div
                  style={{
                    width: '70%',
                    padding: '5px',
                  }}
                >
                  <label style={model === document.id ? checkedLabelStyle : labelStyle}>
                    <input
                      type="radio"
                      value={document.id}
                      checked={model === document.id}
                      onChange={() => setModel(document.id)}
                    />
                    {document.id}
                  </label>
                </div>
                <button
                  onClick={() => {
                    alert(
                      `Description: ${document.description}\nDate Uploaded: ${document.dateUploaded
                        .toDate()
                        .toLocaleDateString()}`
                    );
                  }}
                  style={{
                    backgroundColor: '#041c4a',
                    alignSelf: 'flex-end',
                    borderRadius: '3px',
                    padding: '5px',
                    color: 'lightgray',
                  }}
                >
                  Info
                </button>
              </div>
            ))}
          </div>
        </PanelSection>
        <br />
        {model && (
          <div>
            <h2>Selected Model:</h2>
            <p>{model}</p>
          </div>
        )}
      </div>

      <div
        style={{
          marginTop: '1em',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
        }}
      >
        <h5>Running Containers</h5>
        <div style={{ marginTop: '1em', width: '100%', textAlign: 'center' }}>
          {containers &&
            containers.map(([name, isActive], index) => (
              <div
                key={index}
                style={{
                  padding: '10px',
                  backgroundColor: isActive ? '#68d391' : '#e2e8f0',
                  marginBottom: '5px',
                  color: 'black',
                }}
              >
                {isActive ? `${name} (Your Container)` : name}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};

export default UploadButton;

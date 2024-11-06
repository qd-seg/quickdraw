import * as React from 'react';
import { Button, PanelSection, ProgressLoadingBar } from '@ohif/ui';
import { createReportAsync } from '@ohif/extension-default';
import { DicomMetadataStore } from '@ohif/core';

// import { Timestamp } from 'firebase/firestore';
import io from 'socket.io-client';
import { MoonLoader, BeatLoader } from 'react-spinners';

// interface Document {
//     id: string;
//     date?: Timestamp;
//     description?: string;

//     [key: string]: any;
// }

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

// NOTE: this is a placeholder for dev
// const urlPrefix = 'http://localhost:5421';
const urlPrefix = '';

const UploadPanel = ({ servicesManager, commandsManager, extensionManager }) => {
    const [message, setMessage] = React.useState('');
    const [progress, setProgress] = React.useState(0);
    const [progressBarText, setProgressBarText] = React.useState('');
    const [counter, setCounter] = React.useState(0);

    const [containers, setContainers] = React.useState<[string, boolean][]>([]);
    // const [documents, setDocuments] = React.useState<Document[]>([]);

    const [selectedModelIndex, setSelectedModelIndex] = React.useState<number | undefined>(undefined);
    const [allModels, setAllModels] = React.useState<any[]>([]);

    const [selectedMaskIndex, setSelectedMaskIndex] = React.useState<number | undefined>(undefined);
    const [allMasks, setAllMasks] = React.useState<any[]>([]);

    const [status, setStatus] = React.useState({
        uploading: false,
        deleting: false,
        predicting: false,
        authenticating: false,
        loadingModels: false,
        loadingMasks: false,
    });

    const isActive = () => {
        return status.uploading || status.deleting || status.predicting || status.authenticating;
    };

    const canRunPrediction = () => {
        return (selectedModelIndex !== undefined) && !isActive();
    };

    // const isModelRunning: (modelIndex: number) => Promise<boolean> = (modelIndex) => {
    //     return fetch(`${urlPrefix}/api/isModelRunning`)
    //         .then(res => res.json())
    //         .then(data => data?.running)
    //         .catch((err) => {
    //             console.error(err);
    //         });
    // };

    const segmentationService = servicesManager.services.segmentationService;

    // This function exports the active segmentation and exports it to Orthanc. This is used for saving the modified mask. 
    async function ExportAndSaveMask() {
        try {
            // Use segmentationService to get the ID of the active segmentation
            const activeID = segmentationService.getActiveSegmentation()?.id;
            if (!activeID) {
                console.warn('No active segmentation found.');
                return;
            }
            console.log('Active Segmentation:', activeID);
    
            // Retrieve active data sources from the extension manager
            if (!extensionManager) {
                console.error('Extension manager not found.');
                return;
            }
            const datasources = extensionManager.getActiveDataSource();
            if (!datasources.length) {
                console.error('No active data sources found.');
                return;
            }
            console.log('Active DataSource:', datasources);
    
            // Create report and retrieve displaySetInstanceUIDs
            const displaySetInstanceUIDs = await createReportAsync({
                servicesManager,
                getReport: () =>
                    commandsManager.runCommand('storeSegmentation', {
                        segmentationId: activeID,
                        dataSource: datasources[0],
                    }),
                reportType: 'Segmentation',
            });
    
            if (!displaySetInstanceUIDs) {
                console.error('Failed to obtain displaySetInstanceUIDs.');
                return;
            }
    
            // Remove the exported segmentation and set the viewport display sets
            const viewportGridService = servicesManager.services.viewportGridService;
            
            segmentationService.remove(activeID);
            viewportGridService.setDisplaySetsForViewport({
                viewportId: viewportGridService.getActiveViewportId(),
                displaySetInstanceUIDs,
            });
            console.log('DisplaySets updated:', displaySetInstanceUIDs);
            console.log('Segmentation saved and viewport updated.');
    
          } catch (error) {
              console.error('Error in ExportAndSaveMask:', error);
          }
      };
      
    // This function gets the IDs of the current image on the screen that corresponds to Orthanc IDs. 
    // Will return a JSON object with: {is_default_study: bool,patient_id: str, study_id: str, series_id: str}
    function GetCurrentDisplayIDs() {
        try {
            // get services
            const viewportGridService = servicesManager.services.viewportGridService;
            const displaySetService = servicesManager.services.displaySetService;
            const activeViewportId = viewportGridService.getActiveViewportId()

            // get active displaySets
            const displaySets= displaySetService.getActiveDisplaySets();
            const currentViewportDisplaySetUID = viewportGridService.getDisplaySetsUIDsForViewport(activeViewportId)[0];

            // search for displaySetInstanceUID = currentViewportDisplaySetUID in displaySets array
            const currentDisplaySet = displaySets.find(displaySet => displaySet.displaySetInstanceUID === currentViewportDisplaySetUID);

            const currentStudyInstanceUID = currentDisplaySet?.StudyInstanceUID;        // get current Study Instance ID
            const study = DicomMetadataStore.getStudy(currentStudyInstanceUID);

            const currentPatientUID = study?.series[0].PatientID;                                // get current Patient ID
            const currentSeriesInstanceUID = currentDisplaySet?.SeriesInstanceUID;      // try getting current Series Instance ID
            const currentSopInstanceUID = currentDisplaySet?.SOPInstanceUID;
            
            // OHIF does something weird where if you don't have the segmentation loaded, you will get the correct Series Instance ID, but once you load the segmentation, it displays a "CT scan" instead of the actual seg
            // So, if the currentSeriesInstanceUID is undefined or SOPInstanceUID is undefined, we need to get the SeriesInstanceUID from the loaded segmentation
            if (!currentSeriesInstanceUID || !currentSopInstanceUID) {  
                const uid = currentDisplaySet?.getUID();                                // get uid from loaded segmentation

                // search for referencedVolumeURI in unloaded displaySets and get the referenced displaySet
                const referencedDisplaySet = displaySets.find(displaySet => displaySet.referencedVolumeURI === uid); 
                
                // if there are no display sets that include the referencedVolumeURI, then it is a default study / default screen with no segmentations. This is the one we should use for model predictions. 
                if (!referencedDisplaySet) {
                    return JSON.stringify({ is_default_study: true, patient_id: currentPatientUID, study_id: currentStudyInstanceUID, series_id: currentSeriesInstanceUID });

                // if there is a display set that includes referencedVolumeURI, then we are looking at a CT scan with a segmentation loaded. We need to get the SeriesInstanceUID from the loaded segmentation. 
                } else {
                    // get the seriesInstanceUID and SOPInstanceUID from the referenced displaySet
                    const newSeriesInstanceUID = referencedDisplaySet?.SeriesInstanceUID;
                    // const newSopInstanceUID = referencedDisplaySet?.SOPInstanceUID;
                    return JSON.stringify({ is_default_study: false, patient_id: currentPatientUID, study_id: currentStudyInstanceUID, series_id: newSeriesInstanceUID });
                }
            
            // This is the case where we have a segmentation viewed, but not loaded. This will return the correct SeriesInstanceUID.  
            } else {
                
                return JSON.stringify({ is_default_study: false, patient_id: currentPatientUID, study_id: currentStudyInstanceUID, series_id: currentSeriesInstanceUID });
            }

        } catch (error) {
            console.error('Error in GetCurrentDisplayIDs:', error);
        }
    };

    // This function gets the list of segmentations that are currently loaded in the viewer that could possibly be ground truth masks. Returns a JSON with {seriesInstanceUID: str, seriesDescription: str}
    const GetListMasks = () => {
        try {
            // get services
            const viewportGridService = servicesManager.services.viewportGridService;
            const displaySetService = servicesManager.services.displaySetService;
            const activeViewportId = viewportGridService.getActiveViewportId()

            // get active displaySets
            const displaySets = displaySetService.getActiveDisplaySets();
            
            // get all displaySets that are segmentations, either Modality: SEG or Modality: RTSTRUCT
            const segmentations = displaySets.filter(displaySet => displaySet.Modality === 'SEG' || displaySet.Modality === 'RTSTRUCT');
            
            // get seriesInstanceUIDs of the segmentations and their corresponding SeriesDescription
            const segmentationSeries = segmentations.map(displaySet => ({
                seriesInstanceUID: displaySet.SeriesInstanceUID,
                seriesDescription: displaySet.SeriesDescription,
            }));

            // add an undefined option to the list
            segmentationSeries.unshift({ seriesInstanceUID: undefined, seriesDescription: 'None' });
            
            setAllMasks(segmentationSeries);

        } catch (error) {
            console.error('Error in getListMasks:', error);
        }
    };

    // const authenticateUser = async () => {
    //     setStatus({ ...status, authenticating: true });

    //     try {
    //         await fetch('/api/authenticate', { method: 'POST' });
    //     } catch (error) {
    //         setMessage('Unable to Authenticate');

    //         console.error('Error:', error);
    //     } finally {
    //         setStatus({ ...status, authenticating: false });
    //     }
    // };

    // const isInstanceAvailable = async () => {
    //     try {
    //         await fetch('/api/instances/available', { method: 'POST' });
    //     } catch (error) {
    //         setMessage('Unable to Authenticate');

    //         console.error('Error:', error);
    //     }
    // };

    // const updateContainers = async () => {
    //     try {
    //         const response = await fetch('/api/instances/running', { method: 'POST' });
    //         const data = await response.json();

    //         setContainers(data.containers);
    //     } catch (error) {
    //         console.error('Error:', error);
    //     }
    // };

    // const uploadInstance = async () => {
    //     setStatus({ ...status, uploading: true });

    //     const url = new URL(window.location.href);
    //     const UIDs = url.searchParams.get('StudyInstanceUIDs');
    //     const firstUID = UIDs.split(/[^\d.]+/)[0];

    //     try {
    //         await fetch('/api/instances/upload', {
    //             method: 'POST',
    //             headers: { 'Content-Type': 'application/json' },
    //             body: JSON.stringify({ firstUID }),
    //         });
    //     } catch (error) {
    //         console.error('Error:', error);
    //     } finally {
    //         setStatus({ ...status, uploading: false });

    //         updateContainers();
    //     }
    // };

    // TODO: handling user going back during a prediction job. Should have useeffect: check for running jobs
    const runPrediction = async () => {
        if (selectedModelIndex === undefined) {
            alert('Please select a model');
            return;
        };

        setProgress(0);
        setProgressBarText('...');
        setStatus({ ...status, predicting: true });

        try {
            // Note: the localhost routes are temporary until we fix the issue of routes on development not working
            await fetch(`${urlPrefix}/api/setupComputeWithModel`, {
                // await fetch('http://localhost:5421/api/setupComputeWithModel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ selectedModel: allModels[selectedModelIndex]?.name }), // TODO
            })
            await fetch(`${urlPrefix}/api/run`, {
                // await fetch('http://localhost:5421/api/run', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ selectedModel: allModels[selectedModelIndex]?.name, selectedDicomSeries: 'PANCREAS_0005' }), // TODO: PLACEHOLDER
            });
        } catch (error) {
            console.error('Error:', error);
            setProgress(0);
        } finally {
            setStatus({ ...status, predicting: false, deleting: false });
            setProgress(0);
            setProgressBarText('');
            setCounter(counter + 1);
        }
    };

    const CalculateDiceScore = async () => {
        try{
            const currentScreenIDs = GetCurrentDisplayIDs();

            if (currentScreenIDs) {
                // parse json received from GetCurrentDisplayIDs
                const { is_default_study, patient_id, study_id, series_id } = JSON.parse(currentScreenIDs);
                // check if the current screen is a default screen with no segmentations loaded
                if (is_default_study == true) {
                    alert('No segmentation loaded');
                    return;
                }

                // at this point, the current screen should have a segmentation. 

                // get the ground truth mask that the user selected
                const currentGroundTruth = allMasks[selectedMaskIndex];
                
                if (!currentGroundTruth || currentGroundTruth.seriesInstanceUID === undefined) {
                    alert('Please select a ground truth mask');
                    return;

                } else {
                    // both segmentation and ground truth should be present at this point -> reconstruct JSON strings
                    const groundTruthJSON ={ patient_id: patient_id, study_id: study_id, seriesInstanceUID: currentGroundTruth.seriesInstanceUID };
                    const currMaskJSON = { patient_id: patient_id, study_id: study_id, seriesInstanceUID: series_id };


                    console.log("Ground Truth:", groundTruthJSON);
                    console.log("Segmentation:", currMaskJSON);
                    
                    fetch(`${urlPrefix}/api/calculateDiceScore`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(
                            {currentMask: currMaskJSON, groundTruth: groundTruthJSON}),
                    })
                    .then(res => res.json())
                    .then((value) => {
                        console.log(value);
                        alert(`Dice Score: ${value.diceScore}`);
                    })
                    .catch((err) => {
                        console.error(err);
                    });
                }
            } else {
                console.error('Error in GetCurrentDisplayIDs');
                
            }
        }
        catch (err){
            console.error('Error in CalculateDiceScore', err);
        }
    };
    // const deleteInstance = async () => {
    //     setStatus({ ...status, deleting: true });

    //     try {
    //         await fetch('/api/instances/delete', { method: 'POST' });
    //     } catch (error) {
    //         console.error('Error:', error);
    //     } finally {
    //         setStatus({ ...status, deleting: false });

    //         updateContainers();
    //     }
    // };

    /* TODO: */
    // const updateDocuments = async () => {
    //     try {
    //     } catch (error) {
    //         console.error('Error:', error);
    //     }
    // };

    const listModels = () => {
        setStatus({ ...status, loadingModels: true });
        // fetch('http://localhost:5421/api/listModels')
        fetch(`${urlPrefix}/api/listModels`)
            .then(res => res.json())
            .then((value) => {
                console.log(value);
                setAllModels(value.models);
                setSelectedModelIndex(undefined);
            })
            .catch((err) => {
                console.error(err);
            })
            .finally(() => {
                console.log('status');
                console.log(status);
                setStatus({ ...status, loadingModels: false });
            });
    };

    // React.useEffect(() => {
    //     authenticateUser();
    // }, []);

    // React.useEffect(() => {
    //     isInstanceAvailable();
    // }, []);

    // React.useEffect(() => {
    //     updateContainers();
    // }, []);

    // React.useEffect(() => {
    //     updateDocuments();
    // }, []);

    React.useEffect(() => {
        listModels();
    }, []);

    // Set up socket for progress updates
    React.useEffect(() => {
        console.log('Init socket')
        const sock = io(`${urlPrefix}`, { path: '/api/socket.io' });

        sock.on('progress_update', (data) => {
            console.log('progress');
            console.log(data);
            setProgress(data?.value || 0);
        });

        sock.on('status_update', (data) => {
            // console.log(data);
            if (data?.message) {
                // alert(data.message);
                setProgressBarText(data.message);
            }
        });

        sock.on('model_instances_update', (data) => {
            console.log('update instances !')
            listModels();
        });

        return () => {
            console.log('Disconnecting socket')
            setProgress(0);
            setProgressBarText('');
            sock.disconnect();
        }
    }, []);

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
                    {/* <br />
                    <Button
                        onClick={uploadInstance}
                        children={status.uploading ? 'Uploading...' : 'Upload Images to Server'}
                        disabled={isActive()}
                    /> */}

                    <br />

                    {selectedModelIndex === undefined && <span className='text-white text-sm text-center w-100' style={{ marginTop: '-18px' }}>No model selected</span>}
                    <Button
                        onClick={runPrediction}
                        children={status.predicting ? 'Running Prediction...' : 'Run Prediction'}
                        disabled={!canRunPrediction()}
                        startIcon={status.predicting ?
                            <MoonLoader size={16} color={'#eee'} /> : <></>
                        }
                    />
                    {(status.predicting && progress > 0) &&
                        <div>
                            {progressBarText && <div className='w-full text-center text-white'>{progressBarText}</div>}
                            <ProgressLoadingBar progress={progress} />
                        </div>}

                    {/* <br />
                    <Button
                        onClick={deleteInstance}
                        children={status.deleting ? 'Deleting...' : 'Delete Current Instance'}
                        disabled={isActive()}
                    /> */}
                    <br />
                    <Button
                        onClick={() => {
                            console.log(GetCurrentDisplayIDs());
                        }}
                        children={status.uploading ? 'Getting SeriesInstanceID...' : 'Get SeriesInstanceID'}
                        disabled={isActive()}
                    />
                    <br />

                    <Button
                        onClick={() => {
                            CalculateDiceScore();
                        }}
                        children={status.uploading ? 'Calculating DICE Score...' : 'Calculate DICE Score'}
                        disabled={isActive()}
                    />
                    <br />
                    <Button
                        onClick={() => {
                            ExportAndSaveMask();
                        }}
                        children={status.uploading ? 'Saving...' : 'Save Modified Mask'}
                        disabled={isActive()}
                    />

                    <br />
                    {/* <Button onClick={() => { fetch(`${urlPrefix}/api/testSocket`) }} children="Test Progress Bar" disabled={isActive()} /> */}


                    <div style={{ color: '#90cdf4', margin: '5px' }}>
                        <p>{message}</p>
                    </div>
                </div>
            </PanelSection>

            <br />
            <div className="w-full text-center text-white">
                <PanelSection title={'Models'}>
                    <Button
                        onClick={listModels}
                        children={'Refresh Model List'}
                        disabled={status.loadingModels}
                        startIcon={status.loadingModels ?
                            <MoonLoader size={16} color={'#eee'} /> : <></>
                        } />
                    <div style={{ maxHeight: '250px', overflowY: 'auto', fontSize: '13px' }}>
                        {allModels.map((model, index) => (
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
                                    <label style={selectedModelIndex === index ? checkedLabelStyle : labelStyle}>
                                        <input
                                            type="radio"
                                            value={model.name}
                                            checked={selectedModelIndex === index}
                                            onChange={() => setSelectedModelIndex(index)}
                                            disabled={!!model.running}
                                        />

                                        <span>
                                            {model.name}
                                        </span>
                                        {model.running &&
                                            <span className='text-sm'>
                                                <span className='ml-3 mr-1' style={{ color: '#ddd' }}>
                                                    - In use
                                                </span>
                                                <BeatLoader size={4} margin={1} color={'#eee'} />
                                            </span>}
                                    </label>
                                </div>
                                <button
                                    onClick={() => {
                                        alert(
                                            `Date Uploaded: ${model.updateTime}`
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
                {(selectedModelIndex !== undefined) && (
                    <div>
                        <h2>Selected Model:</h2>
                        <p>{allModels[selectedModelIndex].name}</p>
                    </div>
                )}
            </div>

            <div className="w-full text-center text-white">
                <PanelSection title="Ground Truth Mask Selection">
                    <Button
                        onClick={() => {
                            setStatus({ ...status, loadingMasks: true });
                            GetListMasks();
                            setStatus({ ...status, loadingMasks: false });
                        }}
                        children={status.loadingMasks ? 'Refreshing masks...' : 'Refresh Masks'}
                        disabled={isActive()}
                    />
                    {allMasks.length > 0 && (
                        <div style={{ marginTop: '10px', width: '100%' }}>
                            <h5>Select a Ground Truth Mask:</h5>
                            <select
                                value={selectedMaskIndex}
                                onChange={(e) => setSelectedMaskIndex(Number(e.target.value))}
                                style={{
                                    padding: '10px',
                                    backgroundColor: '#e2e8f0',
                                    color: 'black',
                                    width: '100%',
                                }}
                            >
                                {allMasks.map((mask, index) => (
                                    <option key={index} value={index}>
                                        {mask.seriesDescription}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                </PanelSection>
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
                {/* <h5>Running Containers</h5>
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
                </div> */}
            </div>
        </div>
    );
};

export default UploadPanel;

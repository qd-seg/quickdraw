import * as React from 'react';
import { createReportAsync } from '@ohif/extension-default';
import { useAppConfig } from '@state';

import callInputDialog from './callInputDialog';
import callColorPickerDialog from './callColorPickerDialog';
import AdaptedSegmentationGroupTable from '../AdaptedSegmentationGroupTable';

export default function PanelSegmentation({
  analysis,
  servicesManager,
  commandsManager,
  extensionManager,
}) {
  const [appConfig] = useAppConfig();
  const { customizationService } = servicesManager.services;
  const configuration = {
    disableEditing: appConfig.disableEditing,
    ...customizationService.get('segmentation.panel'),
  };

  const {
    segmentationService,
    viewportGridService,
    uiDialogService,
    displaySetService,
    cornerstoneViewportService,
  } = servicesManager.services;

  const [selectedSegmentationId, setSelectedSegmentationId] = React.useState(null);
  const [addSegmentationClassName, setAddSegmentationClassName] = React.useState('');
  const [segmentationConfiguration, setSegmentationConfiguration] = React.useState(
    segmentationService.getConfiguration()
  );
  const [segmentations, setSegmentations] = React.useState(() =>
    segmentationService.getSegmentations()
  );

  React.useEffect(() => {
    const segmentationAddedEvent = segmentationService.EVENTS.SEGMENTATION_ADDED;
    const segmentationUpdatedEvent = segmentationService.EVENTS.SEGMENTATION_UPDATED;
    const segmentationRemovedEvent = segmentationService.EVENTS.SEGMENTATION_REMOVED;

    const subscriptions: any[] = [];

    [segmentationAddedEvent, segmentationUpdatedEvent, segmentationRemovedEvent].forEach(e => {
      const { unsubscribe } = segmentationService.subscribe(e, () => {
        const segmentations = segmentationService.getSegmentations();
        setSegmentations(segmentations);
        setSegmentationConfiguration(segmentationService.getConfiguration());
      });

      subscriptions.push(unsubscribe);
    });

    return () => subscriptions.forEach(unsub => unsub());
  }, []);

  React.useEffect(() => {
    const handleActiveViewportChange = viewportId => {
      const displaySetUIDs = viewportGridService.getDisplaySetsUIDsForViewport(
        viewportId || viewportGridService.getActiveViewportId()
      );

      if (!displaySetUIDs) return;

      const isReconstructable =
        displaySetUIDs?.some(displaySetUID => {
          const displaySet = displaySetService.getDisplaySetByUID(displaySetUID);
          return displaySet?.isReconstructable;
        }) || false;

      if (isReconstructable) setAddSegmentationClassName('');
      else setAddSegmentationClassName('ohif-disabled');
    };

    handleActiveViewportChange(undefined);

    const activeViewportChangedEvent = viewportGridService.EVENTS.ACTIVE_VIEWPORT_ID_CHANGED;
    const viewportsReadyEvent = viewportGridService.EVENTS.VIEWPORTS_READY;

    const gridSubscriptions: any[] = [];

    [activeViewportChangedEvent, viewportsReadyEvent].forEach(e => {
      const { unsubscribe } = viewportGridService.subscribe(e, ({ viewportId }) => {
        handleActiveViewportChange(viewportId);
      });

      gridSubscriptions.push(unsubscribe);
    });

    const viewportDataChangedEvent = cornerstoneViewportService.EVENTS.VIEWPORT_DATA_CHANGED;

    const dataSubscriptions: any[] = [];

    [viewportDataChangedEvent].forEach(e => {
      const { unsubscribe } = cornerstoneViewportService.subscribe(e, () => {
        handleActiveViewportChange(undefined);
      });

      dataSubscriptions.push(unsubscribe);
    });

    return () => {
      gridSubscriptions.forEach(unsubscribe => unsubscribe());
      dataSubscriptions.forEach(unsubscribe => unsubscribe());
    };
  }, []);

  const getToolGroupIDs = segmentationUID => {
    const toolGroupIDs = segmentationService.getToolGroupIdsWithSegmentation(segmentationUID);

    return toolGroupIDs;
  };

  const onSegmentationAdd = async () => {
    commandsManager.runCommand('createEmptySegmentationForViewport', {
      viewportId: viewportGridService.getActiveViewportId(),
    });
  };

  const onSegmentationClick = (segmentationUID: string) => {
    segmentationService.setActiveSegmentationForToolGroup(segmentationUID);
  };

  const onSegmentationDelete = (segmentationUID: string) => {
    segmentationService.remove(segmentationUID);
  };

  const onSegmentAdd = segmentationUID => {
    segmentationService.addSegment(segmentationUID);
  };

  const onSegmentClick = (segmentationUID, segmentIndex) => {
    segmentationService.setActiveSegment(segmentationUID, segmentIndex);

    const toolGroupIDs = getToolGroupIDs(segmentationUID);

    toolGroupIDs.forEach(toolGroupID => {
      segmentationService.setActiveSegmentationForToolGroup(segmentationUID, toolGroupID);
      segmentationService.jumpToSegmentCenter(segmentationUID, segmentIndex, toolGroupID);
    });
  };

  const onSegmentEdit = (segmentationUID, segmentIndex) => {
    const segmentation = segmentationService.getSegmentation(segmentationUID);

    const segment = segmentation.segments[segmentIndex];
    const { label } = segment;

    callInputDialog(uiDialogService, label, (label, actionID) => {
      if (label === '') return;

      segmentationService.setSegmentLabel(segmentationUID, segmentIndex, label);
    });
  };

  const onSegmentationEdit = segmentationUID => {
    const segmentation = segmentationService.getSegmentation(segmentationUID);
    const { label } = segmentation;

    callInputDialog(uiDialogService, label, (label, actionID) => {
      if (label === '') return;

      segmentationService.addOrUpdateSegmentation(
        {
          id: segmentationUID,
          label,
        },
        false,
        true
      );
    });
  };

  const onSegmentColorClick = (segmentationUID, segmentIndex) => {
    const segmentation = segmentationService.getSegmentation(segmentationUID);

    const segment = segmentation.segments[segmentIndex];
    const { color, opacity } = segment;

    const rgbaColor = {
      r: color[0],
      g: color[1],
      b: color[2],
      a: opacity / 255.0,
    };

    callColorPickerDialog(uiDialogService, rgbaColor, (newRgbaColor, actionId) => {
      if (actionId === 'cancel') return;

      segmentationService.setSegmentRGBAColor(segmentationUID, segmentIndex, [
        newRgbaColor.r,
        newRgbaColor.g,
        newRgbaColor.b,
        newRgbaColor.a * 255.0,
      ]);
    });
  };

  const onSegmentDelete = (segmentationUID, segmentIndex) => {
    segmentationService.removeSegment(segmentationUID, segmentIndex);
  };

  // segment hide
  const onToggleSegmentVisibility = (segmentationUID, segmentIndex) => {
    const segmentation = segmentationService.getSegmentation(segmentationUID);
    const segmentInfo = segmentation.segments[segmentIndex];
    const isVisible = !segmentInfo.isVisible;
    const toolGroupIDs = getToolGroupIDs(segmentationUID);

    toolGroupIDs.forEach(toolGroupID => {
      segmentationService.setSegmentVisibility(
        segmentationUID,
        segmentIndex,
        isVisible,
        toolGroupID
      );
    });
  };

  const onToggleSegmentLock = (segmentationUID, segmentIndex) => {
    segmentationService.toggleSegmentLocked(segmentationUID, segmentIndex);
  };

  const onToggleSegmentationVisibility = segmentationUID => {
    segmentationService.toggleSegmentationVisibility(segmentationUID);
    const segmentation = segmentationService.getSegmentation(segmentationUID);
    const isVisible = segmentation.isVisible;
    const segments = segmentation.segments;

    const toolGroupIDs = getToolGroupIDs(segmentationUID);

    toolGroupIDs.forEach(toolGroupID => {
      segments.forEach((segment, segmentIndex) => {
        segmentationService.setSegmentVisibility(
          segmentationUID,
          segmentIndex,
          isVisible,
          toolGroupID
        );
      });
    });
  };

  const _setSegmentationConfiguration = React.useCallback(
    (segmentationUID, key, value) => {
      segmentationService.setConfiguration({
        segmentationUID,
        [key]: value,
      });
    },
    [segmentationService]
  );

  const onSegmentationDownload = segmentationUID => {
    commandsManager.runCommand('downloadSegmentation', { segmentationUID });
  };

  const onSegmentationStore = async segmentationUID => {
    const datasources = extensionManager.getActiveDataSource();

    const displaySetInstanceUIDs = await createReportAsync({
      servicesManager,
      getReport: () =>
        commandsManager.runCommand('storeSegmentation', {
          segmentationUID,
          dataSource: datasources[0],
        }),
      reportType: 'Segmentation',
    });

    if (displaySetInstanceUIDs !== undefined) {
      segmentationService.remove(segmentationUID);

      viewportGridService.setDisplaySetsForViewport({
        viewportId: viewportGridService.getActiveViewportId(),
        displaySetInstanceUIDs,
      });
    }
  };

  const onSegmentationDownloadRTSS = segmentationUID => {
    commandsManager.runCommand('downloadRTSS', { segmentationUID });
  };

  const allowAddSegment = configuration?.addSegment;
  const onSegmentationAddWrapper =
    configuration?.onSegmentationAdd && typeof configuration?.onSegmentationAdd === 'function'
      ? configuration?.onSegmentationAdd
      : onSegmentationAdd;

  return (
    <AdaptedSegmentationGroupTable
      analysis={analysis}
      segmentations={segmentations}
      config={{ initialConfig: segmentationConfiguration }}
      segmentationClassName={addSegmentationClassName}
      disableEditing={configuration.disableEditing}
      showAddSegmentation={true}
      showAddSegment={allowAddSegment}
      showDeleteSegment={true}
      onSegmentationAdd={onSegmentationAddWrapper}
      onSegmentationEdit={onSegmentationEdit}
      onSegmentationClick={onSegmentationClick}
      onSegmentationDelete={onSegmentationDelete}
      onSegmentationDownload={onSegmentationDownload}
      onSegmentationDownloadRTSS={onSegmentationDownloadRTSS}
      onSegmentationStore={onSegmentationStore}
      onSegmentClick={onSegmentClick}
      onSegmentColorClick={onSegmentColorClick}
      onSegmentAdd={onSegmentAdd}
      onSegmentDelete={onSegmentDelete}
      onSegmentEdit={onSegmentEdit}
      onToggleSegmentationVisibility={onToggleSegmentationVisibility}
      onToggleSegmentVisibility={onToggleSegmentVisibility}
      onToggleSegmentLock={onToggleSegmentLock}
      setFillAlpha={value =>
        _setSegmentationConfiguration(selectedSegmentationId, 'fillAlpha', value)
      }
      setFillAlphaInactive={value =>
        _setSegmentationConfiguration(selectedSegmentationId, 'fillAlphaInactive', value)
      }
      setOutlineWidthActive={value =>
        _setSegmentationConfiguration(selectedSegmentationId, 'outlineWidthActive', value)
      }
      setOutlineOpacityActive={value =>
        _setSegmentationConfiguration(selectedSegmentationId, 'outlineOpacity', value)
      }
      setRenderFill={value =>
        _setSegmentationConfiguration(selectedSegmentationId, 'renderFill', value)
      }
      setRenderInactiveSegmentations={value =>
        _setSegmentationConfiguration(selectedSegmentationId, 'renderInactiveSegmentations', value)
      }
      setRenderOutline={value =>
        _setSegmentationConfiguration(selectedSegmentationId, 'renderOutline', value)
      }
    />
  );
}

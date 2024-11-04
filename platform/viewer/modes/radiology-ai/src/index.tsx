import { hotkeys } from '@ohif/core';

import { id } from './id';

import segmentationButtons from './segmentationButtons';
import toolbarButtons from './toolbarButtons';
import initToolGroups from './initToolGroups';

const ohif = {
  layout: '@ohif/extension-default.layoutTemplateModule.viewerLayout',
  sopClassHandler: '@ohif/extension-default.sopClassHandlerModule.stack',
  hangingProtocol: '@ohif/extension-default.hangingProtocolModule.default',
  leftPanel: '@ohif/extension-default.panelModule.seriesList',
  rightPanel: '@ohif/extension-default.panelModule.measurements',
};

const cornerstone = {
  viewport: '@ohif/extension-cornerstone.viewportModule.cornerstone',
};

const segmentation = {
  panel: '@ohif/extension-cornerstone-dicom-seg.panelModule.panelSegmentation',
  panelTool: '@ohif/extension-cornerstone-dicom-seg.panelModule.panelSegmentationWithTools',
  sopClassHandler: '@ohif/extension-cornerstone-dicom-seg.sopClassHandlerModule.dicom-seg',
  viewport: '@ohif/extension-cornerstone-dicom-seg.viewportModule.dicom-seg',
};

const prediction = {
  panel: 'predict-provisioner.panelModule.predict',
};

const extensionDependencies = {
  '@ohif/extension-default': '^3.0.0',
  '@ohif/extension-cornerstone': '^3.0.0',
  '@ohif/extension-cornerstone-dicom-seg': '^3.0.0',
  '@ohif/extension-cornerstone-dicom-rt': '^3.0.0',
  'predict-provisioner': '^0.0.1',
};

const modeFactory = ({ modeConfiguration }) => {
  return {
    id,
    routeName: 'radiology-ai',
    displayName: 'Radiology AI',

    onModeEnter: ({ servicesManager, extensionManager, commandsManager }: withAppTypes) => {
      const { measurementService, toolbarService, toolGroupService } = servicesManager.services;

      measurementService.clearMeasurements();
      initToolGroups(extensionManager, toolGroupService, commandsManager);

      toolbarService.addButtons(toolbarButtons);
      toolbarService.addButtons(segmentationButtons);

      toolbarService.createButtonSection('primary', [
        'MeasurementTools',
        'Zoom',
        'WindowLevel',
        'Pan',
        'TrackballRotate',
        'Capture',
        'Layout',
        'Crosshairs',
        'MoreTools',
      ]);

      toolbarService.createButtonSection('segmentationToolbox', ['BrushTools', 'Shapes']);
    },

    onModeExit: ({ servicesManager }: withAppTypes) => {
      const {
        toolGroupService,
        syncGroupService,
        toolbarService,
        segmentationService,
        cornerstoneViewportService,
        uiDialogService,
        uiModalService,
      } = servicesManager.services;

      uiDialogService.dismissAll();
      uiModalService.hide();
      toolGroupService.destroy();
      syncGroupService.destroy();
      segmentationService.destroy();
      cornerstoneViewportService.destroy();
    },

    validationTags: {
      study: [],
      series: [],
    },

    isValidMode: ({ modalities }) => {
      const list = modalities.split('\\');
      const unsupported = ['SM', 'US', 'MG', 'OT', 'DOC', 'CR'];

      const valid = list.length === 1 ? !unsupported.includes(list[0]) : true;
      const description =
        'The mode does not support studies that ONLY include the following modalities: ' +
        unsupported.join(', ');

      return { valid, description };
    },

    routes: [
      {
        path: 'template',
        layoutTemplate: ({ location, servicesManager }) => {
          return {
            id: ohif.layout,
            props: {
              leftPanels: [ohif.leftPanel],
              rightPanels: [segmentation.panelTool, prediction.panel],
              viewports: [
                {
                  namespace: cornerstone.viewport,
                  displaySetsToDisplay: [ohif.sopClassHandler],
                },
                {
                  namespace: segmentation.viewport,
                  displaySetsToDisplay: [segmentation.sopClassHandler],
                },
              ],
            },
          };
        },
      },
    ],

    extensions: extensionDependencies,
    hangingProtocol: 'default',
    sopClassHandlers: [ohif.sopClassHandler, segmentation.sopClassHandler],

    hotkeys: [...hotkeys.defaults.hotkeyBindings],
  };
};

export default { id, modeFactory, extensionDependencies };

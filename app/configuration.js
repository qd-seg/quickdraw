/** @type {AppTypes.Config} */

window.config = {
    routerBasename: '/',

    extensions: [],
    modes: [],

    customizationService: {
        dicomUploadComponent:
            '@ohif/extension-cornerstone.customizationModule.cornerstoneDicomUploadComponent',
    },

    showStudyList: true,

    maxNumberOfWebWorkers: 3,

    showLoadingIndicator: true,
    showWarningMessageForCrossOrigin: true,
    showCPUFallbackMessage: true,
    strictZSpacingForVolumeViewport: true,

    defaultDataSourceName: 'orthanc',

    dataSources: [
        {
            namespace: '@ohif/extension-default.dataSourcesModule.dicomweb',
            sourceName: 'orthanc',
            configuration: {
                friendlyName: 'Orthanc DICOMWeb Server',
                name: 'Orthanc',

                wadoUriRoot: '/store/wado',
                qidoRoot: '/store/dicom-web',
                wadoRoot: '/store/dicom-web',

                qidoSupportsIncludeField: false,

                imageRendering: 'wadors',
                thumbnailRendering: 'wadors',

                dicomUploadEnabled: true,
                omitQuotationForMultipartRequest: true,
            },
        }
    ],
};
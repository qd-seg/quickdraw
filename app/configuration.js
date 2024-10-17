/** @type {AppTypes.Config} */

window.config = {
    routerBasename: '/',

    extensions: [],
    modes: [],

    customizationService: {
        dicomUploadComponent:
            '@ohif/extension-cornerstone.customizationModule.cornerstoneDicomUploadComponent',
    },

    showWarningMessageForCrossOrigin: true,
    showCPUFallbackMessage: true,
    showLoadingIndicator: true,
    strictZSpacingForVolumeViewport: true,
    useSharedArrayBuffer: false,
    studyListFunctionsEnabled: true,

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

                qidoSupportsIncludeField: true,
                supportsReject: true,

                imageRendering: 'wadors',
                thumbnailRendering: 'wadors',

                enableStudyLazyLoad: true,
                supportsFuzzyMatching: true,
                supportsWildcard: true,
                dicomUploadEnabled: true,
                omitQuotationForMultipartRequest: true,

                bulkDataURI: { enabled: true },
            },
        },
        {
            namespace: '@ohif/extension-default.dataSourcesModule.dicomjson',
            sourceName: 'json',
            configuration: {
                friendlyName: 'DICOM JSON',
                name: 'JSON',
            },
        },
        {
            namespace: '@ohif/extension-default.dataSourcesModule.dicomlocal',
            sourceName: 'local',
            dicomUploadEnabled: true,
            configuration: {
                friendlyName: 'DICOM Local',
            },
        }
    ],
};
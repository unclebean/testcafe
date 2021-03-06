const { expect }    = require('chai');
const VideoRecorder = require('../../lib/video-recorder');
const AsyncEmitter  = require('../../lib/utils/async-event-emitter');
const WarningLog    = require('../../lib/notifications/warning-log');

const VIDEOS_BASE_PATH = '__videos__';

class VideoRecorderMock extends VideoRecorder {
    constructor (basePath, ffmpegPath, connection, customOptions) {
        super(basePath, ffmpegPath, connection, customOptions);

        this.log = [];
    }

    _generateTempNames (id) {
        return super._generateTempNames(id)
            .then(result => {
                this.log.push('generate-names');

                return result;
            });
    }

    _onBrowserJobStart () {
        this.log.push('job-start');

        return super._onBrowserJobStart()
            .then(() => {
                this.log.push('temp-dir-initialized');
            });
    }

    _onTestRunCreate (options) {
        this.log.push('test-created');

        return super._onTestRunCreate(options)
            .then(() => {
                this.log.push('video-recorder-initialized');
            });
    }
}

describe('Video Recorder', () => {
    it('Should not start video recording for legacy tests', () => {
        const browserJobMock = new AsyncEmitter();
        const videoRecorder  = new VideoRecorder(browserJobMock, VIDEOS_BASE_PATH, {}, {});

        const testRunCreateEventDataMock = {
            testRun:    {},
            legacy:     true,
            index:      1,
            test:       {},
            quarantine: null
        };

        return browserJobMock
            .emit('start')
            .then(() => browserJobMock.emit('test-run-created', testRunCreateEventDataMock))
            .then(() => {
                expect(videoRecorder.testRunInfo).to.be.empty;
            });
    });

    it('Should correctly format the warning message about no suitable path pattern placeholders', () => {
        const browserJobMock = new AsyncEmitter();
        const warningLog     = new WarningLog();
        const videoRecorder  = new VideoRecorder(browserJobMock, VIDEOS_BASE_PATH, {}, {}, warningLog);

        videoRecorder._addProblematicPlaceholdersWarning(['${TEST_INDEX}']);
        expect(warningLog.messages).eql([
            'The "${TEST_INDEX}" path pattern placeholder cannot be applied to the recorded video.' +
            '\n\n' +
            'The placeholder was replaced with an empty string.'
        ]);
        warningLog.messages = [];

        videoRecorder._addProblematicPlaceholdersWarning(['${TEST_INDEX}', '${FIXTURE}']);
        expect(warningLog.messages).eql([
            'The "${TEST_INDEX}", "${FIXTURE}" path pattern placeholders cannot be applied to the recorded video.' +
            '\n\n' +
            'The placeholders were replaced with an empty string.'
        ]);
    });

    it('Should wait for Temp directory is initialized', () => {
        const browserJobMock = new AsyncEmitter();
        const warningLog     = new WarningLog();
        const videoRecorder  = new VideoRecorderMock(browserJobMock, VIDEOS_BASE_PATH, {}, {}, warningLog);

        const testRunMock = {
            testRun: {
                browserConnection: {
                    id:       'connectionId',
                    provider: {
                        hasCustomActionForBrowser: () => {
                            return {
                                hasGetVideoFrameData: true
                            };
                        }
                    }
                }
            }
        };

        browserJobMock.emit('start');

        const testRunCreatePromise = browserJobMock.emit('test-run-create', testRunMock);

        browserJobMock.emit('done');

        return testRunCreatePromise.then(() => {
            expect(videoRecorder.log).eql([
                'job-start',
                'test-created',
                'temp-dir-initialized',
                'generate-names'
            ]);
        });
    });
});

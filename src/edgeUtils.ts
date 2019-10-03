/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as os from 'os';
import { utils as coreUtils } from 'vscode-chrome-debug-core';
import * as path from 'path';

const WIN_APPDATA = process.env.LOCALAPPDATA || '/';

const MSEDGE_STABLE_VERSION = 'stable';
const MSEDGE_BETA_VERSION = 'beta';
const MSEDGE_DEV_VERSION = 'dev';
const MSEDGE_CANARY_VERSION = 'canary';

interface IWindowsMSEdgePaths {
    WINx86_SYSTEMPATH: string;
    WINx86_USERPATH: string;
}

const WINx86_STABLE_PATHS: IWindowsMSEdgePaths = {
    WINx86_SYSTEMPATH: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    WINx86_USERPATH: path.join(WIN_APPDATA, 'Microsoft\\Edge\\Application\\msedge.exe')
};

const WINx86_BETA_PATHS: IWindowsMSEdgePaths = {
    WINx86_SYSTEMPATH: 'C:\\Program Files (x86)\\Microsoft\\Edge Beta\\Application\\msedge.exe',
    WINx86_USERPATH: path.join(WIN_APPDATA, 'Microsoft\\Edge Beta\\Application\\msedge.exe')
};

const WINx86_DEV_PATHS: IWindowsMSEdgePaths = {
    WINx86_SYSTEMPATH: 'C:\\Program Files (x86)\\Microsoft\\Edge Dev\\Application\\msedge.exe',
    WINx86_USERPATH: path.join(WIN_APPDATA, 'Microsoft\\Edge Dev\\Application\\msedge.exe')
};

const WINx86_CANARY_PATHS: IWindowsMSEdgePaths = {
    WINx86_SYSTEMPATH: 'C:\\Program Files (x86)\\Microsoft\\Edge SxS\\Application\\msedge.exe',
    WINx86_USERPATH: path.join(WIN_APPDATA, 'Microsoft\\Edge SxS\\Application\\msedge.exe')
};

const OSX_MSEDGE_PATHS = {
    OSX_STABLE_PATH: '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    OSX_DEV_PATH: '/Applications/Microsoft Edge Dev.app/Contents/MacOS/Microsoft Edge Dev',
    OSX_BETA_PATH: '/Applications/Microsoft Edge Beta.app/Contents/MacOS/Microsoft Edge Beta',
    OSX_CANARY_PATH: '/Applications/Microsoft Edge Canary.app/Contents/MacOS/Microsoft Edge Canary',
};

export function getEdgeBrowserPath(msedgeVersion: string): string | null {
    const platform = coreUtils.getPlatform();
    if (platform === coreUtils.Platform.Windows) {
        let possiblePaths: IWindowsMSEdgePaths;
        switch (msedgeVersion) {
            case MSEDGE_STABLE_VERSION: {
                possiblePaths = WINx86_STABLE_PATHS;
                break;
            }
            case MSEDGE_BETA_VERSION: {
                possiblePaths = WINx86_BETA_PATHS;
                break;
            }
            case MSEDGE_DEV_VERSION: {
                possiblePaths = WINx86_DEV_PATHS;
                break;
            }
            case MSEDGE_CANARY_VERSION: {
                possiblePaths = WINx86_CANARY_PATHS;
                break;
            }
            default: {
                return null;
            }
        }
        return getWindowsExecutable(possiblePaths);
    } else if (platform === coreUtils.Platform.OSX) {
        let macInstallPath: string;
        switch (msedgeVersion) {
            case MSEDGE_STABLE_VERSION: {
                macInstallPath = OSX_MSEDGE_PATHS.OSX_STABLE_PATH;
                break;
            }
            case MSEDGE_BETA_VERSION: {
                macInstallPath = OSX_MSEDGE_PATHS.OSX_BETA_PATH;
                break;
            }
            case MSEDGE_DEV_VERSION: {
                macInstallPath = OSX_MSEDGE_PATHS.OSX_DEV_PATH;
                break;
            }
            case MSEDGE_CANARY_VERSION: {
                macInstallPath = OSX_MSEDGE_PATHS.OSX_CANARY_PATH;
                break;
            }
            default: {
                return null;
            }
        }
        return macInstallPath;
    } else {
        return null;
    }
}

function getWindowsExecutable(possiblePaths: IWindowsMSEdgePaths) {
    if (coreUtils.existsSync(possiblePaths.WINx86_SYSTEMPATH)) {
        return possiblePaths.WINx86_SYSTEMPATH;
    } else if (coreUtils.existsSync(possiblePaths.WINx86_USERPATH)) {
        return possiblePaths.WINx86_USERPATH;
    } else {
        return null;
    }
}

export function isEdgeDebuggingSupported(): boolean {
    if (os.platform() !== 'win32') {
        return false;
    }

    const versionPieces = os.release().split('.');
    const majorVersion = +versionPieces[0];
    const minorVersion = +versionPieces[1];
    const buildNumber = +versionPieces[2];

    return (majorVersion > 10) ||
        (majorVersion === 10 && minorVersion > 0) ||
        (majorVersion === 10 && minorVersion === 0 && buildNumber >= 17058); // RS4 or higher
}

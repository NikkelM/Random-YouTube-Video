// import sinon-chrome
import sinonChrome from 'sinon-chrome';

global.chrome = sinonChrome;

let mockedConfigSync = {};

chrome.storage.sync.get.callsFake(() => { return Promise.resolve(mockedConfigSync) });
chrome.storage.sync.set.callsFake((obj) => { Object.assign(mockedConfigSync, obj); return Promise.resolve() });

chrome.storage.sync.set({ "userQuotaRemainingToday": 200, "userQuotaResetTime": new Date(new Date().setHours(24, 0, 0, 0)).getTime() });
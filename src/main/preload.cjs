'use strict';
const { contextBridge, ipcRenderer } = require('electron');
const actions = new Set(['state:get','engine:install','engine:update','scan:start','scan:cancel','scan:export','quarantine:add','quarantine:restore','quarantine:delete','watch:add','watch:remove','watch:toggle','schedule:set','system:refresh','system:open','app:open-data','app:website','tools:message','tools:link','tools:clean-link','browser:export','provider:open']);
contextBridge.exposeInMainWorld('vaccine', Object.freeze({
  invoke(action, payload) { if (!actions.has(action)) return Promise.reject(new Error('Unsupported action')); return ipcRenderer.invoke('vaccine:action', action, payload); },
  subscribe(callback) { if (typeof callback !== 'function') throw new Error('A callback is required'); const listener = (_event, state) => callback(state); ipcRenderer.on('vaccine:state', listener); return () => ipcRenderer.removeListener('vaccine:state', listener); },
}));

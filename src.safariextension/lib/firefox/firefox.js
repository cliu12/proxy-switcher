'use strict';

// Load Firefox based resources
var self          = require('sdk/self'),
    data          = self.data,
    sp            = require('sdk/simple-prefs'),
    prefs         = sp.prefs,
    notifications = require('sdk/notifications'),
    tabs          = require('sdk/tabs'),
    timers        = require('sdk/timers'),
    unload        = require('sdk/system/unload'),
    prefsvc       = require('sdk/preferences/service'),
    {on, off, once, emit} = require('sdk/event/core'),
    {ToggleButton} = require('sdk/ui/button/toggle'),
    {Cc, Ci}      = require('chrome'),
    config        = require('../config');

// Event Emitter
exports.on = on.bind(null, exports);
exports.once = once.bind(null, exports);
exports.emit = emit.bind(null, exports);
exports.removeListener = function removeListener (type, listener) {
  off(exports, type, listener);
};

//toolbar button
exports.button = (function () {
  var button = new ToggleButton({
    id: self.name,
    label: 'Proxy Switcher',
    icon: {
      '18': './icons/toolbar/gray/18.png',
      '36': './icons/toolbar/gray/36.png'
    },
    onChange: function (state) {
      if (state.checked) {
        exports.popup._obj.show({
          width: config.popup.width,
          height: config.popup.height,
          position: button
        });
      }
    }
  });
  return {
    _obj: button,
    set icon (val) {
      button.icon = {
        18: './icons/toolbar/' + val + '/18.png',
        36: './icons/toolbar/' + val + '/36.png'
      };
    }
  };
})();

exports.storage = {
  read: function (id) {
    return (prefs[id] || prefs[id] + '' === 'false' || !isNaN(prefs[id])) ? (prefs[id] + '') : null;
  },
  write: function (id, data) {
    data = data + '';
    if (data === 'true' || data === 'false') {
      prefs[id] = data === 'true' ? true : false;
    }
    else if (parseInt(data) + '' === data) {
      prefs[id] = parseInt(data);
    }
    else {
      prefs[id] = data + '';
    }
  }
};

exports.popup = (function () {
  var popup = require('sdk/panel').Panel({
    contentURL: data.url('./popup/index.html'),
    contentScriptFile: [data.url('./popup/firefox/firefox.js'), data.url('./popup/index.js')],
    onHide: function () {
      exports.button._obj.state('window', {checked: false});
      //popup.contentURL = 'about:blank';
    }
  });
  popup.on('show', () => popup.port.emit('init'));
  return {
    _obj: popup,
    send: function (id, data) {
      popup.port.emit(id, data);
    },
    receive: function (id, callback) {
      popup.port.on(id, callback);
    },
    hide: function () {
      popup.hide();
    },
    init: function () {
      popup.port.emit('init');
    }
  };
})();

exports.tab = {
  open: function (url, inBackground, inCurrent) {
    if (inCurrent) {
      tabs.activeTab.url = url;
    }
    else {
      tabs.open({
        url: url,
        inBackground: typeof inBackground === 'undefined' ? false : inBackground
      });
    }
  },
  list: function () {
    var temp = [];
    for each (var tab in tabs) {
      temp.push(tab);
    }
    return Promise.resolve(temp);
  }
};

exports.version = function () {
  return self.version;
};

exports.timer = timers;

exports.notification = function (title, text) {
  notifications.notify({
    title: title,
    text: text,
    iconURL: data.url('icons/32.png')
  });
};

exports.proxy = (function () {
  unload.when(function (reason) {
    // reseting network type back to factory on uninstall only
    if (reason === 'uninstall' || reason === 'disable') {
      prefsvc.reset('network.proxy.type');
    }
  });
  return {
    get type () {
      return {0: 0, 4: 1, 5: 2, 1: 3, 2: 4}[prefsvc.get('network.proxy.type')] || 0;
    },
    set type (val) {
      prefsvc.set('network.proxy.type', {0: 0, 1: 4, 2: 5, 3: 1, 4: 2}[val]);
    },
    set: function (pref, value) {
      prefsvc.set(pref, value);
    },
    get: function (pref) {
      return prefsvc.get(pref);
    },
    toJSON: function () {
      return JSON.stringify({
        type: prefsvc.get('network.proxy.type'),
        http: {
          host: prefsvc.get('network.proxy.http'),
          port: prefsvc.get('network.proxy.http_port')
        },
        ssl: {
          host: prefsvc.get('network.proxy.ssl'),
          port: prefsvc.get('network.proxy.ssl_port')
        },
        ftp: {
          host: prefsvc.get('network.proxy.ftp'),
          port: prefsvc.get('network.proxy.ftp_port')
        },
        socks: {
          host: prefsvc.get('network.proxy.socks'),
          port: prefsvc.get('network.proxy.socks_port'),
          version: prefsvc.get('network.proxy.socks_version')
        },
        dns:  prefsvc.get('network.proxy.socks_remote_dns'),
        attached: exports.storage.read('attached')
      });
    },
    fromJSON: function (str) {
      var tmp = JSON.parse(str || '{}');
      tmp.http = tmp.http || {};
      tmp.ssl = tmp.ssl || {};
      tmp.socks = tmp.socks || {};
      tmp.ftp = tmp.ftp || {};

      prefsvc.set('network.proxy.type', tmp.type || 1);
      prefsvc.set('network.proxy.http', tmp.http.host || '');
      if ('port' in tmp.http) {
        prefsvc.set('network.proxy.http_port', tmp.http.port);
      }
      else {
        prefsvc.reset('network.proxy.http_port');
      }
      prefsvc.set('network.proxy.ssl', tmp.ssl.host || '');
      if ('port' in tmp.ssl) {
        prefsvc.set('network.proxy.ssl_port', tmp.ssl.port);
      }
      else {
        prefsvc.reset('network.proxy.ssl_port');
      }
      prefsvc.set('network.proxy.ftp', tmp.ftp.host || '');
      if ('port' in tmp.ftp) {
        prefsvc.set('network.proxy.ftp_port', tmp.ftp.port);
      }
      else {
        prefsvc.reset('network.proxy.ftp_port');
      }
      prefsvc.set('network.proxy.socks', tmp.socks.host || '');
      if ('port' in tmp.socks) {
        prefsvc.set('network.proxy.socks_port', tmp.socks.port);
      }
      else {
        prefsvc.reset('network.proxy.socks_port');
      }
      prefsvc.set('network.proxy.socks_version', tmp.socks.version || 5);
      if ('dns' in tmp) {
        prefsvc.set('network.proxy.socks_remote_dns', tmp.dns);
      }
      else {
        prefsvc.reset('network.proxy.socks_remote_dns');
      }
      exports.storage.write('attached', 'attached' in tmp ? tmp.attached : true);
    }
  }
      toUrlJSON: function () {
      return JSON.stringify({
        type: prefsvc.get('network.proxy.type'),
        pacurl: prefsvc.get('network.proxy.autoconfig_url'),
      });
    },
    fromUrlJSON: function (str) {
      var tmp = JSON.parse(str || '{}');

      prefsvc.set('network.proxy.type', tmp.type || 2);
      prefsvc.set('network.proxy.autoconfig_url', tmp.pacurl || '');
    },
    reloadPAC: function (){
      Cc["@mozilla.org/network/protocol-proxy-service;1"].
        getService().reloadPAC();
    },
  }
})();

exports.prompt = function (title, msg, input) {
  var prompts = Cc['@mozilla.org/embedcomp/prompt-service;1'].getService(Ci.nsIPromptService);
  input = {value: input};
  var result = prompts.prompt(null, title, msg, input, null, {value: false});
  return {
    result: result,
    input: input.value
  };
};

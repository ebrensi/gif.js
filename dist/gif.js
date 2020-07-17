(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.GIF = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var objectCreate = Object.create || objectCreatePolyfill
var objectKeys = Object.keys || objectKeysPolyfill
var bind = Function.prototype.bind || functionBindPolyfill

function EventEmitter() {
  if (!this._events || !Object.prototype.hasOwnProperty.call(this, '_events')) {
    this._events = objectCreate(null);
    this._eventsCount = 0;
  }

  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
var defaultMaxListeners = 10;

var hasDefineProperty;
try {
  var o = {};
  if (Object.defineProperty) Object.defineProperty(o, 'x', { value: 0 });
  hasDefineProperty = o.x === 0;
} catch (err) { hasDefineProperty = false }
if (hasDefineProperty) {
  Object.defineProperty(EventEmitter, 'defaultMaxListeners', {
    enumerable: true,
    get: function() {
      return defaultMaxListeners;
    },
    set: function(arg) {
      // check whether the input is a positive number (whose value is zero or
      // greater and not a NaN).
      if (typeof arg !== 'number' || arg < 0 || arg !== arg)
        throw new TypeError('"defaultMaxListeners" must be a positive number');
      defaultMaxListeners = arg;
    }
  });
} else {
  EventEmitter.defaultMaxListeners = defaultMaxListeners;
}

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function setMaxListeners(n) {
  if (typeof n !== 'number' || n < 0 || isNaN(n))
    throw new TypeError('"n" argument must be a positive number');
  this._maxListeners = n;
  return this;
};

function $getMaxListeners(that) {
  if (that._maxListeners === undefined)
    return EventEmitter.defaultMaxListeners;
  return that._maxListeners;
}

EventEmitter.prototype.getMaxListeners = function getMaxListeners() {
  return $getMaxListeners(this);
};

// These standalone emit* functions are used to optimize calling of event
// handlers for fast cases because emit() itself often has a variable number of
// arguments and can be deoptimized because of that. These functions always have
// the same number of arguments and thus do not get deoptimized, so the code
// inside them can execute faster.
function emitNone(handler, isFn, self) {
  if (isFn)
    handler.call(self);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self);
  }
}
function emitOne(handler, isFn, self, arg1) {
  if (isFn)
    handler.call(self, arg1);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self, arg1);
  }
}
function emitTwo(handler, isFn, self, arg1, arg2) {
  if (isFn)
    handler.call(self, arg1, arg2);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self, arg1, arg2);
  }
}
function emitThree(handler, isFn, self, arg1, arg2, arg3) {
  if (isFn)
    handler.call(self, arg1, arg2, arg3);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self, arg1, arg2, arg3);
  }
}

function emitMany(handler, isFn, self, args) {
  if (isFn)
    handler.apply(self, args);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].apply(self, args);
  }
}

EventEmitter.prototype.emit = function emit(type) {
  var er, handler, len, args, i, events;
  var doError = (type === 'error');

  events = this._events;
  if (events)
    doError = (doError && events.error == null);
  else if (!doError)
    return false;

  // If there is no 'error' event listener then throw.
  if (doError) {
    if (arguments.length > 1)
      er = arguments[1];
    if (er instanceof Error) {
      throw er; // Unhandled 'error' event
    } else {
      // At least give some kind of context to the user
      var err = new Error('Unhandled "error" event. (' + er + ')');
      err.context = er;
      throw err;
    }
    return false;
  }

  handler = events[type];

  if (!handler)
    return false;

  var isFn = typeof handler === 'function';
  len = arguments.length;
  switch (len) {
      // fast cases
    case 1:
      emitNone(handler, isFn, this);
      break;
    case 2:
      emitOne(handler, isFn, this, arguments[1]);
      break;
    case 3:
      emitTwo(handler, isFn, this, arguments[1], arguments[2]);
      break;
    case 4:
      emitThree(handler, isFn, this, arguments[1], arguments[2], arguments[3]);
      break;
      // slower
    default:
      args = new Array(len - 1);
      for (i = 1; i < len; i++)
        args[i - 1] = arguments[i];
      emitMany(handler, isFn, this, args);
  }

  return true;
};

function _addListener(target, type, listener, prepend) {
  var m;
  var events;
  var existing;

  if (typeof listener !== 'function')
    throw new TypeError('"listener" argument must be a function');

  events = target._events;
  if (!events) {
    events = target._events = objectCreate(null);
    target._eventsCount = 0;
  } else {
    // To avoid recursion in the case that type === "newListener"! Before
    // adding it to the listeners, first emit "newListener".
    if (events.newListener) {
      target.emit('newListener', type,
          listener.listener ? listener.listener : listener);

      // Re-assign `events` because a newListener handler could have caused the
      // this._events to be assigned to a new object
      events = target._events;
    }
    existing = events[type];
  }

  if (!existing) {
    // Optimize the case of one listener. Don't need the extra array object.
    existing = events[type] = listener;
    ++target._eventsCount;
  } else {
    if (typeof existing === 'function') {
      // Adding the second element, need to change to array.
      existing = events[type] =
          prepend ? [listener, existing] : [existing, listener];
    } else {
      // If we've already got an array, just append.
      if (prepend) {
        existing.unshift(listener);
      } else {
        existing.push(listener);
      }
    }

    // Check for listener leak
    if (!existing.warned) {
      m = $getMaxListeners(target);
      if (m && m > 0 && existing.length > m) {
        existing.warned = true;
        var w = new Error('Possible EventEmitter memory leak detected. ' +
            existing.length + ' "' + String(type) + '" listeners ' +
            'added. Use emitter.setMaxListeners() to ' +
            'increase limit.');
        w.name = 'MaxListenersExceededWarning';
        w.emitter = target;
        w.type = type;
        w.count = existing.length;
        if (typeof console === 'object' && console.warn) {
          console.warn('%s: %s', w.name, w.message);
        }
      }
    }
  }

  return target;
}

EventEmitter.prototype.addListener = function addListener(type, listener) {
  return _addListener(this, type, listener, false);
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.prependListener =
    function prependListener(type, listener) {
      return _addListener(this, type, listener, true);
    };

function onceWrapper() {
  if (!this.fired) {
    this.target.removeListener(this.type, this.wrapFn);
    this.fired = true;
    switch (arguments.length) {
      case 0:
        return this.listener.call(this.target);
      case 1:
        return this.listener.call(this.target, arguments[0]);
      case 2:
        return this.listener.call(this.target, arguments[0], arguments[1]);
      case 3:
        return this.listener.call(this.target, arguments[0], arguments[1],
            arguments[2]);
      default:
        var args = new Array(arguments.length);
        for (var i = 0; i < args.length; ++i)
          args[i] = arguments[i];
        this.listener.apply(this.target, args);
    }
  }
}

function _onceWrap(target, type, listener) {
  var state = { fired: false, wrapFn: undefined, target: target, type: type, listener: listener };
  var wrapped = bind.call(onceWrapper, state);
  wrapped.listener = listener;
  state.wrapFn = wrapped;
  return wrapped;
}

EventEmitter.prototype.once = function once(type, listener) {
  if (typeof listener !== 'function')
    throw new TypeError('"listener" argument must be a function');
  this.on(type, _onceWrap(this, type, listener));
  return this;
};

EventEmitter.prototype.prependOnceListener =
    function prependOnceListener(type, listener) {
      if (typeof listener !== 'function')
        throw new TypeError('"listener" argument must be a function');
      this.prependListener(type, _onceWrap(this, type, listener));
      return this;
    };

// Emits a 'removeListener' event if and only if the listener was removed.
EventEmitter.prototype.removeListener =
    function removeListener(type, listener) {
      var list, events, position, i, originalListener;

      if (typeof listener !== 'function')
        throw new TypeError('"listener" argument must be a function');

      events = this._events;
      if (!events)
        return this;

      list = events[type];
      if (!list)
        return this;

      if (list === listener || list.listener === listener) {
        if (--this._eventsCount === 0)
          this._events = objectCreate(null);
        else {
          delete events[type];
          if (events.removeListener)
            this.emit('removeListener', type, list.listener || listener);
        }
      } else if (typeof list !== 'function') {
        position = -1;

        for (i = list.length - 1; i >= 0; i--) {
          if (list[i] === listener || list[i].listener === listener) {
            originalListener = list[i].listener;
            position = i;
            break;
          }
        }

        if (position < 0)
          return this;

        if (position === 0)
          list.shift();
        else
          spliceOne(list, position);

        if (list.length === 1)
          events[type] = list[0];

        if (events.removeListener)
          this.emit('removeListener', type, originalListener || listener);
      }

      return this;
    };

EventEmitter.prototype.removeAllListeners =
    function removeAllListeners(type) {
      var listeners, events, i;

      events = this._events;
      if (!events)
        return this;

      // not listening for removeListener, no need to emit
      if (!events.removeListener) {
        if (arguments.length === 0) {
          this._events = objectCreate(null);
          this._eventsCount = 0;
        } else if (events[type]) {
          if (--this._eventsCount === 0)
            this._events = objectCreate(null);
          else
            delete events[type];
        }
        return this;
      }

      // emit removeListener for all listeners on all events
      if (arguments.length === 0) {
        var keys = objectKeys(events);
        var key;
        for (i = 0; i < keys.length; ++i) {
          key = keys[i];
          if (key === 'removeListener') continue;
          this.removeAllListeners(key);
        }
        this.removeAllListeners('removeListener');
        this._events = objectCreate(null);
        this._eventsCount = 0;
        return this;
      }

      listeners = events[type];

      if (typeof listeners === 'function') {
        this.removeListener(type, listeners);
      } else if (listeners) {
        // LIFO order
        for (i = listeners.length - 1; i >= 0; i--) {
          this.removeListener(type, listeners[i]);
        }
      }

      return this;
    };

function _listeners(target, type, unwrap) {
  var events = target._events;

  if (!events)
    return [];

  var evlistener = events[type];
  if (!evlistener)
    return [];

  if (typeof evlistener === 'function')
    return unwrap ? [evlistener.listener || evlistener] : [evlistener];

  return unwrap ? unwrapListeners(evlistener) : arrayClone(evlistener, evlistener.length);
}

EventEmitter.prototype.listeners = function listeners(type) {
  return _listeners(this, type, true);
};

EventEmitter.prototype.rawListeners = function rawListeners(type) {
  return _listeners(this, type, false);
};

EventEmitter.listenerCount = function(emitter, type) {
  if (typeof emitter.listenerCount === 'function') {
    return emitter.listenerCount(type);
  } else {
    return listenerCount.call(emitter, type);
  }
};

EventEmitter.prototype.listenerCount = listenerCount;
function listenerCount(type) {
  var events = this._events;

  if (events) {
    var evlistener = events[type];

    if (typeof evlistener === 'function') {
      return 1;
    } else if (evlistener) {
      return evlistener.length;
    }
  }

  return 0;
}

EventEmitter.prototype.eventNames = function eventNames() {
  return this._eventsCount > 0 ? Reflect.ownKeys(this._events) : [];
};

// About 1.5x faster than the two-arg version of Array#splice().
function spliceOne(list, index) {
  for (var i = index, k = i + 1, n = list.length; k < n; i += 1, k += 1)
    list[i] = list[k];
  list.pop();
}

function arrayClone(arr, n) {
  var copy = new Array(n);
  for (var i = 0; i < n; ++i)
    copy[i] = arr[i];
  return copy;
}

function unwrapListeners(arr) {
  var ret = new Array(arr.length);
  for (var i = 0; i < ret.length; ++i) {
    ret[i] = arr[i].listener || arr[i];
  }
  return ret;
}

function objectCreatePolyfill(proto) {
  var F = function() {};
  F.prototype = proto;
  return new F;
}
function objectKeysPolyfill(obj) {
  var keys = [];
  for (var k in obj) if (Object.prototype.hasOwnProperty.call(obj, k)) {
    keys.push(k);
  }
  return k;
}
function functionBindPolyfill(context) {
  var fn = this;
  return function () {
    return fn.apply(context, arguments);
  };
}

},{}],2:[function(require,module,exports){
/* CoffeeScript version of the browser detection from MooTools */
var UA, browser, mode, platform, ua;

ua = navigator.userAgent.toLowerCase();

platform = navigator.platform.toLowerCase();

UA = ua.match(/(opera|ie|firefox|chrome|version)[\s\/:]([\w\d\.]+)?.*?(safari|version[\s\/:]([\w\d\.]+)|$)/) || [null, 'unknown', 0];

mode = UA[1] === 'ie' && document.documentMode;

browser = {
  name: UA[1] === 'version' ? UA[3] : UA[1],
  version: mode || parseFloat(UA[1] === 'opera' && UA[4] ? UA[4] : UA[2]),
  platform: {
    name: ua.match(/ip(?:ad|od|hone)/) ? 'ios' : (ua.match(/(?:webos|android)/) || platform.match(/mac|win|linux/) || ['other'])[0]
  }
};

browser[browser.name] = true;

browser[browser.name + parseInt(browser.version, 10)] = true;

browser.platform[browser.platform.name] = true;

module.exports = browser;


},{}],3:[function(require,module,exports){
var EventEmitter, GIF, browser,
  hasProp = {}.hasOwnProperty,
  indexOf = [].indexOf;

({EventEmitter} = require('events'));

browser = require('./browser.coffee');

GIF = (function() {
  var defaults, frameDefaults;

  class GIF extends EventEmitter {
    constructor(options) {
      var base, key, value;
      super(options);
      this.running = false;
      this.options = {};
      this.frames = [];
      this.freeWorkers = [];
      this.activeWorkers = [];
      this.setOptions(options);
      for (key in defaults) {
        value = defaults[key];
        if ((base = this.options)[key] == null) {
          base[key] = value;
        }
      }
    }

    setOption(key, value) {
      this.options[key] = value;
      if ((this._canvas != null) && (key === 'width' || key === 'height')) {
        return this._canvas[key] = value;
      }
    }

    setOptions(options) {
      var key, results, value;
      results = [];
      for (key in options) {
        if (!hasProp.call(options, key)) continue;
        value = options[key];
        results.push(this.setOption(key, value));
      }
      return results;
    }

    addFrame(image, options = {}) {
      var frame, key;
      frame = {};
      frame.transparent = this.options.transparent;
      for (key in frameDefaults) {
        frame[key] = options[key] || frameDefaults[key];
      }
      if (this.options.width == null) {
        // use the images width and height for options unless already set
        this.setOption('width', image.width);
      }
      if (this.options.height == null) {
        this.setOption('height', image.height);
      }
      if ((typeof ImageData !== "undefined" && ImageData !== null) && image instanceof ImageData) {
        frame.data = image.data;
      } else if (((typeof CanvasRenderingContext2D !== "undefined" && CanvasRenderingContext2D !== null) && image instanceof CanvasRenderingContext2D) || ((typeof WebGLRenderingContext !== "undefined" && WebGLRenderingContext !== null) && image instanceof WebGLRenderingContext)) {
        if (options.copy) {
          frame.data = this.getContextData(image);
        } else {
          frame.context = image;
        }
      } else if (image.childNodes != null) {
        if (options.copy) {
          frame.data = this.getImageData(image);
        } else {
          frame.image = image;
        }
      } else {
        throw new Error('Invalid image');
      }
      return this.frames.push(frame);
    }

    render() {
      var i, j, numWorkers, ref;
      if (this.running) {
        throw new Error('Already running');
      }
      if ((this.options.width == null) || (this.options.height == null)) {
        throw new Error('Width and height must be set prior to rendering');
      }
      this.running = true;
      this.nextFrame = 0;
      this.finishedFrames = 0;
      this.imageParts = (function() {
        var j, ref, results;
        results = [];
        for (i = j = 0, ref = this.frames.length; (0 <= ref ? j < ref : j > ref); i = 0 <= ref ? ++j : --j) {
          results.push(null);
        }
        return results;
      }).call(this);
      numWorkers = this.spawnWorkers();
      // we need to wait for the palette
      if (this.options.globalPalette === true) {
        this.renderNextFrame();
      } else {
        for (i = j = 0, ref = numWorkers; (0 <= ref ? j < ref : j > ref); i = 0 <= ref ? ++j : --j) {
          this.renderNextFrame();
        }
      }
      this.emit('start');
      return this.emit('progress', 0);
    }

    abort() {
      var worker;
      while (true) {
        worker = this.activeWorkers.shift();
        if (worker == null) {
          break;
        }
        this.log('killing active worker');
        worker.terminate();
      }
      this.running = false;
      return this.emit('abort');
    }

    // private
    spawnWorkers() {
      var numWorkers, ref;
      numWorkers = Math.min(this.options.workers, this.frames.length);
      (function() {
        var results = [];
        for (var j = ref = this.freeWorkers.length; ref <= numWorkers ? j < numWorkers : j > numWorkers; ref <= numWorkers ? j++ : j--){ results.push(j); }
        return results;
      }).apply(this).forEach((i) => {
        var worker;
        this.log(`spawning worker ${i}`);
        worker = new Worker(this.options.workerScript);
        worker.onmessage = (event) => {
          this.activeWorkers.splice(this.activeWorkers.indexOf(worker), 1);
          this.freeWorkers.push(worker);
          return this.frameFinished(event.data);
        };
        return this.freeWorkers.push(worker);
      });
      return numWorkers;
    }

    frameFinished(frame) {
      var i, j, ref;
      this.log(`frame ${frame.index} finished - ${this.activeWorkers.length} active`);
      this.finishedFrames++;
      this.emit('progress', this.finishedFrames / this.frames.length);
      this.imageParts[frame.index] = frame;
      // remember calculated palette, spawn the rest of the workers
      if (this.options.globalPalette === true) {
        this.options.globalPalette = frame.globalPalette;
        this.log('global palette analyzed');
        if (this.frames.length > 2) {
          for (i = j = 1, ref = this.freeWorkers.length; (1 <= ref ? j < ref : j > ref); i = 1 <= ref ? ++j : --j) {
            this.renderNextFrame();
          }
        }
      }
      if (indexOf.call(this.imageParts, null) >= 0) {
        return this.renderNextFrame();
      } else {
        return this.finishRendering();
      }
    }

    finishRendering() {
      var data, frame, i, image, j, k, l, len, len1, len2, len3, offset, page, ref, ref1, ref2;
      len = 0;
      ref = this.imageParts;
      for (j = 0, len1 = ref.length; j < len1; j++) {
        frame = ref[j];
        len += (frame.data.length - 1) * frame.pageSize + frame.cursor;
      }
      len += frame.pageSize - frame.cursor;
      this.log(`rendering finished - filesize ${Math.round(len / 1000)}kb`);
      data = new Uint8Array(len);
      offset = 0;
      ref1 = this.imageParts;
      for (k = 0, len2 = ref1.length; k < len2; k++) {
        frame = ref1[k];
        ref2 = frame.data;
        for (i = l = 0, len3 = ref2.length; l < len3; i = ++l) {
          page = ref2[i];
          data.set(page, offset);
          if (i === frame.data.length - 1) {
            offset += frame.cursor;
          } else {
            offset += frame.pageSize;
          }
        }
      }
      image = new Blob([data], {
        type: 'image/gif'
      });
      return this.emit('finished', image, data);
    }

    renderNextFrame() {
      var frame, task, worker;
      if (this.freeWorkers.length === 0) {
        throw new Error('No free workers');
      }
      if (this.nextFrame >= this.frames.length) { // no new frame to render
        return;
      }
      frame = this.frames[this.nextFrame++];
      worker = this.freeWorkers.shift();
      task = this.getTask(frame);
      this.log(`starting frame ${task.index + 1} of ${this.frames.length}`);
      this.activeWorkers.push(worker);
      return worker.postMessage(task); //, [task.data.buffer]
    }

    getContextData(ctx) {
      return ctx.getImageData(0, 0, this.options.width, this.options.height).data;
    }

    getImageData(image) {
      var ctx;
      if (this._canvas == null) {
        this._canvas = document.createElement('canvas');
        this._canvas.width = this.options.width;
        this._canvas.height = this.options.height;
      }
      ctx = this._canvas.getContext('2d');
      ctx.fillStyle = this.options.background;
      ctx.fillRect(0, 0, this.options.width, this.options.height);
      ctx.drawImage(image, 0, 0);
      return this.getContextData(ctx);
    }

    getTask(frame) {
      var index, task;
      index = this.frames.indexOf(frame);
      task = {
        index: index,
        last: index === (this.frames.length - 1),
        delay: frame.delay,
        dispose: frame.dispose,
        transparent: frame.transparent,
        width: this.options.width,
        height: this.options.height,
        quality: this.options.quality,
        dither: this.options.dither,
        globalPalette: this.options.globalPalette,
        repeat: this.options.repeat,
        canTransfer: browser.name === 'chrome'
      };
      if (frame.data != null) {
        task.data = frame.data;
      } else if (frame.context != null) {
        task.data = this.getContextData(frame.context);
      } else if (frame.image != null) {
        task.data = this.getImageData(frame.image);
      } else {
        throw new Error('Invalid frame');
      }
      return task;
    }

    log(...args) {
      if (!this.options.debug) {
        return;
      }
      return console.log(...args);
    }

  };

  defaults = {
    workerScript: 'gif.worker.js',
    workers: 2,
    repeat: 0, // repeat forever, -1 = repeat once
    background: '#fff',
    quality: 10, // pixel sample interval, lower is better
    width: null, // size derermined from first frame if possible
    height: null,
    transparent: null,
    debug: false,
    dither: false // see GIFEncoder.js for dithering options
  };

  frameDefaults = {
    delay: 500, // ms
    copy: false,
    dispose: -1
  };

  return GIF;

}).call(this);

module.exports = GIF;


},{"./browser.coffee":2,"events":1}]},{},[3])(3)
});
//# sourceMappingURL=gif.js.map

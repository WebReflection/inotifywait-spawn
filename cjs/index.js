'use strict';
/*!
 * ISC License
 *
 * Copyright (c) 2019, Andrea Giammarchi, @WebReflection
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
 * REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
 * AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
 * INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
 * LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE
 * OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
 * PERFORMANCE OF THIS SOFTWARE.
 */

// dependencies
const {EventEmitter} = require('events');
const {spawn} = require('child_process');
const {resolve} = require('path');

// constants
// https://github.com/rvoicilas/inotify-tools/blob/master/libinotifytools/src/inotifytools/inotify-nosys.h#L29
const IN_ACCESS =         0x00000001;
const IN_MODIFY =         0x00000002;
const IN_CLOSE_WRITE =    0x00000008;
const IN_CLOSE_NOWRITE =  0x00000010;
const IN_OPEN =           0x00000020;
const IN_MOVED_FROM =     0x00000040;
const IN_MOVED_TO =       0x00000080;
const IN_CREATE =         0x00000100;
const IN_DELETE =         0x00000200;
const IN_DELETE_SELF =    0x00000400;
const IN_MOVE_SELF =      0x00000800;
const IN_UNMOUNT =        0x00002000;
const IN_CLOSE =          IN_CLOSE_WRITE | IN_CLOSE_NOWRITE;
const IN_MOVE =           IN_MOVED_FROM | IN_MOVED_TO;

// utils
const EVENTS = {
  IN_ACCESS,
  IN_MODIFY,
  IN_CLOSE_WRITE,
  IN_CLOSE_NOWRITE,
  IN_OPEN,
  IN_MOVED_FROM,
  IN_MOVED_TO,
  IN_CREATE,
  IN_DELETE,
  IN_DELETE_SELF,
  IN_MOVE_SELF,
  IN_UNMOUNT,
  IN_CLOSE,
  IN_MOVE,
  byName: name => EVENTS[`IN_${name}`]
};

const wm = new WeakMap;

const {split} = '';

const hOP = {}.hasOwnProperty;
const getDefault = (options, key, value) =>
  hOP.call(options, key) ? options[key] : value;

const clean = self => {
  const inotifywait = wm.get(self);
  wm.delete(self);
  return inotifywait;
};

// exported class INotifyWait
module.exports = Object.assign(
  class INotifyWait extends EventEmitter {
    constructor(
      path,               // a single path, or a list of paths, each
                          // representing either a file or a folder
      options = {
        exclude: null,    // a RegExp to exclude files (passed as shell argument)
        include: null,    // a RegExp to include files (passed as shell argument)
                          // Please note `include` option requires inotifywait 3.20+
        persistent: true, // keep watching until .stop()
        recursive: false, // recursive within folders
        events: 0         // one or more events to listen for
                          // if omitted, all events are listened
      }
    ) {
      super();
      const {exclude, include} = options;
      const persistent = getDefault(options, 'persistent', true);
      const recursive = getDefault(options, 'recursive', false);
      const events = getDefault(options, 'events', 0);
      const args = ['--format', '%e|%w%f', '-q'];
      if (persistent)
        args.push('-m');
      if (recursive)
        args.push('-r');
      if (exclude) {
        args.push(
          `--exclude${exclude.flags.includes('i') ? 'i' : ''}`,
          exclude.source
        );
      }
      if (include) {
        args.push(
          `--include${include.flags.includes('i') ? 'i' : ''}`,
          include.source
        );
      }
      if (events) {
        const close = IN_CLOSE & events &&
                      IN_CLOSE_WRITE & events &&
                      IN_CLOSE_NOWRITE & events;
        const move =  IN_MOVE & events &&
                      IN_MOVED_FROM & events &&
                      IN_MOVED_TO & events;

        // https://github.com/rvoicilas/inotify-tools/blob/master/libinotifytools/src/inotifytools.c#L659
        if (IN_ACCESS & events)
          args.push('-e', 'access');
        if (IN_MODIFY & events)
          args.push('-e', 'modify');
        if (IN_CLOSE_WRITE & events && !close)
          args.push('-e', 'close_write');
        if (IN_CLOSE_NOWRITE & events && !close)
          args.push('-e', 'close_nowrite');
        if (IN_OPEN & events)
          args.push('-e', 'open');
        if (IN_MOVED_FROM & events && !move)
          args.push('-e', 'moved_from');
        if (IN_MOVED_TO & events && !move)
          args.push('-e', 'moved_to');
        if (IN_CREATE & events)
          args.push('-e', 'create');
        if (IN_DELETE & events)
          args.push('-e', 'delete');
        if (IN_DELETE_SELF & events)
          args.push('-e', 'delete_self');
        if (IN_MOVE_SELF & events)
          args.push('-e', 'move_self');
        if (IN_UNMOUNT & events)
          args.push('-e', 'unmount');
        if (close)
          args.push('-e', 'close');
        if (move)
          args.push('-e', 'move');
      }

      const paths = [].concat(path).map(path => resolve(path));
      this.paths = paths;

      const inotifywait = spawn(
        'inotifywait',
        args.concat(paths),
        {
          detached: true,
          stdio: ['ignore', 'pipe', 'pipe']
        }
      ).on('close', close.bind(this));

      const {stdout, stderr} = inotifywait;
      stderr.on('data', error.bind(this));

      stdout.on('data', data => {
        const output = split.call(data, /[\r\n]+/);
        for (let i = 0, {length} = output; i < length; i++) {
          const line = output[i];
          if (line !== '') {
            const index = line.indexOf('|');
            const events = line.slice(0, index).split(',').map(EVENTS.byName);
            const fullPath = line.slice(1 + index);
            for (let i = 0, {length} = paths; i < length; i++) {
              const path = paths[i];
              const pLength = path.length;
              if (fullPath.slice(0, pLength) === path) {
                const entry = line.slice(1 + index + pLength + 1);
                for (let i = 0, {length} = events; i < length; i++) {
                  const type = events[i];
                  this.emit(type, {type, path, entry});
                }
              }
            }
          }
        }
      });

      wm.set(this, inotifywait);
    }
    stop() {
      if (wm.has(this)) {
        this.removeAllListeners();
        clean(this).kill();
      }
    }
  },
  EVENTS
);

function close(code) {
  if (wm.has(this)) {
    clean(this);
    throw new Error(`inotifywait exited with code ${code}`);
  }
}

function error(data) {
  this.emit('error', `${data}`);
}

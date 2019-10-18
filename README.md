# inotifywait-spawn

[![Build Status](https://travis-ci.com/WebReflection/inotifywait-spawn.svg?branch=master)](https://travis-ci.com/WebReflection/inotifywait-spawn) [![Coverage Status](https://coveralls.io/repos/github/WebReflection/inotifywait-spawn/badge.svg?branch=master)](https://coveralls.io/github/WebReflection/inotifywait-spawn?branch=master)

A zero dependencies, 100% code covered, [inotifywait](https://linux.die.net/man/1/inotifywait) wrap based on [inotify-tools](https://github.com/rvoicilas/inotify-tools/wiki) and [spawn](https://nodejs.org/api/child_process.html#child_process_child_process_spawn_command_args_options).


## API

```js
// listen to events via:
// inw.on(INotifyWait.IN_CLOSE, (type, ...extras));
class INotifyWait extends EventEmitter {

  constructor(
    path,               // a *single* string path representing
                        // either a file or a folder
    options = {
      exclude: null,    // a RegExp to exclude files (passed as shell argument)
      include: null,    // a RegExp to include files (passed as shell argument)
                        // Please note `include` option requires inotifywait 3.20+
      persistent: true, // keep watching until .stop()
      recursive: false, // recursive within folders
      events: 0         // one or more events to listen for
                        // if omitted, all events are listened
    }
  ) {}

  // kill the subprocess and stop listening to any event
  stop() {}
}
```

For RegExp properties, use the `/*\.txt/i` flag to make it case insensitive.

Please read [inotifywait man page](https://linux.die.net/man/1/inotifywait) to know more about the underlying features offered by `include` and `exclude`.


#### Why Yet Another `inotify` Project ?

Because every other project has either problems compiling code in this or that version of NodeJS, or it's been unmaintained for months or years, with growing amount of bugs.

This project wants to keep it both simple and portable, relying on system [inotifywait](https://linux.die.net/man/1/inotifywait), avoiding any present or future issue with native/compiled code, making it easy to bring and work with on ARM and other IoT devices too.

Where there is NodeJS, and there is `inotifywait`, this project might be all you need.


### Example

```js
const INotifyWait = require('inotifywait-spawn');
const {IN_CLOSE_WRITE, IN_DELETE, IN_MODIFY} = INotifyWait;

// single file
const inw = new INotifyWait('test.txt', {events: IN_DELETE | IN_CLOSE_WRITE});
inw.on('error', console.error);
inw.on(IN_DELETE, type => console.log('file removed'));
inw.on(IN_CLOSE_WRITE, type => console.log('file ready to be read'));

// folder
const inw = new INotifyWait('.', {recursive: true, events: IN_MODIFY});
inw.on('error', console.error);
inw.on(IN_MODIFY, (type, subpath) => {
  type === IN_MODIFY; // the event type is always passed
  console.log(`${subpath} modified in ${inw.path}`);
  // every INotifyWait instance will have a resolved inw.path property
  // pointing at the watched file or folder
});
```

Please check [test/index.js](./test/index.js) to see or know more.


### Events

Following the list of events supported and available via `inotifywait`.

These events are better described in the [inotify documentation](http://man7.org/linux/man-pages/man7/inotify.7.html).

  * `IN_ACCESS`, to be notified on file access
  * `IN_MODIFY`, to be notified on changes
  * `IN_CLOSE_WRITE`, to be notified on end writing
  * `IN_CLOSE_NOWRITE`, to be notified on end reading
  * `IN_OPEN`, to be notified on file opened
  * `IN_MOVED_FROM`, to be notified on files moved from
  * `IN_MOVED_TO`, to be notified on files move to
  * `IN_CREATE`, to be notified on files creation (folder)
  * `IN_DELETE`, to be notified on deletion (folder)
  * `IN_DELETE_SELF`, to be notified on deletion of the watched path
  * `IN_MOVE_SELF`, to be notified when watched path is moved
  * `IN_UNMOUNT`, to be notified on patsh unmounted
  * `IN_CLOSE`, to be notified on either `IN_CLOSE_WRITE` or `IN_CLOSE_NOWRITE`
  * `IN_MOVE`, to be notified on either `IN_MOVED_FROM` or `IN_MOVED_TO`


### Compatibility
Fully tested on ArchLinux from NodeJS 6 to latest, this should work with every other Linux distribution that offers `inotify-tools` and `inotifywait` with it.

Please note that **some options might not be available** with older versions of `inotifywait`, like it is for `include` in current Ubuntu and `inotifywait` version < 3.20.


### Caveats & F.A.Q.

  * if you create dozen instances, you're better off with a single instance that watch a folder recursively, as you might know already `spawn` has a cost.
  * apparently `inotifywait` has bad reputation when watching folders recursively, be sure you know all the caveats and behave accordingly.

import os
from multiprocessing import Process
from inotify_simple import INotify, flags, parse_events

class EventEmitter:
  def __init__(self):
    self.__events = dict()

  def emit(self, type, data):
    if type in self.__events:
      for callback in self.__events[type]:
        callback(data)

  def on(self, type, callback):
    if not type in self.__events:
      self.__events[type] = []
    self.__events[type].append(callback)

  def removeListener(self, type, callback):
    if type in self.__events:
      for cb in self.__events[type]:
        if cb == callback:
          self.__events[type].remove(callback)
          return

  def removeAllListeners(self):
    self.__events = dict()

class INotifyWait(EventEmitter):

  IN_ACCESS =         flags.ACCESS
  IN_MODIFY =         flags.MODIFY
  IN_CLOSE_WRITE =    flags.CLOSE_WRITE
  IN_CLOSE_NOWRITE =  flags.CLOSE_NOWRITE
  IN_OPEN =           flags.OPEN
  IN_MOVED_FROM =     flags.MOVED_FROM
  IN_MOVED_TO =       flags.MOVED_TO
  IN_CREATE =         flags.CREATE
  IN_DELETE =         flags.DELETE
  IN_DELETE_SELF =    flags.DELETE_SELF
  IN_MOVE_SELF =      flags.MOVE_SELF
  IN_UNMOUNT =        flags.UNMOUNT
  IN_CLOSE =          flags.CLOSE_WRITE | flags.CLOSE_NOWRITE
  IN_MOVE =           flags.MOVED_FROM  | flags.MOVED_TO

  def __init__(self, path, options):
    super(INotifyWait, self).__init__()
    if str(path) == path:
      self.paths = [os.path.abspath(path)]
    else:
      self.paths = []
      for p in path:
        self.path.append(os.path.abspath(p))
    self.__active = True
    self.__process = None
    self.__inotify = INotify()

    # TODO: find a way to screen events emitted from unrelated paths
    for path in self.paths:
      self.__inotify.add_watch(path, options.get('events'))

  def on(self, type, callback):
    if self.__active:
      super().on(type, callback)
      if self.__process is not None:
        self.__process.terminate()
      self.__process = Process(target=self.__inotifyRead)
      self.__process.start()

  def stop(self):
    if self.__active:
      self.__active = False
      self.__process.terminate()
      self.__inotify.close()

  def __inotifyRead(self):
    while self.__active:
      for event in self.__inotify.read():
        for flag in flags.from_mask(event.mask):
          for path in self.paths:
            self.emit(flag, {'type': flag, 'path': path, 'entry': event.name})

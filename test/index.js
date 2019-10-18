const DELAY = 500;

const {writeFile, unlink} = require('fs');
const {execSync, spawnSync} = require('child_process');

const noInclude = !/\s--includei?\s/.test(spawnSync('inotifywait', ['-h']).output[1]);

const expectedError = err => console.error('expected error');

const INotifyWait = require('../cjs');

const cleanUP = cb => {
  unlink('test.txt', () => {
    unlink('another file.txt', () => {
      unlink('test/recursive.txt', cb);
    });
  });
};

const assert = (condition, message) => {
  console.assert(condition, message);
  if (condition)
    console.log(` \x1B[32m✔\x1B[0m ${message}`);
  else
    cleanUP(() => process.exit(1));
};

const args = [];
const {push} = args;
Array.prototype.push = function (command) {
  switch (command) {
    case '-m':
    case '-r':
    case '--exclude':
    case '--excludei':
    case '--include':
    case '--includei':
    case '-e':
      push.apply(args, arguments);
      break;
  }
  return push.apply(this, arguments);
};

args.splice(0);
new INotifyWait('.').stop();
assert(args.join(',') === '-m', 'no args');

args.splice(0);
new INotifyWait('.', {persistent: false}).stop();
assert(args.join(',') === '', 'not persistent');

args.splice(0);
new INotifyWait('.', {recursive: true}).stop();
assert(args.join(',') === '-m,-r', 'recursive');

args.splice(0);
new INotifyWait('.', {exclude: /test/}).stop();
assert(args.join(',') === '-m,--exclude,test', 'exclude');

args.splice(0);
new INotifyWait('.', {exclude: /test/i}).stop();
assert(args.join(',') === '-m,--excludei,test', 'excludei');

if (noInclude)
  process.on('uncaughtException', expectedError);
args.splice(0);
new INotifyWait('.', {include: /test/}).on('error', expectedError).stop();
assert(args.join(',') === '-m,--include,test', 'include');

args.splice(0);
new INotifyWait('.', {include: /test/i}).on('error', expectedError).stop();
assert(args.join(',') === '-m,--includei,test', 'includei');


args.splice(0);
new INotifyWait('.', {events: INotifyWait.IN_ACCESS}).stop();
assert(args.join(',') === '-m,-e,access', 'IN_ACCESS');

args.splice(0);
new INotifyWait('.', {events: INotifyWait.IN_MODIFY}).stop();
assert(args.join(',') === '-m,-e,modify', 'IN_MODIFY');

args.splice(0);
new INotifyWait('.', {events: INotifyWait.IN_CLOSE_WRITE}).stop();
assert(args.join(',') === '-m,-e,close_write', 'IN_CLOSE_WRITE');

args.splice(0);
new INotifyWait('.', {events: INotifyWait.IN_CLOSE_NOWRITE}).stop();
assert(args.join(',') === '-m,-e,close_nowrite', 'IN_CLOSE_NOWRITE');

args.splice(0);
new INotifyWait('.', {events: INotifyWait.IN_OPEN}).stop();
assert(args.join(',') === '-m,-e,open', 'IN_OPEN');

args.splice(0);
new INotifyWait('.', {events: INotifyWait.IN_MOVED_FROM}).stop();
assert(args.join(',') === '-m,-e,moved_from', 'IN_MOVED_FROM');

args.splice(0);
new INotifyWait('.', {events: INotifyWait.IN_MOVED_TO}).stop();
assert(args.join(',') === '-m,-e,moved_to', 'IN_MOVED_TO');

args.splice(0);
new INotifyWait('.', {events: INotifyWait.IN_CREATE}).stop();
assert(args.join(',') === '-m,-e,create', 'IN_CREATE');

args.splice(0);
new INotifyWait('.', {events: INotifyWait.IN_DELETE}).stop();
assert(args.join(',') === '-m,-e,delete', 'IN_DELETE');

args.splice(0);
new INotifyWait('.', {events: INotifyWait.IN_DELETE_SELF}).stop();
assert(args.join(',') === '-m,-e,delete_self', 'IN_DELETE_SELF');

args.splice(0);
new INotifyWait('.', {events: INotifyWait.IN_MOVE_SELF}).stop();
assert(args.join(',') === '-m,-e,move_self', 'IN_MOVE_SELF');

args.splice(0);
new INotifyWait('.', {events: INotifyWait.IN_UNMOUNT}).stop();
assert(args.join(',') === '-m,-e,unmount', 'IN_UNMOUNT');

args.splice(0);
new INotifyWait('.', {events: INotifyWait.IN_CLOSE}).stop();
assert(args.join(',') === '-m,-e,close', 'IN_CLOSE');

args.splice(0);
new INotifyWait('.', {events: INotifyWait.IN_MOVE}).stop();
assert(args.join(',') === '-m,-e,move', 'IN_MOVE');

args.splice(0);
new INotifyWait('.', {events: INotifyWait.IN_CLOSE | INotifyWait.IN_MOVE}).stop();
assert(args.join(',') === '-m,-e,close,-e,move', 'IN_CLOSE | IN_MOVE');

args.splice(0);
let inw = new INotifyWait('.', {events: INotifyWait.IN_CLOSE_WRITE | INotifyWait.IN_MOVE});
inw.stop();
inw.stop();
assert(args.join(',') === '-m,-e,close_write,-e,move', 'IN_CLOSE_WRITE | IN_MOVE');

args.splice(0);
Array.prototype.push = push;

setTimeout(cleanUP, DELAY, () => {
  process.on('uncaughtException', function uncaughtException() {
    process.removeListener('uncaughtException', uncaughtException);
    writeFile('test.txt', '', () => {
      execSync('sync');
      inw = new INotifyWait(['test.txt', 'node_modules'], {events: INotifyWait.IN_CLOSE_WRITE});
      inw.on(INotifyWait.IN_CLOSE_WRITE, ({type}) => {
        assert(INotifyWait.IN_CLOSE_WRITE === type, 'expected IN_CLOSE_WRITE');
        inw.stop();
        unlink('test.txt', () => {
          let created = false;
          inw = new INotifyWait('.', {recursive: true, events: INotifyWait.IN_CREATE | INotifyWait.IN_MODIFY});
          inw.on(INotifyWait.IN_CREATE, ({type, entry}) => {
            assert(INotifyWait.IN_CREATE === type, 'expected IN_CREATE');
            assert(entry === 'another file.txt', 'expected details IN_CREATE');
            created = true;
          });
          inw.on(INotifyWait.IN_MODIFY, ({type, entry}) => {
            assert(INotifyWait.IN_MODIFY === type, 'expected folder IN_MODIFY');
            assert(entry === 'another file.txt', 'expected details IN_MODIFY');
            assert(created, 'file was previously created');
            unlink('another file.txt', () => {
              inw.removeAllListeners();
              inw.on(INotifyWait.IN_CREATE, ({type, entry}) => {
                assert(INotifyWait.IN_CREATE === type, 'expected recursive IN_CREATE');
                assert(entry === 'test/recursive.txt', 'expected recursive details IN_CREATE');
                inw.stop();
                console.log('');
                unlink('test/recursive.txt', Object);
              });
              setTimeout(() => {
                writeFile('test/recursive.txt', '', Object);
              }, DELAY);
            });
          });
          setTimeout(() => {
            writeFile('another file.txt', 'some data', Object);
          }, DELAY);
        });
      });
      writeFile('test.txt', 'some data', Object);
    });
  });
  
  inw = new INotifyWait('test.txt', {events: INotifyWait.IN_CLOSE_WRITE});
  inw.on('error', Object);
});

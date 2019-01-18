const Monitor = require('../src');
const assert = require('assert');

suite('BaseMonitor', function() {
  let monitor;
  setup(function() {
    monitor = new Monitor({
      projectName: 'taskcluster-testing-service',
      mock: {
        allowExit: true,
      },
    });
  });

  suite('timer', function() {
    const takes100ms = () => new Promise(resolve => setTimeout(() => resolve(13), 100));
    const checkMonitor = (len) => {
      // check this after a short delay, as otherwise the Promise.resolve
      // can measure something after timer returns..
      return new Promise(resolve => setTimeout(resolve, 10)).then(() => {
        assert.equal(monitor.events.length, len);
        monitor.events.forEach(m => assert.equal(m.Type, 'root.pfx'));
      });
    };

    test('of a sync function', async function() {
      assert.equal(monitor.timer('pfx', () => 13), 13);
      await checkMonitor(1);
    });

    test('of a sync function that fails', async function() {
      assert.throws(() => {
        monitor.timer('pfx', () => { throw new Error('uhoh'); });
      }, /uhoh/);
      await checkMonitor(1);
    });

    test('of an async function', async function() {
      assert.equal(await monitor.timer('pfx', takes100ms), 13);
      await checkMonitor(1);
      assert(monitor.events[0].Fields.val >= 90);
    });

    test('of an async function that fails', async function() {
      let err;
      try {
        await monitor.timer('pfx', async () => { throw new Error('uhoh'); });
      } catch (e) {
        err = e;
      }
      assert(err && /uhoh/.test(err.message));
      await checkMonitor(1);
    });

    test('of a promise', async function() {
      assert.equal(await monitor.timer('pfx', takes100ms()), 13);
      await checkMonitor(1);
      assert(monitor.events[0].Fields.val >= 90);
    });

    test('of a failed promise', async function() {
      let err;
      try {
        await monitor.timer('pfx', Promise.reject(new Error('uhoh')));
      } catch (e) {
        err = e;
      }
      assert(err && /uhoh/.test(err.message));
      await checkMonitor(1);
    });
  });

  suite('oneShot', function() {
    const oldExit = process.exit;
    let exitStatus = null;

    suiteSetup('mock exit', function() {
      process.exit = (s) => { exitStatus = s; };
    });

    suiteTeardown('unmock exit', function() {
      process.exit = oldExit;
    });

    setup('clear exitStatus', function() {
      exitStatus = null;
    });

    test('successful async function', async function() {
      await monitor.oneShot('expire', async () => {});
      assert.equal(exitStatus, 0);
      assert.equal(monitor.events[0].Type, 'root.expire.duration');
      assert.equal(monitor.events[1].Type, 'root.expire.done');
      assert.equal(monitor.events.length, 2);
    });

    test('unsuccessful async function', async function() {
      await monitor.oneShot('expire', async () => { throw new Error('uhoh'); });
      assert.equal(exitStatus, 1);
      assert.equal(monitor.events[0].Type, 'root.expire.duration');
      assert.equal(monitor.events.length, 2);
      assert.equal(monitor.events[1].Fields.error, 'Error: uhoh');
    });

    test('missing name', async function() {
      await monitor.oneShot(async () => { throw new Error('uhoh'); });
      assert.equal(exitStatus, 1);
      assert(monitor.events[0].Fields.error.startsWith('AssertionError'));
    });
  });
});

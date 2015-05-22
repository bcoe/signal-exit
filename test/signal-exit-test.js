/* global describe, it */

var exec = require('child_process').exec,
  expect = require('chai').expect,
  assert = require('assert')

require('chai').should()
require('tap').mochaGlobals()

var onSignalExit = require('../')

process.env.NYC_TEST = 'yep'

describe('signal-exit', function () {
  it('receives an exit event when a process exits normally', function (done) {
    exec(process.execPath + ' ./test/fixtures/end-of-execution.js', function (err, stdout, stderr) {
      expect(err).to.equal(null)
      stdout.should.match(/reached end of execution, 0, null/)
      done()
    })
  })

  it('receives an exit event when a process is terminated with sigint', function (done) {
    exec(process.execPath + ' ./test/fixtures/sigint.js', function (err, stdout, stderr) {
      assert(err)
      stdout.should.match(/exited with sigint, null, SIGINT/)
      done()
    })
  })

  it('receives an exit event when a process is terminated with sigterm', function (done) {
    exec(process.execPath + ' ./test/fixtures/sigterm.js', function (err, stdout, stderr) {
      assert(err)
      stdout.should.match(/exited with sigterm, null, SIGTERM/)
      done()
    })
  })

  it('receives an exit event when process.exit() is called', function (done) {
    exec(process.execPath + ' ./test/fixtures/exit.js', function (err, stdout, stderr) {
      err.code.should.equal(32)
      stdout.should.match(/exited with process\.exit\(\), 32, null/)
      done()
    })
  })

  it('does not exit if user handles signal', function (done) {
    exec(process.execPath + ' ./test/fixtures/signal-listener.js', function (err, stdout, stderr) {
      assert(err)
      assert.equal(stdout, 'exited calledListener=4, code=null, signal="SIGHUP"\n')
      done()
    })
  })

  it('ensures that if alwaysLast=true, the handler is run last (signal)', function (done) {
    exec(process.execPath + ' ./test/fixtures/signal-last.js', function (err, stdout, stderr) {
      assert(err)
      stdout.should.match(/first counter=1/)
      stdout.should.match(/last counter=2/)
      done()
    })
  })

  it('ensures that if alwaysLast=true, the handler is run last (normal exit)', function (done) {
    exec(process.execPath + ' ./test/fixtures/exit-last.js', function (err, stdout, stderr) {
      assert.ifError(err)
      stdout.should.match(/first counter=1/)
      stdout.should.match(/last counter=2/)
      done()
    })
  })

  it('works when loaded multiple times', function (done) {
    exec(process.execPath + ' ./test/fixtures/multiple-load.js', function (err, stdout, stderr) {
      assert(err)
      stdout.should.match(/first counter=1, code=null, signal="SIGHUP"/)
      stdout.should.match(/first counter=2, code=null, signal="SIGHUP"/)
      stdout.should.match(/last counter=3, code=null, signal="SIGHUP"/)
      stdout.should.match(/last counter=4, code=null, signal="SIGHUP"/)
      done()
    })
  })

  it('removes handlers when fully unwrapped', function (done) {
    exec(process.execPath + ' ./test/fixtures/unwrap.js', function (err, stdout, stderr) {
      assert(err)
      err.signal.should.equal('SIGHUP')
      expect(err.code).to.equal(null)
      done()
    })
  })

  it('does not load() or unload() more than once', function (done) {
    exec(process.execPath + ' ./test/fixtures/load-unload.js', function (err, stdout, stderr) {
      assert.ifError(err)
      done()
    })
  })

  it('handles uncatchable signals with grace and poise', function (done) {
    exec(process.execPath + ' ./test/fixtures/sigkill.js', function (err, stdout, stderr) {
      assert.ifError(err)
      done()
    })
  })

  // These are signals that are aliases for other signals, so
  // the result will sometimes be one of the others.  For these,
  // we just verify that we GOT a signal, not what it is.
  function weirdSignal (sig) {
    return sig === 'SIGIOT' ||
      sig === 'SIGIO' ||
      sig === 'SIGSYS' ||
      sig === 'SIGIOT' ||
      sig === 'SIGABRT' ||
      sig === 'SIGPOLL' ||
      sig === 'SIGUNUSED'
  }

  // Exhaustively test every signal, and a few numbers.
  var signals = onSignalExit.signals()
  signals.concat('', 0, 1, 2, 3, 54).forEach(function (sig) {
    var node = process.execPath
    var js = require.resolve('./fixtures/exiter.js')
    it('exits properly: ' + sig, function (done) {
      exec(node + ' ' + js + ' ' + sig, function (err, stdout, stderr) {
        if (sig) {
          assert(err)
          if (!isNaN(sig)) {
            assert.equal(err.code, sig)
          } else if (!weirdSignal(sig)) {
            err.signal.should.equal(sig)
          } else if (sig) {
            assert(err.signal)
          }
        } else {
          assert.ifError(err)
        }

        try {
          var data = JSON.parse(stdout)
        } catch (er) {
          console.error('invalid json: %j', stdout, stderr)
          throw er
        }

        if (weirdSignal(sig)) {
          data.wanted[1] = true
          data.found[1] = !!data.found[1]
        }
        assert.deepEqual(data.found, data.wanted)
        done()
      })
    })
  })

  signals.forEach(function (sig) {
    var node = process.execPath
    var js = require.resolve('./fixtures/parent.js')
    it('exits properly: (external sig) ' + sig, function (done) {
      var cmd = node + ' ' + js + ' ' + sig
      exec(cmd, function (err, stdout, stderr) {
        assert.ifError(err)
        try {
          var data = JSON.parse(stdout)
        } catch (er) {
          console.error('invalid json: %j', stdout, stderr)
          throw er
        }

        assert.deepEqual(data.found, data.wanted)
        assert.deepEqual(data.external, data.wanted)
        done()
      })
    })
  })
})

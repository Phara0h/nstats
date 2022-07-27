const fp = require('fastify-plugin');

class NStats {
  constructor(ws, httpServer, server_version) {
    this.clients = ws.clients || null;
    this.httpServer = httpServer;
    this.lastCalc = 0;
    this.ignored_routes = [];
    this.interval = 1000;
    var pre_release = 0;

    if (server_version.indexOf('-') > -1) {
      var ssv = server_version.split('-');

      server_version = ssv[0];
      pre_release = ssv[1].replace(/[^0-9]/g, '');
    }
    this.data = {
      server_version_major: Number(server_version.split('.')[0].replace(/[^0-9]/g, '')) || 0,
      server_version_minor: Number(server_version.split('.')[1].replace(/[^0-9]/g, '')) || 0,
      server_version_patch: Number(server_version.split('.')[2].replace(/[^0-9]/g, '')) || 0,
      server_version_pre: pre_release,
      uptime: 0,
      totalMemory: 0,
      activeSockets: 0,
      responseOverhead: {
        avg: 0,
        highest: 0,
        lowest: 9999,
        total: 0
      },
      responseOverheadHistogram: {
        bucket: [
          {
            count: 0,
            check: 0.01
          },
          {
            count: 0,
            check: 0.05
          },
          {
            count: 0,
            check: 0.1
          },
          {
            count: 0,
            check: 0.2
          },
          {
            count: 0,
            check: 0.3
          },
          {
            count: 0,
            check: 0.4
          },
          {
            count: 0,
            check: 0.5
          },
          {
            count: 0,
            check: 0.6
          },
          {
            count: 0,
            check: 0.7
          },
          {
            count: 0,
            check: 0.8
          },
          {
            count: 0,
            check: 0.9
          },
          {
            count: 0,
            check: 1
          }
        ],
        sum: 0,
        count: 0
      },
      avgWriteKBs: 0,
      avgReadKBs: 0,
      avgPacketsSecond: 0,
      totalBytesWritten: 0,
      totalMBytesWritten: 0,
      totalBytesRead: 0,
      totalMBytesRead: 0,
      writeKBS: 0,
      readKBS: 0,
      packetsSecond: 0,
      totalPackets: 0,
      http_requests: {}
    };

    this._pdata = {
      bytesWritten: 0,
      bytesRead: 0,
      packets: 0
    };

    this.calc();
  }
  fastify() {
    return fp(
      (fastify, opts, done) => {
        this.ignored_routes = opts.ignored_routes || [];

        fastify.addHook('onRequest', (req, res, next) => {
          if (!this.httpServer) {
            this.httpServer = req.raw.connection.server;
          }

          if (opts.ignore_non_router_paths && !req.routerPath) {
            next();
            return;
          }
          if (this.ignored_routes.indexOf(req.url) > -1) {
            next();
            return;
          }

          var sTime = process.hrtime.bigint();

          res.raw.on('finish', () => {
            req.raw.routerPath = req.routerPath;
            this.addWeb(req.raw, res.raw, sTime);
          });
          next();
        });
        done();
      },
      {
        fastify: '4.x',
        name: 'nstats'
      }
    );
  }
  express(req, res, next) {
    return (req, res, next) => {
      if (!this.httpServer) {
        this.httpServer = req.connection.server;
      }
      var sTime = process.hrtime.bigint();

      res.on('finish', () => {
        this.addWeb(req, res, sTime);
      });
      next();
    };
  }

  addWeb(req, res, sTime) {
    if (res) {
      var routerPath = req.routerPath || '_nstats_na';

      if (!this.data.http_requests[req.method]) {
        this.data.http_requests[req.method] = {};
      }

      if (!this.data.http_requests[req.method][res.statusCode]) {
        this.data.http_requests[req.method][res.statusCode] = {};
      }

      if (!this.data.http_requests[req.method][res.statusCode][routerPath]) {
        this.data.http_requests[req.method][res.statusCode][routerPath] = { count: 0, response: 0 };
      }

      this.data.http_requests[req.method][res.statusCode][routerPath].count++;
    }

    if (sTime) {
      var sTimeMS = Number(process.hrtime.bigint() - sTime) / 1000000;

      if (res) {
        this.data.http_requests[req.method][res.statusCode][routerPath].response += sTimeMS;
      }
      this._calcOverhead(sTimeMS);
    }

    this._pdata.bytesRead += req.socket.bytesRead - (req.socket['nstats_bytesRead'] || 0);
    this._pdata.bytesWritten += req.socket.bytesWritten - (req.socket['nstats_bytesWritten'] || 0);
    req.socket['nstats_bytesRead'] = req.socket.bytesRead;
    req.socket['nstats_bytesWritten'] = req.socket.bytesWritten;
    this.data.totalPackets++;
    this._pdata.packets++;
  }

  toJson() {
    return JSON.stringify(this.data);
  }

  toPrometheus() {
    var pstring = '';

    pstring += `nstats_server_version{major="${this.data.server_version_major}", minor="${this.data.server_version_minor}", patch="${this.data.server_version_patch}", pre="${this.data.server_version_pre}"} 1 \n`;
    var flatData = this._flattenObjectPrometheus(this.data, '');
    var keys = Object.keys(flatData);

    for (var i = 0; i < keys.length; i++) {
      if (keys[i].indexOf('http') == -1 && keys[i].indexOf('responseOverheadHistogram') == -1) {
        pstring += `
# HELP nstats_${keys[i]} nstats metric
# TYPE nstats_${keys[i]} counter
nstats_${keys[i]} ${flatData[keys[i]]}`;
      }
    }

    if (this.data.http_requests) {
      pstring += '';
      var methods = Object.keys(this.data.http_requests);

      for (var i = 0; i < methods.length; i++) {
        var status = Object.keys(this.data.http_requests[methods[i]]);

        for (var j = 0; j < status.length; j++) {
          var routes = Object.keys(this.data.http_requests[methods[i]][status[j]]);

          for (var k = 0; k < routes.length; k++) {
            var route = routes[k];

            if (route == '_nstats_na') {
              pstring += `
nstats_http_request_count{method="${methods[i]}",status="${status[j]}"} ${
                this.data.http_requests[methods[i]][status[j]]['_nstats_na'].count
              }
nstats_http_request_response_time_count{method="${methods[i]}",status="${status[j]}"} ${
                this.data.http_requests[methods[i]][status[j]]['_nstats_na'].response
              }`;
            } else {
              pstring += `
nstats_http_request_count{method="${methods[i]}",status="${status[j]}",route="${route}"} ${
                this.data.http_requests[methods[i]][status[j]][route].count
              }
nstats_http_request_response_time_count{method="${methods[i]}",status="${status[j]}",route="${route}"} ${
                this.data.http_requests[methods[i]][status[j]][route].response
              }`;
            }
          }
        }
      }
    }

    if (this.data.responseOverheadHistogram) {
      pstring += `
# HELP nstats_responseOverheadHistogram nstats metric
# TYPE nstats_responseOverheadHistogram histogram`;
      for (var i = 0; i < this.data.responseOverheadHistogram.bucket.length; i++) {
        pstring += `
nstats_responseOverheadHistogram_bucket{le="${this.data.responseOverheadHistogram.bucket[i].check}"} ${this.data.responseOverheadHistogram.bucket[i].count}`;
      }
      pstring += `
nstats_responseOverheadHistogram_bucket{le="+Inf"} ${this.data.responseOverheadHistogram.count}
nstats_responseOverheadHistogram_sum ${this.data.responseOverheadHistogram.sum}
nstats_responseOverheadHistogram_count ${this.data.responseOverheadHistogram.count}
`;
    }

    return pstring;
  }

  ConvertTime(timeInSeconds) {
    var sec_num = parseInt(timeInSeconds, 10);
    var hours = Math.floor(sec_num / 3600);

    var minutes = Math.floor((sec_num - hours * 3600) / 60);
    var seconds = sec_num - hours * 3600 - minutes * 60;

    if (hours < 10) {
      hours = '0' + hours;
    }
    if (minutes < 10) {
      minutes = '0' + minutes;
    }
    if (seconds < 10) {
      seconds = '0' + seconds;
    }
    var time = hours + ':' + minutes + ':' + seconds;

    return time;
  }

  calc(cb) {
    process.nextTick(() => {
      var w = 0;
      var r = 0;

      if (this.clients) {
        var clientArray = Array.from(this.clients);

        for (var i in clientArray) {
          if (clientArray[i] !== null) {
            if (clientArray[i]._socket !== null) {
              var tW = Math.abs(Number(clientArray[i]._socket.bytesWritten));

              if (!isNaN(tW)) {
                w += Number(tW);
              }
            }

            if (clientArray[i]._socket !== null) {
              var tR = Math.abs(Number(clientArray[i]._socket.bytesRead));

              if (!isNaN(tR)) {
                r += Number(tR);
              }
            }
          }
        }
      }

      if (this.lastCalc > 0) {
        this.lastCalc = Number((Date.now() - this.lastCalc) / 1000);
      }

      this.data.writeKBS = Number(Math.abs((w - this._pdata.bytesWritten) / 1024 / this.lastCalc)).toFixed(2);
      this.data.readKBS = Number(Math.abs((r - this._pdata.bytesRead) / 1024 / this.lastCalc)).toFixed(2);

      this.data.totalBytesRead += Math.abs(r - this._pdata.bytesRead);
      this.data.totalBytesWritten += Math.abs(w - this._pdata.bytesWritten);
      this.data.totalMBytesRead = Number((this.data.totalBytesRead / 1048576).toFixed(2));
      this.data.totalMBytesWritten = Number((this.data.totalBytesWritten / 1048576).toFixed(2));
      this._pdata.bytesWritten = w || 0;
      this._pdata.bytesRead = r || 0;

      this.data.avgWriteKBs = Number(this.data.totalBytesWritten / 1024 / process.uptime()).toFixed(2);
      this.data.avgReadKBs = Number(this.data.totalBytesRead / 1024 / process.uptime()).toFixed(2);

      this.data.uptime = process.uptime();
      this.data.totalMemory = Number(process.memoryUsage().rss / 1048576).toFixed(2);

      this.data.avgPacketsSecond = (this.data.totalPackets / process.uptime()).toFixed(2);
      this.data.packetsSecond = Number(Math.abs((w - this._pdata.packets) / this.lastCalc)).toFixed(2);
      this._pdata.packets = 0;

      if (this.data.responseOverhead.total > 0) {
        this.data.responseOverhead.avg = this.data.responseOverhead.total / this.data.totalPackets;
      }

      if (this.httpServer) {
        this.httpServer.getConnections((err, count) => {
          this.data.activeSockets = count;
          this._finishCalc(cb);
        });
      } else {
        this.data.activeSockets = this.clients != null ? this.clients.length || this.clients.size : 0;
        this._finishCalc(cb);
      }
    });
  }

  _finishCalc(cb) {
    if (cb) {
      cb();
    }

    if (this.interval > 0) {
      setTimeout(() => {
        this.calc();
      }, this.interval);
    }

    this.lastCalc = Date.now();
  }

  _flattenObjectPrometheus(obj, keystr) {
    const flattened = {};

    Object.keys(obj).forEach((key) => {
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        var keystrSplit = keystr.split('_');

        keystr += key + '_';

        Object.assign(flattened, this._flattenObjectPrometheus(obj[key], keystr));
        keystrSplit.pop() == '' ? keystrSplit.push('') : null;
        keystr = keystrSplit.join('_');
      } else {
        flattened[keystr + key] = obj[key];
      }
    });

    return flattened;
  }

  _calcOverhead(time) {
    this.data.responseOverhead.total += time;

    if (this.data.responseOverhead.highest < time) {
      this.data.responseOverhead.highest = time;
    } else if (this.data.responseOverhead.lowest > time) {
      this.data.responseOverhead.lowest = time;
    }

    var sec = time / 1000;

    for (var i = 0; i < this.data.responseOverheadHistogram.bucket.length; i++) {
      if (sec <= this.data.responseOverheadHistogram.bucket[i].check) {
        this.data.responseOverheadHistogram.bucket[i].count++;
      }
    }

    this.data.responseOverheadHistogram.sum += sec;
    this.data.responseOverheadHistogram.count += 1;
  }
}

var nstats;
const fs = require('fs');

module.exports = function (ws, httpServer, server_version) {
  if (!nstats) {
    if (!server_version) {
      try {
        server_version = require(process.cwd() + '/package.json').version;
      } catch (e) {
        server_version = '0.0.0';
      }
    }

    nstats = new NStats(ws || {}, httpServer || null, server_version);
  }

  return nstats;
};

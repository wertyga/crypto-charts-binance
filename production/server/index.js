'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.io = exports.ee = undefined;

var _express = require('express');

var _express2 = _interopRequireDefault(_express);

var _bodyParser = require('body-parser');

var _bodyParser2 = _interopRequireDefault(_bodyParser);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _cluster = require('cluster');

var _cluster2 = _interopRequireDefault(_cluster);

var _http = require('http');

var _http2 = _interopRequireDefault(_http);

var _events = require('events');

var _events2 = _interopRequireDefault(_events);

var _config = require('./common/config');

var _config2 = _interopRequireDefault(_config);

var _mongoose = require('./common/mongoose');

var _mongoose2 = _interopRequireDefault(_mongoose);

var _api = require('./routes/api');

var _api2 = _interopRequireDefault(_api);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var ee = exports.ee = new _events2.default();

var log = require('./common/log')(module);
// import sessionStore from './common/sessionStore';
// import session from 'express-session';

// ****************** Import routes *************


//***********************************************

// const dev = process.env.NODE_ENV.trim() === 'development';
var dev = false;

var app = (0, _express2.default)();
var server = _http2.default.Server(app);
var io = exports.io = require('socket.io')(server);

if (dev ? false : _cluster2.default.isMaster) {

    var cpuCount = require('os').cpus().length;

    for (var i = 0; i < cpuCount; i += 1) {
        _cluster2.default.schedulingPolicy = _cluster2.default.SCHED_NONE;
        _cluster2.default.fork();
    }

    _cluster2.default.on('exit', function (worker) {
        console.log('Worker ' + worker.id + ' died :(');
        _cluster2.default.fork();
    });
} else {

    //****************** Webpack ********************
    if (dev) {
        var webpack = require('webpack');
        var webpackConfig = require('../webpack.dev.config.js');
        var webpackHotMiddleware = require('webpack-hot-middleware');
        var webpackMiddleware = require('webpack-dev-middleware');

        var compiler = webpack(webpackConfig);

        app.use(webpackMiddleware(compiler, {
            hot: true,
            publicPath: webpackConfig.output.publicPath,
            noInfo: true
        }));
        app.use(webpackHotMiddleware(compiler));
    }

    //**********************************************

    app.use(_bodyParser2.default.json());
    // app.use(cookieParser());
    if (!dev) app.use(_express2.default.static(_path2.default.join(__dirname, '..', 'client', 'static')));
    app.use(_express2.default.static(_path2.default.join(__dirname, _config2.default.uploads.directory)));
    // app.use(session({
    //     secret: config.session.secret,
    //     saveUninitialized: false,
    //     resave: true,
    //     key: config.session.key,
    //     cookie: config.session.cookie,
    //     store: sessionStore
    // }));

    //************************* GARBAGE magic ***********************************

    // Для работы с garbage collector запустите проект с параметрами:
    // node --nouse-idle-notification --expose-gc app.js
    if (!dev) {
        var init = function init() {
            gcInterval = setInterval(function () {
                gcDo();
            }, 60000);
        };

        var gcDo = function gcDo() {
            global.gc();
            clearInterval(gcInterval);
            init();
        };

        var gcInterval = void 0;

        ;

        ;

        init();
    }

    //************************************************************

    //******************************** Routes ***************************

    app.use('/api', _api2.default);

    app.get('/*', function (req, res) {
        res.sendFile(_path2.default.join(__dirname, 'index.html'));
    });

    //******************************** Run server ***************************

    server.listen(_config2.default.PORT, function () {
        return console.log('Server run on ' + _config2.default.PORT + ' port');
    });

    // ee.on('kline-data', data => {
    //     console.log(data)
    //    // const pairIo = io.of(`/${data.pair}`);
    //    // pairIo.on('connection', socket => {
    //    //     socket.emit(`kline-data`, () => data.msg)
    //    // });
    // });


    // ee.on('kline-data', data => {
    //     io.on('connection', socket => {
    //         console.log(data)
    //         socket.emit(`kline-${data.pair}`, data.msg);
    //     });
    //
    // });
};

//******************************** Uncaught Exception ***************************

process.on('uncaughtException', function (err) {
    log.error(new Date().toUTCString() + ' uncaughtException:', err.message);
    log.error(err.stack);
    process.exit(1);
});

// onKline(symbol, interval, eventHandler) {
//     return this._setupWebSocket(eventHandler, this.streams.kline(symbol, interval));
// };
// kline: (symbol, interval) => `${symbol.toLowerCase()}@kline_${interval}`,
//
// _setupWebSocket(eventHandler, path, isCombined) {
//     if (this._sockets[path]) {
//         return this._sockets[path];
//     }
//     path = (isCombined ? this._combinedBaseUrl : this._baseUrl) + path;
//     const ws = new WebSocket(path);
//
//     ws.on('message', (message) => {
//         let event;
//         try {
//             event = JSON.parse(message);
//         } catch (e) {
//             event = message;
//         }
//         if (this._beautify) {
//             if (event.stream) {
//                 event.data = this._beautifyResponse(event.data);
//             } else {
//                 event = this._beautifyResponse(event);
//             }
//         }
//
//         eventHandler(event);
//     });
//
//     ws.on('error', () => {
//         // node.js EventEmitters will throw and then exit if no error listener is registered
//     });
//
//     return ws;
// }
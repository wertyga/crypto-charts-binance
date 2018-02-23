'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.infelicity = undefined;

var _promise = require('babel-runtime/core-js/promise');

var _promise2 = _interopRequireDefault(_promise);

var _extends2 = require('babel-runtime/helpers/extends');

var _extends3 = _interopRequireDefault(_extends2);

var _events = require('events');

var _events2 = _interopRequireDefault(_events);

var _express = require('express');

var _express2 = _interopRequireDefault(_express);

var _axios = require('axios');

var _axios2 = _interopRequireDefault(_axios);

var _config = require('../common/config');

var _config2 = _interopRequireDefault(_config);

var _index = require('../index');

var _trade = require('../models/trade');

var _trade2 = _interopRequireDefault(_trade);

var _result = require('../models/result');

var _result2 = _interopRequireDefault(_result);

var _socketData = require('../socketData');

var _socketData2 = _interopRequireDefault(_socketData);

var _ema = require('../common/ema');

var _mainPairs = require('../common/mainPairs');

var _mainPairs2 = _interopRequireDefault(_mainPairs);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var route = _express2.default.Router();
var baseUrl = _config2.default.baseEndPoint;
var infelicity = exports.infelicity = 10800000;
var start = 0;

route.get('/fetch-pair/:pair/:time/:limit/', function (req, res) {
    var _req$params = req.params,
        pair = _req$params.pair,
        time = _req$params.time,
        limit = _req$params.limit;


    if (!pair || pair === 'undefined') {
        res.status(400).json({ error: 'choose pair' });
        return;
    };
    var addedApiUrl = '/api/v1/klines';
    var params = {
        symbol: pair,
        interval: !time || time === 'undefined' ? '1h' : time
        // endTime: Date.now()
    };
    if (limit && limit !== 'undefined') params.limit = limit;
    (0, _axios2.default)({
        method: 'get',
        params: params,
        url: baseUrl + addedApiUrl
    }).then(function (resp) {
        var result = resp.data.map(function (data) {
            return {
                'Open time': new Date(data[0] + infelicity),
                Open: +data[1],
                High: +data[2],
                Low: +data[3],
                Close: +data[4],
                Volume: +data[5],
                'Close time': new Date(data[6] + infelicity),
                'Quote asset volume': +data[7],
                'Number of trades': +data[8],
                'Taker buy base asset volume': +data[9],
                'Taker buy quote asset volume': +data[10],
                Ignore: +data[11]
            };
        });
        res.json({ data: result });
    }).catch(function (err) {
        res.status(500).json({ error: err.response ? err.response.data.error.msg : err.message });
    });
});

route.get('/fetch-exist-pair/:pair/:time/:_id', function (req, res) {
    var _req$params2 = req.params,
        _id = _req$params2._id,
        pair = _req$params2.pair,
        time = _req$params2.time;


    var addedApiUrl = '/api/v1/klines';
    var params = {
        symbol: pair,
        interval: !time || time === 'undefined' ? '1h' : time,
        limit: 50
        // endTime: Date.now()
    };
    (0, _axios2.default)({
        method: 'get',
        params: params,
        url: baseUrl + addedApiUrl
    }).then(function (resp) {
        var result = resp.data.map(function (data) {
            return {
                'Open time': new Date(data[0] + infelicity),
                Open: +data[1],
                High: +data[2],
                Low: +data[3],
                Close: +data[4],
                Volume: +data[5],
                'Close time': new Date(data[6] + infelicity),
                'Quote asset volume': +data[7],
                'Number of trades': +data[8],
                'Taker buy base asset volume': +data[9],
                'Taker buy quote asset volume': +data[10],
                Ignore: +data[11]
            };
        });
        _trade2.default.findById(_id).then(function (pair) {
            res.json({
                pair: (0, _extends3.default)({}, pair, {
                    currentPrice: result[result.length - 1]['Close']
                }),
                data: result
            });
        });
    }).catch(function (err) {
        return res.status(500).json({ error: err.message });
    });
});

route.get('/get-pairs', function (req, res) {
    var addedApiUrl = '/api/v1/exchangeInfo';
    (0, _axios2.default)({
        method: 'get',
        url: baseUrl + addedApiUrl
    }).then(function (resp) {
        var symbols = resp.data.symbols.map(function (item) {
            return item.symbol;
        });
        res.json({ symbols: symbols });
    }).catch(function (err) {
        return res.status(500).json({ error: err.response ? err.response.data.error.msg : err.message });
    });
});

route.get('/fetch-socket-data/:pair/:interval', function (req, res) {
    var depthLevels = 20;
    var _req$params3 = req.params,
        pair = _req$params3.pair,
        interval = _req$params3.interval;

    var ws = getSocketDataKline(pair, interval);
    var depthWs = getDepthData(pair, depthLevels);
    ws.on('message', function (msg) {
        // const currentPrice = +JSON.parse(msg).k.c;
        // compareProfit(pair, currentPrice)
        _index.io.emit('kline-' + pair, msg);
    });
    depthWs.on('message', function (msg) {
        _index.io.emit('depth-' + pair, JSON.parse(msg));
    });
    res.end();
});

route.get('/get-bot/:interval', function (req, res) {
    var interval = req.params.interval;
    analyzeData(interval).then(function (result) {
        result.result.forEach(function (item) {
            var ws = getSocketDataKline(item.pair, interval);
            ws.on('message', function (msg) {
                _index.io.emit('kline-' + item.pair, msg);
            });
        });

        res.json(result);
    }).catch(function (err) {
        res.status(500).json({ error: err.message });
    });
});

route.get('/get-active-orders', function (req, res) {
    _trade2.default.find({}).then(function (orders) {
        _promise2.default.all(orders.map(function (item) {
            var params = {
                symbol: item.pair,
                interval: item.interval,
                limit: 50
            };
            var addedApiUrl = '/api/v1/klines';

            return (0, _axios2.default)({
                method: 'get',
                params: params,
                url: baseUrl + addedApiUrl
            }).then(function (resp) {
                var result = resp.data.map(function (data) {
                    return {
                        'Open time': new Date(data[0] + infelicity),
                        Open: +data[1],
                        High: +data[2],
                        Low: +data[3],
                        Close: +data[4],
                        currentPrice: +data[4],
                        Volume: +data[5],
                        'Close time': new Date(data[6] + infelicity),
                        'Quote asset volume': +data[7],
                        'Number of trades': +data[8],
                        'Taker buy base asset volume': +data[9],
                        'Taker buy quote asset volume': +data[10],
                        Ignore: +data[11]
                    };
                });
                return {
                    _id: item._id,
                    createdAt: item.createdAt,
                    buyPrice: item.buyPrice || false,
                    data: result,
                    currentPrice: result[result.length - 1]['Close'],
                    interval: item.interval,
                    pair: item.pair,
                    closePrice: item.closePrice
                };
            });
        })).then(function (orders) {
            res.json({ orders: orders });
        });
    }).catch(function (err) {
        return res.status(500).json({ error: err.message });
    });
});

route.get('/delete-order/:_id', function (req, res) {
    _trade2.default.findByIdAndRemove(req.params._id).then(function () {
        return res.json('success deleted ' + req.params._id + ' order');
    }).catch(function (err) {
        return res.status(500).json({ error: err.message });
    });
});

route.get('/buy-pair/:pair/:time/:id/:currentPrice', function (req, res) {
    var _req$params4 = req.params,
        pair = _req$params4.pair,
        time = _req$params4.time,
        id = _req$params4.id,
        currentPrice = _req$params4.currentPrice;

    _trade2.default.findByIdAndUpdate(id, { $set: { buyPrice: +currentPrice, createdAt: Date.now() + infelicity } }, { new: true }).then(function (trade) {
        res.json({
            buyPrice: trade.buyPrice,
            createdAt: trade.createdAt
        });
    }).catch(function (err) {
        res.status(500).json({ error: err.response ? err.response.data : err.message });
    });

    // const addedApiUrl = '/api/v1/klines';
    // let params = {
    //     symbol: pair,
    //     interval: (!time || time === 'undefined' ) ? '1h' : time,
    //     limit: 1
    //     // endTime: Date.now()
    // };
    // axios({
    //     method: 'get',
    //     params,
    //     url: baseUrl + addedApiUrl
    // })
    //     .then(resp => {
    //         Trade.findByIdAndUpdate(id, { $set: { buyPrice: +resp.data[0][4], createdAt: Date.now() + infelicity } }, { new: true })
    //             .then((trade) => {
    //                 res.json({
    //                     buyPrice: trade.buyPrice,
    //                     createdAt: trade.createdAt
    //                 })
    //             })
    //     })
    //     .catch(err => {
    //         res.status(500).json({ error: err.response ? err.response.data.error.msg : err.message })
    //     })
});

route.get('/get-result', function (req, res) {
    newResult().then(function (result) {
        res.json({ result: result });
    }).catch(function (err) {
        return res.status(500).json({ error: err });
    });
});

route.get('/close-order/:id/:pair/:time/:buyDate', function (req, res) {
    var _req$params5 = req.params,
        id = _req$params5.id,
        pair = _req$params5.pair,
        time = _req$params5.time,
        buyDate = _req$params5.buyDate;


    var addedApiUrl = '/api/v1/klines';
    var params = {
        symbol: pair,
        interval: time,
        limit: 1
        // endTime: Date.now()
    };
    (0, _axios2.default)({
        method: 'get',
        params: params,
        url: baseUrl + addedApiUrl
    }).then(function (resp) {
        _trade2.default.findByIdAndUpdate(id, { $set: { closePrice: +resp.data[0][4] } }, { new: true }).then(function (trade) {
            if (trade.buyPrice && trade.closePrice) {
                var diff = (trade.closePrice - trade.buyPrice) / (trade.buyPrice / 100) - 0.2;
                new _result2.default({
                    pair: pair,
                    buyDate: buyDate,
                    result: diff
                }).save().then(function () {
                    newResult().then(function (result) {
                        res.json({
                            closePrice: trade.closePrice,
                            result: result
                        });
                    });
                });
            } else {
                res.status(404).json({ error: 'No buy price' });
            }
        });
    }).catch(function (err) {
        res.status(500).json({ error: err.response ? err.response.data.error.msg : err.message });
    });
});

route.get('/start-bot/:interval', function (req, res) {
    var interval = req.params.interval;

    var hour = new Date().getHours();
    // startBot(interval)
    var timer = setInterval(function () {
        console.log(new Date());
        var nowHour = new Date().getHours();
        var min = new Date().getMinutes();
        if (nowHour > hour) {
            hour = nowHour;
            startBot(interval);
        };
    }, 1000 * 300);
    res.redirect('/show-orders');
});

exports.default = route;


function getSocketDataKline(pair, interval) {
    var ws = new _socketData2.default();
    return ws.getKlineData(pair, interval);
};

function getDepthData(pair) {
    var levels = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 20;

    var ws = new _socketData2.default();
    return ws.getDepthData(pair, levels);
};

function newResult() {
    return _result2.default.find({}).then(function (results) {
        if (results.length > 0) {
            var sum = 0;
            for (var i = 0; i < results.length; i++) {
                sum += results[i].result;
            };
            return +(sum / results.length).toFixed(2);
        } else {
            return 0;
        }
    });
};

function getResult() {
    return _result2.default.find({}).then(function (results) {
        var result = {
            'BTC': 0,
            'ETH': 0,
            'BNB': 0
        };
        for (var i = 0; i < results.length; i++) {
            if (results[i].pair.indexOf('BTC') !== -1) {
                if (result['BTC'] === 0) {
                    result['BTC'] = +results[i].result;
                } else {
                    result['BTC'] += +results[i].result;
                };
            } else if (results[i].pair.indexOf('ETH') !== -1) {
                if (result['ETH'] === 0) {
                    result['ETH'] = +results[i].result;
                } else {
                    result['ETH'] += +results[i].result;
                };
            } else if (results[i].pair.indexOf('BNB') !== -1) {
                if (result['BNB'] === 0) {
                    result['BNB'] = +results[i].result;
                } else {
                    result['BNB'] += +results[i].result;
                };
            };
        };
        for (var key in result) {
            result[key] = +result[key].toFixed(2);
        };
        return result;
    });
};

function analyzeData() {
    var interval = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '1h';

    // Get pairs
    var limit = 50;
    return (0, _axios2.default)({
        url: baseUrl + '/api/v1/exchangeInfo',
        method: 'get'
    }).then(function (resp) {
        return _trade2.default.find({}).then(function (trades) {
            var tradesArr = trades.filter(function (item) {
                return !item.closePrice;
            }).map(function (item) {
                return item.pair;
            });
            var pairs = resp.data.symbols.map(function (item) {
                return item.symbol;
            }).filter(function (item) {
                return tradesArr.indexOf(item) === -1;
            });
            return _promise2.default.all(pairs.map(function (pair) {
                var params = {
                    symbol: pair,
                    interval: interval,
                    limit: limit
                };
                return (0, _axios2.default)({
                    method: 'get',
                    params: params,
                    url: baseUrl + '/api/v1/klines'
                }).then(function (resp) {
                    return {
                        pair: pair,
                        data: resp.data
                    };
                });
            }));
        }).then(function (data) {
            var priceData = data.map(function (pair) {
                return {
                    pair: pair.pair,
                    data: pair.data.map(function (data) {
                        return {
                            time: new Date(data[0] + infelicity),
                            price: +data[4]
                        };
                    })
                };
            });
            // const promiseArr = priceData.filter(item => isNaN(+item.pair)).filter(item => item.data.length >= limit);
            return priceData.filter(function (item) {
                return isNaN(+item.pair);
            }).filter(function (item) {
                return item.data.length >= limit;
            }).map(function (item) {
                (0, _ema.exponentialMovingAverage)(item.data, 12);
                (0, _ema.exponentialMovingAverage)(item.data, 26);
                (0, _ema.simpleMA)(item.data, 7);
                (0, _ema.simpleMA)(item.data, 25);
                (0, _ema.macdCalculate)(item.data);
                var macdData = (0, _ema.signalMACD)(item.data);
                return {
                    pair: item.pair,
                    data: macdData
                };
            });
        }).then(function (data) {
            var result = [];
            data.forEach(function (item) {
                var fmacd = item.data[item.data.length - 4].macd;
                var fsignal = item.data[item.data.length - 4].signal;
                var pmacd = item.data[item.data.length - 3].macd;
                var psignal = item.data[item.data.length - 3].signal;
                var lmacd = item.data[item.data.length - 2].macd;
                var lsignal = item.data[item.data.length - 2].signal;
                var nowmacd = item.data[item.data.length - 1].macd;
                var nowsignal = item.data[item.data.length - 1].signal;

                var sevenAndTwentyFiveEmaDiff = item.data[item.data.length - 3]['ma-7'] - item.data[item.data.length - 3]['ma-25'] < 0 && item.data[item.data.length - 2]['ma-7'] - item.data[item.data.length - 2]['ma-25'] >= 0 && item.data[item.data.length - 1]['ma-7'] - item.data[item.data.length - 1]['ma-25'] > 0;

                // if(lsignal < 0 && lmacd < 0) {
                //     const pdiff = pmacd - psignal;
                //     const ldiff = lmacd - lsignal;
                //     if(pdiff <= 0 && ldiff >= 0) result.push(item);
                // };

                // if(true) {
                //         const pdiff = pmacd - psignal;
                //         const ldiff = lmacd - lsignal;
                //         const nowdiff = nowmacd - nowsignal;
                //         // if(pdiff <= 0 && ldiff >= 0 && nowdiff > 0) result.push(item);
                //         if(pdiff <= 0 && ldiff >= 0 && nowdiff > 0) result.push(item);
                // };

                var threeUppers = item.data[item.data.length - 3]['ma-7'] < item.data[item.data.length - 2]['ma-7'] && item.data[item.data.length - 2]['ma-7'] < item.data[item.data.length - 1]['ma-7'];

                var threeDown = item.data[item.data.length - 3]['ma-7'] > item.data[item.data.length - 2]['ma-7'] && item.data[item.data.length - 2]['ma-7'] > item.data[item.data.length - 1]['ma-7'];

                var threeUppersMACD = fmacd < lmacd && pmacd < lmacd && lmacd < nowmacd;

                var nowdiff = nowmacd - nowsignal;
                var ldiff = lmacd - lsignal;
                var pdiff = pmacd - psignal;
                var fdiff = fmacd - fsignal;

                var signalCross = fdiff < 0 && ldiff <= 0 && pdiff > 0 && nowdiff > 0;

                if (threeUppers && threeUppersMACD) result.push(item);
            });

            if (result.length > 0) {
                return _promise2.default.all(result.map(function (item) {
                    return new _trade2.default({
                        pair: item.pair,
                        // buyPrice: item.data[item.data.length - 1].price,
                        // createdAt: Date.now() + infelicity,
                        currentPrice: item.data[item.data.length - 1].price,
                        interval: interval
                    }).save();
                })).then(function (trades) {
                    return { result: result };
                });
            } else {
                return { result: result };
            }
        });
    }).catch(function (err) {
        throw err;
    });
};

function startBot(interval, res) {
    var pair = void 0;
    analyzeData(interval).then(function (result) {
        result.result.forEach(function (item) {

            var ws = getSocketDataKline(item.pair, interval);
            ws.on('message', function (msg) {
                var message = JSON.parse(msg);
                var currentPrice = message.k.c;
                var msgPair = message.s;
                compareProfit(msgPair, currentPrice, ws);
                _index.io.emit('kline-' + item.pair, msg);
            });
            ws.on('error', function (err) {
                return console.log('ws: ', err);
            });
        });
        // res.end();
    }).catch(function (err) {
        // io.emit(`error-on-${item.pair}`, err.responsse ? err.response.data.error.msg : err.message)
        console.log(err);
    });
};

function calculatePercentProfit(currentPrice, buyPrice) {
    return +((+currentPrice - +buyPrice) / (+buyPrice / 100)).toFixed(2);
};
function compareProfit(pair, currentPrice, ws) {
    _trade2.default.findOne({ pair: pair }).then(function (trade) {
        var nowHour = new Date().getHours();
        // console.log(nowHour, trade.createdAt.getHours())
        // if(trade && trade.createdAt.getHours() > nowHour + 2) {
        //     trade.closePrice = currentPrice;
        //     trade.save();
        // };
        if (trade && trade.buyPrice && !trade.closePrice && calculatePercentProfit(+currentPrice, trade.buyPrice) > 2.5) {
            // calculatePercentProfit(+currentPrice, trade.buyPrice) < -2)) {

            _promise2.default.all([function () {
                var diff = (currentPrice - trade.buyPrice) / (trade.buyPrice / 100) - 0.2;
                new _result2.default({
                    pair: pair,
                    buyDate: trade.createdAt,
                    result: diff
                }).save();
            }(), function () {
                trade.closePrice = +currentPrice;
                trade.save();
            }()]).then(function () {
                newResult().then(function (result) {
                    ws.close();
                    _index.io.emit('close-kline-' + trade.pair, currentPrice);
                    _index.io.emit('set-result', result);
                });
            }).catch(function (err) {
                _index.io.emit('error-on-' + trade.pair, err.response ? err.response.data.error.msg : err.message);
            });
        };
    });
};
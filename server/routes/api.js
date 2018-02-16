import EventEmitter from 'events';

import express from 'express';
import axios from 'axios';
import config from '../common/config';

import { ee, io } from '../index';

import Trade from '../models/trade';
import Result from '../models/result';

import binanceIO from '../socketData';

import {exponentialMovingAverage, macdCalculate, simpleMA, signalMACD} from '../common/ema';

import mainPairs from '../common/mainPairs';

let route = express.Router();
const baseUrl = config.baseEndPoint;
export const infelicity = 10800000;
let start = 0;

route.get('/fetch-pair/:pair/:time/:limit/', (req, res) => {
    const { pair, time, limit } = req.params;

    if(!pair || pair === 'undefined') {
        res.status(400).json({ error: 'choose pair' });
        return;
    };
    const addedApiUrl = '/api/v1/klines';
    let params = {
        symbol: pair,
        interval: (!time || time === 'undefined' ) ? '1h' : time,
        // endTime: Date.now()
    };
    if(limit && limit !== 'undefined') params.limit = limit;
    axios({
        method: 'get',
        params,
        url: baseUrl + addedApiUrl
    })
        .then(resp => {
            const result = resp.data.map(data => {
                return {
                    'Open time': new Date(data[0] + infelicity),
                    Open: +data[1],
                    High: +data[2],
                    Low: +data[3],
                    Close: +data[4],
                    Volume: +data[5],
                    'Close time': new Date(data[6] + infelicity
                    ),
                    'Quote asset volume': +data[7],
                    'Number of trades': +data[8],
                    'Taker buy base asset volume': +data[9],
                    'Taker buy quote asset volume': +data[10],
                    Ignore: +data[11]
                };
            });
            res.json({ data: result });
        })
        .catch(err => {
            res.status(500).json({ error: err.response ? err.response.data.error.msg : err.message })
        })
});

route.get('/fetch-exist-pair/:pair/:time/:_id', (req, res) => {
    const {_id, pair, time} = req.params;

    const addedApiUrl = '/api/v1/klines';
    let params = {
        symbol: pair,
        interval: (!time || time === 'undefined' ) ? '1h' : time,
        limit: 50
        // endTime: Date.now()
    };
    axios({
        method: 'get',
        params,
        url: baseUrl + addedApiUrl
    })
        .then(resp => {
            const result = resp.data.map(data => {
                return {
                    'Open time': new Date(data[0] + infelicity),
                    Open: +data[1],
                    High: +data[2],
                    Low: +data[3],
                    Close: +data[4],
                    Volume: +data[5],
                    'Close time': new Date(data[6] + infelicity
                    ),
                    'Quote asset volume': +data[7],
                    'Number of trades': +data[8],
                    'Taker buy base asset volume': +data[9],
                    'Taker buy quote asset volume': +data[10],
                    Ignore: +data[11]
                };
            });
            Trade.findById(_id)
                .then(pair => {
                    res.json({
                        pair: {
                            ...pair,
                            currentPrice:  result[result.length - 1]['Close']
                        },
                        data: result
                    })
                })
        })
        .catch(err => res.status(500).json({ error: err.message }))
})

route.get('/get-pairs', (req, res) => {
    const addedApiUrl = '/api/v1/exchangeInfo';
    axios({
        method: 'get',
        url: baseUrl + addedApiUrl
    })
        .then(resp => {
            const symbols = resp.data.symbols.map(item => item.symbol);
            res.json({ symbols })
        })
        .catch(err => res.status(500).json({ error: err.response ? err.response.data.error.msg : err.message }))
});

route.get('/fetch-socket-data/:pair/:interval', (req, res) => {
    const {pair, interval} = req.params;
    const ws = getSocketDataKline(pair, interval);
    ws.on('message', msg => {
        io.emit(`kline-${pair}`, msg)
    });
    res.end();
});

route.get('/get-bot/:interval', (req, res) => {
    const interval  = req.params.interval;
    analyzeData(interval)
        .then(result => {
            result.result.forEach(item => {
                const ws = getSocketDataKline(item.pair, interval);
                ws.on('message', msg => {
                    io.emit(`kline-${item.pair}`, msg)
                });
            });

            res.json( result )
        })
        .catch(err => {
            res.status(500).json({ error: err.message })
        })

});

route.get('/get-active-orders', (req, res) => {
    Trade.find({})
        .then(orders => {
            Promise.all(orders.map(item => {
                let params = {
                    symbol: item.pair,
                    interval: item.interval,
                    limit: 50
                };
                const addedApiUrl = '/api/v1/klines';

                return axios({
                    method: 'get',
                    params,
                    url: baseUrl + addedApiUrl
                })
                    .then(resp => {
                        const result = resp.data.map(data => {
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
                        }
                    })
            }))
                .then(orders => {
                    res.json({ orders })
                })
        })
        .catch(err => res.status(500).json({ error: err.message }))
});

route.get('/delete-order/:_id', (req, res) => {
    Trade.findByIdAndRemove(req.params._id)
        .then(() => res.json(`success deleted ${req.params._id} order`))
        .catch(err => res.status(500).json({ error: err.message }))
});

route.get('/buy-pair/:pair/:time/:id/:currentPrice', (req, res) => {
    const { pair, time, id, currentPrice } = req.params;
    Trade.findByIdAndUpdate(id, { $set: { buyPrice: +currentPrice, createdAt: Date.now() + infelicity } }, { new: true })
        .then((trade) => {
            res.json({
                buyPrice: trade.buyPrice,
                createdAt: trade.createdAt
            })
        })
        .catch(err => {
            res.status(500).json({ error: err.response ? err.response.data : err.message })
        })



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

route.get('/get-result', (req, res) => {
    getResult().then(result => {
        res.json({ result })
    })
        .catch(err => res.status(500).json({ error: err }))
});

route.get('/close-order/:id/:pair/:time/:buyDate', (req, res) => {
    const { id, pair, time, buyDate } = req.params;

    const addedApiUrl = '/api/v1/klines';
    let params = {
        symbol: pair,
        interval: time,
        limit: 1
        // endTime: Date.now()
    };
    axios({
        method: 'get',
        params,
        url: baseUrl + addedApiUrl
    })
        .then(resp => {
            Trade.findByIdAndUpdate(id, { $set: { closePrice: +resp.data[0][4] } }, { new: true })
                .then((trade) => {
                    if(trade.buyPrice && trade.closePrice) {
                        const diff = (trade.closePrice - trade.buyPrice) / (trade.buyPrice / 100) - 0.2;
                        new Result({
                            pair,
                            buyDate,
                            result: diff > 0 ? `+${diff.toFixed(2)}%` : `${diff.toFixed(2)}%`
                        }).save()
                            .then(() => {
                                getResult().then(result => {
                                    res.json({
                                        closePrice: trade.closePrice,
                                        result
                                    });
                                })
                            })
                    } else {
                        res.status(404).json({ error: 'No buy price' })
                    }

                })
        })
        .catch(err => {
            res.status(500).json({ error: err.response ? err.response.data.error.msg : err.message })
        })
});


export default route;

function getSocketDataKline(pair, interval) {
    const ws = new binanceIO();
    return  ws.getKlineData(pair, interval);
};

function getResult() {
   return Result.find({})
       .then(results => {
           let result = {
               'BTC': 0,
               'ETH': 0,
               'BNB': 0
           };
           for(let i = 0; i < results.length; i++) {
               if(results[i].pair.indexOf('BTC') !== -1) {
                   if(result['BTC'] === 0) {
                       result['BTC'] = parseFloat(results[i].result);
                   } else {
                       result['BTC'] += parseFloat(results[i].result);
                   };
               } else if(results[i].pair.indexOf('ETH') !== -1) {
                   if(result['ETH'] === 0) {
                       result['ETH'] = parseFloat(results[i].result);
                   } else {
                       result['ETH'] += parseFloat(results[i].result);
                   };
               } else if(results[i].pair.indexOf('BNB') !== -1) {
                   if(result['BNB'] === 0) {
                       result['BNB'] = parseFloat(results[i].result);
                   } else {
                       result['BNB'] += parseFloat(results[i].result);
                   };
               };
           };
           return result;
       })
};

function analyzeData(interval='1h') {
    // Get pairs
    const limit = 50;
    return axios({
        url: baseUrl + '/api/v1/exchangeInfo',
        method: 'get'
    })
        .then(resp => {
            return Trade.find({})
                .then(trades => {
                    const tradesArr = trades.map(item => item.pair);
                    const pairs = resp.data.symbols
                        .map(item => item.symbol)
                        .filter(item => {
                            return tradesArr.indexOf(item) === -1
                        });
                    console.log(pairs)
                    return Promise.all(pairs.map(pair => {
                        let params = {
                            symbol: pair,
                            interval,
                            limit
                        };
                        return axios({
                            method: 'get',
                            params,
                            url: baseUrl + '/api/v1/klines'
                        })
                            .then(resp => {
                                return {
                                    pair,
                                    data: resp.data
                                }
                            })
                    }))
                })

                .then(data => {
                    const priceData = data.map(pair => {
                        return {
                            pair: pair.pair,
                            data: pair.data.map(data => {
                                return {
                                    time: new Date(data[0] + infelicity),
                                    price: +data[4]
                                }
                            })
                        }
                    });
                    // const promiseArr = priceData.filter(item => isNaN(+item.pair)).filter(item => item.data.length >= limit);
                    return priceData.filter(item => isNaN(+item.pair)).filter(item => item.data.length >= limit).map(item => {
                        exponentialMovingAverage(item.data, 12);
                        exponentialMovingAverage(item.data, 26);
                        simpleMA(item.data, 7);
                        simpleMA(item.data, 25);
                        macdCalculate(item.data);
                        const macdData = signalMACD(item.data);
                        return {
                            pair: item.pair,
                            data: macdData
                        }
                    });

                })
                .then(data => {
                    let result = [];
                    data.forEach(item => {
                        let pmacd = item.data[item.data.length - 3].macd;
                        let psignal = item.data[item.data.length - 3].signal;
                        let lmacd = item.data[item.data.length - 2].macd;
                        let lsignal = item.data[item.data.length - 2].signal;
                        let nowmacd = item.data[item.data.length - 1].macd;
                        let nowsignal = item.data[item.data.length - 1].signal;

                        // const sevenAndTwentyFiveEmaDiff =
                        //     (item.data[item.data.length - 3]['ma-7'] - item.data[item.data.length - 3]['ma-25'])
                        // < 0 &&
                        //     (item.data[item.data.length - 2]['ma-7'] - item.data[item.data.length - 2]['ma-25'])
                        // >= 0 &&
                        //     (item.data[item.data.length - 1]['ma-7'] - item.data[item.data.length - 1]['ma-25'])
                        // > 0;

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

                        const threeUppers = (item.data[item.data.length - 3]['ma-7'] < item.data[item.data.length - 2]['ma-7'])
                                            &&
                                            (item.data[item.data.length - 2]['ma-7'] < item.data[item.data.length - 1]['ma-7']);

                        const nowdiff = nowmacd - nowsignal;
                        const ldiff = lmacd - lsignal;
                        const pdiff = pmacd - psignal;
                        if(pdiff < 0 && ldiff >= 0 && nowdiff > 0 && threeUppers) result.push(item);
                    });

                    if(result.length > 0) {
                        return Promise.all(result.map(item => {
                            return new Trade({
                                pair: item.pair,
                                // buyPrice: item.data[item.data.length - 1].price,
                                currentPrice: item.data[item.data.length - 1].price,
                                interval
                            }).save();
                        }))
                            .then(trades => {
                                return { result }
                            })
                    } else {
                        return { result }
                    }
                })
        })
        .catch(err => { throw err })
};

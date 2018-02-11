import express from 'express';
import axios from 'axios';
import config from '../common/config';

import Trade from '../models/trade';
import Result from '../models/result';

import { exponentialMovingAverage, macdCalculate } from '../common/ema';
import { signalMACD } from '../common/ema';

let route = express.Router();
const baseUrl = config.baseEndPoint;
export const infelicity = 10800000;

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
            Trade.findByIdAndUpdate(_id, { $set: { currentPrice:  result[result.length - 1]['Close']} })
                .then(pair => {
                    res.json({
                        pair,
                        data: result
                    })
                })
        })
        .catch(err => res.status(500).json({ error: err.message }))
})

// route.get('/get-pairs', (req, res) => {
//     const addedApiUrl = '/api/v1/klines';
//     let params = {
//         symbol: pair,
//         interval: (!time || time === 'undefined' ) ? '1h' : time,
//         limit: 50
//         // endTime: Date.now()
//     };
//     axios({
//         method: 'get',
//         params,
//         url: baseUrl + addedApiUrl
//     })
// });

route.get('/get-bot/:interval', (req, res) => {
    const interval  = req.params.interval;
    analyzeData(interval)
        .then(result => {
            res.json( result )
        })
        .catch(err => res.status(500).json({ error: err }))

});

route.get('/get-active-orders', (req, res) => {
    Trade.find({})
        .then(orders => res.json({ orders }))
        .catch(err => res.status(500).json({ error: err.message }))
});

route.get('/delete-order/:_id', (req, res) => {
    Trade.findByIdAndRemove(req.params._id)
        .then(() => res.json(`success deleted ${req.params._id} order`))
        .catch(err => res.status(500).json({ error: err.message }))
});

route.get('/buy-pair/:pair/:time/:id', (req, res) => {
    const { pair, time, id } = req.params;
    const addedApiUrl = '/api/v1/klines';
    let params = {
        symbol: pair,
        interval: (!time || time === 'undefined' ) ? '1h' : time,
        limit: 1
        // endTime: Date.now()
    };
    axios({
        method: 'get',
        params,
        url: baseUrl + addedApiUrl
    })
        .then(resp => {
            Trade.findByIdAndUpdate(id, { $set: { buyPrice: +resp.data[0][4], createdAt: Date.now() + infelicity } }, { new: true })
                .then((trade) => {
                    res.json({
                        buyPrice: trade.buyPrice,
                        createdAt: trade.createdAt
                    })
                })
        })
        .catch(err => {
            res.status(500).json({ error: err.response ? err.response.data.error.msg : err.message })
        })
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
                        const diff = trade.closePrice - trade.buyPrice
                        new Result({
                            pair,
                            buyDate,
                            result: diff - ( diff / 500 ).toFixed(8)
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

function getResult() {
   return Result.find({})
       .then(results => {
           let result = 0;
           for(let i = 0; i < results.length; i++) {
               result += results[i].result
           };
           return result.toFixed(8);
       })
};


function analyzeData(interval='1h') {
    // Get pairs
    let start, finish;
    const limit = 50;
    return axios({
        url: baseUrl + '/api/v1/exchangeInfo',
        method: 'get'
    })
        .then(resp => {
            const pairs = resp.data.symbols.map(item => item.symbol);
            start = Date.now();
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

                    return priceData.filter(item => isNaN(+item.pair)).filter(item => item.data.length >= limit).map(item => {
                        exponentialMovingAverage(item.data, 12);
                        exponentialMovingAverage(item.data, 26);
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

                        // if(lsignal < 0 && lmacd < 0) {
                        //     const pdiff = pmacd - psignal;
                        //     const ldiff = lmacd - lsignal;
                        //     if(pdiff <= 0 && ldiff >= 0) result.push(item);
                        // };
                        if(true) {
                                const pdiff = pmacd - psignal;
                                const ldiff = lmacd - lsignal;
                                const nowdiff = nowmacd - nowsignal;
                                if(pdiff <= 0 && ldiff >= 0 && nowdiff > 0) result.push(item);
                        };
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

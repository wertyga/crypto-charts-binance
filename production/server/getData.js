'use strict';

var _axios = require('axios');

var _axios2 = _interopRequireDefault(_axios);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function analyzeData(signalMACD) {
    // Get pairs
    (0, _axios2.default)({
        url: baseUrl + '/api/v1/exchangeInfo',
        method: 'get'
    }).then(function (resp) {
        var pairs = resp.data.symbols;

        console.log(pairs);
    }).catch(function (err) {
        throw err;
    });
};
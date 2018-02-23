'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _mongoose = require('mongoose');

var _mongoose2 = _interopRequireDefault(_mongoose);

var _api = require('../routes/api');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var tradesSchema = _mongoose2.default.Schema({
    pair: String,
    buyPrice: Number,
    interval: String,
    closePrice: Number,
    createdAt: {
        type: Date
    }
});

exports.default = _mongoose2.default.model('trade', tradesSchema);